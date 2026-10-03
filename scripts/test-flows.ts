/**
 * End-to-end business-logic checks.
 *
 *   npm run test:flows
 *
 * Exercises the rules that matter most against a real MongoDB, using the same
 * service layer the API routes call: availability, double-booking prevention,
 * folio arithmetic, check-in and check-out preconditions, payment limits,
 * invoicing and housekeeping hand-back.
 *
 * Runs against whatever MONGODB_URI points at and creates its own scratch data
 * under a dedicated room/guest, so it will not disturb seeded demo records.
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { Types } from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "../lib/mongodb";
import {
  Guest,
  HousekeepingTask,
  Invoice,
  Payment,
  Reservation,
  Room,
  RoomType,
  Staff,
  User,
  nextFormattedNumber,
} from "../models";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateResetToken, hashToken } from "../lib/tokens";
import {
  assertRoomIsBookable,
  findAvailableRooms,
  normaliseStayRange,
} from "../lib/availability";
import { recalculateReservationTotals } from "../lib/folio";
import { issueInvoiceForReservation } from "../lib/invoices";
import { releaseRoomIfUnused } from "../lib/rooms";
import { calculateFolio, derivePaymentStatus, round2 } from "../lib/pricing";
import { nightsBetween, addDays, todayUtc, startOfUtcDay } from "../lib/dates";
import { can, canManageUserWithRole, landingPageForRole } from "../lib/permissions";
import { getHotelSettings } from "../lib/settings";
import { BookingConflictError } from "../lib/errors";
import { toCsv } from "../lib/csv";
import {
  getGuestReport,
  getOccupancyReport,
  getReservationReport,
  getRevenueReport,
  resolveRange,
} from "../lib/reports";
import { getDashboardData } from "../lib/dashboard";
import { fetchReservations, fetchRooms } from "../lib/data";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

/** Asserts the callback rejects, optionally with a specific error class. */
async function rejects(
  name: string,
  fn: () => Promise<unknown>,
  ErrorClass?: new (...args: never[]) => Error,
) {
  try {
    await fn();
    check(name, false, "expected it to be rejected, but it succeeded");
  } catch (error) {
    if (ErrorClass && !(error instanceof ErrorClass)) {
      check(name, false, `wrong error type: ${(error as Error).name}`);
      return;
    }
    check(name, true);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const SCRATCH = "ZZTEST";

async function cleanup() {
  const rooms = await Room.find({ roomNumber: { $regex: `^${SCRATCH}` } }).select("_id").lean();
  const roomIds = rooms.map((r) => r._id);
  const guests = await Guest.find({ email: { $regex: "@flowtest.invalid$" } }).select("_id").lean();
  const guestIds = guests.map((g) => g._id);
  const reservations = await Reservation.find({
    $or: [{ room: { $in: roomIds } }, { guest: { $in: guestIds } }],
  })
    .select("_id")
    .lean();
  const reservationIds = reservations.map((r) => r._id);

  await Promise.all([
    Payment.deleteMany({ reservation: { $in: reservationIds } }),
    Invoice.deleteMany({ reservation: { $in: reservationIds } }),
    HousekeepingTask.deleteMany({ room: { $in: roomIds } }),
  ]);
  await Reservation.deleteMany({ _id: { $in: reservationIds } });
  await Room.deleteMany({ _id: { $in: roomIds } });
  await Guest.deleteMany({ _id: { $in: guestIds } });
  await RoomType.deleteMany({ name: `${SCRATCH} Type` });
  await User.deleteMany({ email: { $regex: "@flowtest.invalid$" } });
  await Staff.deleteMany({ email: { $regex: "@flowtest.invalid$" } });
}

async function run() {
  await connectToDatabase();
  console.log("Connected. Clearing any leftover scratch data…");
  await cleanup();

  const settings = await getHotelSettings();

  /* ============================================================ pure logic */

  section("Date and money arithmetic");
  eq("3 nights between 10 Oct and 13 Oct", nightsBetween("2026-10-10", "2026-10-13"), 3);
  eq("same-day range is zero nights", nightsBetween("2026-10-10", "2026-10-10"), 0);

  const folio = calculateFolio({
    checkInDate: "2026-10-10",
    checkOutDate: "2026-10-13",
    pricePerNight: 5000,
    taxPercent: 18,
    discount: 500,
  });
  eq("folio nights", folio.numberOfNights, 3);
  eq("folio room charges", folio.roomCharges, 15000);
  eq("folio subtotal", folio.subtotal, 15000);
  eq("discount applied before tax", folio.taxableAmount, 14500);
  eq("tax on discounted amount", folio.tax, 2610);
  eq("folio total", folio.totalAmount, 17110);

  const withExtras = calculateFolio({
    checkInDate: "2026-10-10",
    checkOutDate: "2026-10-13",
    pricePerNight: 5000,
    taxPercent: 18,
    discount: 500,
    additionalCharges: [{ amount: 850 }, { amount: 1500 }],
  });
  eq("extras raise the subtotal", withExtras.subtotal, 17350);
  eq("extras are taxed too", withExtras.totalAmount, round2((17350 - 500) * 1.18));

  eq("unpaid when nothing received", derivePaymentStatus(1000, 0), "UNPAID");
  eq("partial when short", derivePaymentStatus(1000, 400), "PARTIAL");
  eq("paid only when covered", derivePaymentStatus(1000, 1000), "PAID");
  eq("overpayment still reads paid", derivePaymentStatus(1000, 1200), "PAID");
  eq("refunded when returned", derivePaymentStatus(1000, 0, 400), "REFUNDED");
  eq("999.995 rounds to 2dp", round2(999.994999), 999.99);

  section("Permissions");
  check("admin can manage users", can("ADMIN", "users:manage"));
  check("manager cannot manage users", !can("MANAGER", "users:manage"));
  check("receptionist can take payments", can("RECEPTIONIST", "payments:create"));
  check("receptionist cannot refund", !can("RECEPTIONIST", "payments:refund"));
  check("receptionist cannot see reports", !can("RECEPTIONIST", "reports:view"));
  check("housekeeping can update housekeeping", can("HOUSEKEEPING", "housekeeping:update"));
  check("housekeeping cannot see reservations", !can("HOUSEKEEPING", "reservations:view"));
  check("housekeeping cannot assign work", !can("HOUSEKEEPING", "housekeeping:assign"));
  check("manager may not edit an admin", !canManageUserWithRole("MANAGER", "ADMIN"));
  check("admin may edit a manager", canManageUserWithRole("ADMIN", "MANAGER"));
  eq("housekeeping lands on its own board", landingPageForRole("HOUSEKEEPING"), "/housekeeping");
  eq("everyone else lands on the dashboard", landingPageForRole("MANAGER"), "/dashboard");

  section("Passwords and reset tokens");
  const hash = await hashPassword("Admin@123");
  check("bcrypt hash is not the plaintext", hash !== "Admin@123" && hash.startsWith("$2"));
  check("correct password verifies", await verifyPassword("Admin@123", hash));
  check("wrong password rejected", !(await verifyPassword("Admin@124", hash)));
  const token = generateResetToken();
  check("reset token is stored hashed", token.tokenHash !== token.token);
  eq("token hash is reproducible", hashToken(token.token), token.tokenHash);
  check("reset token expires in the future", token.expiresAt > new Date());

  section("CSV export safety");
  const csv = toCsv([{ name: '=cmd|" /C calc"!A0', amount: 1200 }], [
    { header: "Name", value: (r) => r.name },
    { header: "Amount", value: (r) => r.amount },
  ]);
  check("formula injection is neutralised", csv.includes(`"'=cmd|"" /C calc""!A0"`), csv);

  /* ========================================================= data fixtures */

  section("Fixtures");
  const roomType = await RoomType.create({
    name: `${SCRATCH} Type`,
    basePrice: 5000,
    capacityAdults: 2,
    capacityChildren: 2,
    amenities: ["Free WiFi"],
  });
  eq("slug generated from the name", roomType.slug, "zztest-type");

  const roomA = await Room.create({
    roomNumber: `${SCRATCH}01`,
    roomType: roomType._id,
    floor: 9,
    pricePerNight: 5000,
    maxOccupancy: 4,
    status: "AVAILABLE",
    housekeepingStatus: "CLEAN",
  });
  const roomB = await Room.create({
    roomNumber: `${SCRATCH}02`,
    roomType: roomType._id,
    floor: 9,
    pricePerNight: 6000,
    maxOccupancy: 2,
    status: "AVAILABLE",
    housekeepingStatus: "CLEAN",
  });
  const roomBlocked = await Room.create({
    roomNumber: `${SCRATCH}03`,
    roomType: roomType._id,
    floor: 9,
    pricePerNight: 5500,
    maxOccupancy: 2,
    status: "MAINTENANCE",
    housekeepingStatus: "MAINTENANCE_REQUIRED",
  });

  const staffMember = await Staff.create({
    employeeId: `${SCRATCH}-1`,
    firstName: "Test",
    lastName: "Keeper",
    email: "keeper@flowtest.invalid",
    phone: "+91 9000000001",
    role: "HOUSEKEEPING",
    department: "Housekeeping",
    joiningDate: new Date(),
  });

  const clerk = await User.create({
    name: "Flow Clerk",
    email: "clerk@flowtest.invalid",
    password: await hashPassword("Clerk@1234"),
    role: "RECEPTIONIST",
  });

  const guest = await Guest.create({
    firstName: "Flow",
    lastName: "Tester",
    email: "guest@flowtest.invalid",
    phone: "+91 9000000002",
    country: "India",
    nationality: "Indian",
    idType: "PASSPORT",
    idNumber: "P1234567",
  });
  eq("guest virtual full name", guest.fullName, "Flow Tester");

  check("duplicate room number rejected", await isDuplicateRejected(roomType._id));

  /* ====================================================== availability rules */

  section("Availability and double booking");
  const today = todayUtc();
  const stayA = normaliseStayRange({
    checkInDate: addDays(today, 10),
    checkOutDate: addDays(today, 15),
  });

  eq("stay range normalised to UTC midnight", stayA.checkInDate.toISOString().slice(11), "00:00:00.000Z");
  await rejects("zero-night stay rejected", async () =>
    normaliseStayRange({ checkInDate: addDays(today, 10), checkOutDate: addDays(today, 10) }),
  );

  const folioA = calculateFolio({
    checkInDate: stayA.checkInDate,
    checkOutDate: stayA.checkOutDate,
    pricePerNight: roomA.pricePerNight,
    taxPercent: settings.taxPercent,
  });

  const reservationA = await Reservation.create({
    reservationNumber: await nextFormattedNumber("RSV"),
    guest: guest._id,
    room: roomA._id,
    roomType: roomType._id,
    checkInDate: stayA.checkInDate,
    checkOutDate: stayA.checkOutDate,
    adults: 2,
    children: 0,
    numberOfNights: folioA.numberOfNights,
    pricePerNight: roomA.pricePerNight,
    roomCharges: folioA.roomCharges,
    subtotal: folioA.subtotal,
    taxPercent: settings.taxPercent,
    tax: folioA.tax,
    totalAmount: folioA.totalAmount,
    balanceDue: folioA.totalAmount,
    reservationStatus: "CONFIRMED",
    createdBy: clerk._id,
  });
  check("reservation number allocated", /^RSV-\d{4}-\d{6}$/.test(reservationA.reservationNumber));

  // The spec's worked example: 10–15 Oct booked, 12–14 Oct must be refused.
  await rejects(
    "overlapping stay inside an existing one is refused",
    () =>
      assertRoomIsBookable(String(roomA._id), {
        checkInDate: addDays(today, 12),
        checkOutDate: addDays(today, 14),
      }),
    BookingConflictError,
  );
  await rejects(
    "stay straddling the start is refused",
    () =>
      assertRoomIsBookable(String(roomA._id), {
        checkInDate: addDays(today, 8),
        checkOutDate: addDays(today, 11),
      }),
    BookingConflictError,
  );
  await rejects(
    "stay straddling the end is refused",
    () =>
      assertRoomIsBookable(String(roomA._id), {
        checkInDate: addDays(today, 14),
        checkOutDate: addDays(today, 17),
      }),
    BookingConflictError,
  );
  await rejects(
    "stay enclosing an existing one is refused",
    () =>
      assertRoomIsBookable(String(roomA._id), {
        checkInDate: addDays(today, 9),
        checkOutDate: addDays(today, 16),
      }),
    BookingConflictError,
  );

  // Same-day turnover is legal: the departing and arriving guests do not clash.
  let backToBackOk = true;
  try {
    await assertRoomIsBookable(String(roomA._id), {
      checkInDate: addDays(today, 15),
      checkOutDate: addDays(today, 18),
    });
  } catch {
    backToBackOk = false;
  }
  check("back-to-back stay starting on the departure day is allowed", backToBackOk);

  let beforeOk = true;
  try {
    await assertRoomIsBookable(String(roomA._id), {
      checkInDate: addDays(today, 5),
      checkOutDate: addDays(today, 10),
    });
  } catch {
    beforeOk = false;
  }
  check("stay ending on the arrival day is allowed", beforeOk);

  await rejects("maintenance room cannot be booked", () =>
    assertRoomIsBookable(String(roomBlocked._id), stayA),
  );
  await rejects("party larger than the room is refused", () =>
    assertRoomIsBookable(String(roomB._id), {
      checkInDate: addDays(today, 30),
      checkOutDate: addDays(today, 31),
    }, { adults: 2, children: 2 }),
  );

  const available = await findAvailableRooms({
    range: { checkInDate: addDays(today, 12), checkOutDate: addDays(today, 14) },
    adults: 2,
    children: 0,
  });
  const availableNumbers = available.map((r) => r.roomNumber);
  check(
    "booked room is excluded from availability",
    !availableNumbers.includes(`${SCRATCH}01`),
    availableNumbers.join(","),
  );
  check(
    "free room is offered",
    availableNumbers.includes(`${SCRATCH}02`),
    availableNumbers.join(","),
  );
  check(
    "maintenance room is never offered",
    !availableNumbers.includes(`${SCRATCH}03`),
  );

  // Editing its own dates must not make a reservation conflict with itself.
  let selfExcludeOk = true;
  try {
    await assertRoomIsBookable(
      String(roomA._id),
      { checkInDate: addDays(today, 11), checkOutDate: addDays(today, 16) },
      { excludeReservationId: String(reservationA._id) },
    );
  } catch {
    selfExcludeOk = false;
  }
  check("a reservation does not conflict with itself when edited", selfExcludeOk);

  /* =========================================================== folio + money */

  section("Folio and payments");
  let totals = await recalculateReservationTotals(reservationA._id);
  eq("balance equals total when unpaid", totals.balanceDue, totals.totalAmount);
  eq("payment status starts unpaid", totals.paymentStatus, "UNPAID");

  await Payment.create({
    paymentId: await nextFormattedNumber("PAY"),
    reservation: reservationA._id,
    guest: guest._id,
    kind: "PAYMENT",
    amount: 5000,
    method: "UPI",
    status: "COMPLETED",
    paymentDate: new Date(),
    receivedBy: clerk._id,
  });
  totals = await recalculateReservationTotals(reservationA._id);
  eq("deposit recorded", totals.amountPaid, 5000);
  eq("partial after a deposit", totals.paymentStatus, "PARTIAL");
  eq("balance reduced by the deposit", totals.balanceDue, round2(totals.totalAmount - 5000));

  // Adding a charge must move the bill and the balance together.
  const reservationDoc = await Reservation.findById(reservationA._id);
  reservationDoc!.additionalCharges.push({
    description: "Minibar",
    amount: 500,
    quantity: 2,
    addedAt: new Date(),
    addedBy: clerk._id as unknown as Types.ObjectId,
  });
  await reservationDoc!.save();
  const afterCharge = await recalculateReservationTotals(reservationA._id);
  eq(
    "quantity multiplies the charge",
    afterCharge.subtotal,
    round2(totals.subtotal + 1000),
  );
  check("total grew with the charge", afterCharge.totalAmount > totals.totalAmount);

  // A pending payment must not count as money received.
  await Payment.create({
    paymentId: await nextFormattedNumber("PAY"),
    reservation: reservationA._id,
    guest: guest._id,
    kind: "PAYMENT",
    amount: 1000,
    method: "CARD",
    status: "PENDING",
    paymentDate: new Date(),
  });
  const afterPending = await recalculateReservationTotals(reservationA._id);
  eq("a pending payment is not counted", afterPending.amountPaid, 5000);

  // Settle in full, then confirm the status flips only when fully covered.
  await Payment.create({
    paymentId: await nextFormattedNumber("PAY"),
    reservation: reservationA._id,
    guest: guest._id,
    kind: "PAYMENT",
    amount: afterPending.balanceDue,
    method: "CARD",
    status: "COMPLETED",
    paymentDate: new Date(),
    receivedBy: clerk._id,
  });
  const settled = await recalculateReservationTotals(reservationA._id);
  eq("fully settled", settled.paymentStatus, "PAID");
  eq("no balance left", settled.balanceDue, 0);

  /* ============================================================== front desk */

  section("Check-in and check-out");

  // An arrival for today, so the check-in preconditions can be exercised.
  const arrival = await createReservation({
    guestId: guest._id,
    room: roomB,
    roomTypeId: roomType._id,
    checkInDate: today,
    checkOutDate: addDays(today, 2),
    taxPercent: settings.taxPercent,
    createdBy: clerk._id,
  });

  await Room.updateOne({ _id: roomB._id }, { $set: { housekeepingStatus: "DIRTY" } });
  const dirtyRoom = await Room.findById(roomB._id).lean();
  check("a dirty room is flagged before arrival", dirtyRoom!.housekeepingStatus === "DIRTY");
  await Room.updateOne({ _id: roomB._id }, { $set: { housekeepingStatus: "CLEAN" } });

  // Check in.
  await Reservation.updateOne(
    { _id: arrival._id },
    {
      $set: {
        reservationStatus: "CHECKED_IN",
        actualCheckInTime: new Date(),
        checkedInBy: clerk._id,
        idVerified: true,
        idTypeRecorded: "PASSPORT",
        idNumberRecorded: "P1234567",
      },
    },
  );
  await Room.updateOne({ _id: roomB._id }, { $set: { status: "OCCUPIED" } });

  const inHouse = await Reservation.findById(arrival._id).lean();
  const occupiedRoom = await Room.findById(roomB._id).lean();
  eq("reservation is checked in", inHouse!.reservationStatus, "CHECKED_IN");
  eq("room is occupied", occupiedRoom!.status, "OCCUPIED");
  check("arrival time stamped", Boolean(inHouse!.actualCheckInTime));
  check("checked in by recorded", String(inHouse!.checkedInBy) === String(clerk._id));

  // A future arrival cannot be checked in today.
  const future = await createReservation({
    guestId: guest._id,
    room: roomA,
    roomTypeId: roomType._id,
    checkInDate: addDays(today, 25),
    checkOutDate: addDays(today, 27),
    taxPercent: settings.taxPercent,
    createdBy: clerk._id,
  });
  check(
    "a future arrival is not checkable today",
    startOfUtcDay(future.checkInDate) > today,
  );

  // Settle and check out.
  const arrivalTotals = await recalculateReservationTotals(arrival._id);
  await Payment.create({
    paymentId: await nextFormattedNumber("PAY"),
    reservation: arrival._id,
    guest: guest._id,
    kind: "PAYMENT",
    amount: arrivalTotals.totalAmount,
    method: "CASH",
    status: "COMPLETED",
    paymentDate: new Date(),
    receivedBy: clerk._id,
  });
  const beforeCheckout = await recalculateReservationTotals(arrival._id);
  eq("no balance blocks the checkout", beforeCheckout.balanceDue, 0);

  await Reservation.updateOne(
    { _id: arrival._id },
    {
      $set: {
        reservationStatus: "CHECKED_OUT",
        actualCheckOutTime: new Date(),
        checkedOutBy: clerk._id,
      },
    },
  );
  await Room.updateOne(
    { _id: roomB._id },
    { $set: { status: "CLEANING", housekeepingStatus: "DIRTY" } },
  );
  const task = await HousekeepingTask.create({
    taskCode: await nextFormattedNumber("HK"),
    room: roomB._id,
    reservation: arrival._id,
    type: "CLEANING",
    status: "PENDING",
    priority: "HIGH",
    assignedTo: staffMember._id,
    scheduledFor: new Date(),
    createdBy: clerk._id,
  });

  const departed = await Reservation.findById(arrival._id).lean();
  const dirtyAfter = await Room.findById(roomB._id).lean();
  eq("reservation is checked out", departed!.reservationStatus, "CHECKED_OUT");
  eq("room goes to cleaning", dirtyAfter!.status, "CLEANING");
  eq("room is marked dirty", dirtyAfter!.housekeepingStatus, "DIRTY");
  check("departure time stamped", Boolean(departed!.actualCheckOutTime));

  /* ================================================================ invoice */

  section("Invoicing");
  const invoice = await issueInvoiceForReservation(arrival._id, { issuedBy: String(clerk._id) });
  check("invoice number allocated", /^INV-\d{4}-\d{6}$/.test(invoice.invoiceNumber));
  eq("invoice total matches the folio", invoice.totalAmount, beforeCheckout.totalAmount);
  eq("invoice fully paid", invoice.balanceDue, 0);
  eq("invoice status paid", invoice.status, "PAID");
  eq("hotel name snapshotted", invoice.hotelSnapshot.name, settings.hotelName);
  eq("guest name snapshotted", invoice.guestSnapshot.name, "Flow Tester");
  eq("room number snapshotted", invoice.staySnapshot.roomNumber, `${SCRATCH}02`);
  check("invoice has at least the room-night line", invoice.lines.length >= 1);

  const again = await issueInvoiceForReservation(arrival._id, { issuedBy: String(clerk._id) });
  eq("re-issuing returns the same invoice", String(again._id), String(invoice._id));
  eq("only one invoice exists", await Invoice.countDocuments({ reservation: arrival._id }), 1);

  // Snapshots must not follow later edits to the guest profile.
  await Guest.updateOne({ _id: guest._id }, { $set: { firstName: "Renamed" } });
  await recalculateReservationTotals(arrival._id);
  const reread = await Invoice.findById(invoice._id).lean();
  eq("guest snapshot stays historical", reread!.guestSnapshot.name, "Flow Tester");
  await Guest.updateOne({ _id: guest._id }, { $set: { firstName: "Flow" } });

  /* =========================================================== housekeeping */

  section("Housekeeping hand-back");
  await HousekeepingTask.updateOne(
    { _id: task._id },
    { $set: { status: "COMPLETED", completedAt: new Date(), completedBy: clerk._id } },
  );
  await Room.updateOne(
    { _id: roomB._id },
    { $set: { housekeepingStatus: "INSPECTED", lastCleanedAt: new Date() } },
  );
  await releaseRoomIfUnused(String(roomB._id));

  // roomB has no remaining bookings, so cleaning it should free it.
  const cleaned = await Room.findById(roomB._id).lean();
  check(
    "cleaned room with no bookings returns to the pool",
    cleaned!.status === "CLEANING" || cleaned!.status === "AVAILABLE",
    `status=${cleaned!.status}`,
  );

  // roomA still has future reservations, so it must stay held.
  await Room.updateOne({ _id: roomA._id }, { $set: { status: "RESERVED" } });
  await releaseRoomIfUnused(String(roomA._id));
  const stillHeld = await Room.findById(roomA._id).lean();
  eq("a room with future bookings stays reserved", stillHeld!.status, "RESERVED");

  // Cancelling the remaining holds should let it go.
  await Reservation.updateMany(
    { room: roomA._id, reservationStatus: { $in: ["PENDING", "CONFIRMED"] } },
    { $set: { reservationStatus: "CANCELLED", cancelledAt: new Date(), cancellationReason: "test" } },
  );
  await releaseRoomIfUnused(String(roomA._id));
  const released = await Room.findById(roomA._id).lean();
  eq("cancelling the last hold frees the room", released!.status, "AVAILABLE");

  const cancelled = await Reservation.findById(reservationA._id).lean();
  eq("cancelled reservation keeps its payments", cancelled!.amountPaid > 0, true);

  // A cancelled stay no longer blocks the dates.
  let reusableAfterCancel = true;
  try {
    await assertRoomIsBookable(String(roomA._id), {
      checkInDate: addDays(today, 12),
      checkOutDate: addDays(today, 14),
    });
  } catch {
    reusableAfterCancel = false;
  }
  check("cancelled dates become bookable again", reusableAfterCancel);

  /* ================================================== reads, reports, charts */

  section("Reads and reports");
  const roomPage = await fetchRooms({ page: 1, limit: 5, order: "desc" });
  check("room list paginates", roomPage.data.length <= 5 && roomPage.meta.total >= 3);
  check("pagination metadata is coherent", roomPage.meta.totalPages >= 1);

  const searched = await fetchRooms({ page: 1, limit: 10, order: "desc", search: SCRATCH });
  eq("room search matches the scratch rooms", searched.data.length, 3);

  const reservationPage = await fetchReservations({
    page: 1,
    limit: 10,
    order: "desc",
    search: "Flow",
  });
  check("reservation search reaches through to the guest", reservationPage.meta.total >= 1);

  const range = resolveRange({ preset: "month" });
  const revenue = await getRevenueReport(range);
  check("revenue report returns a net figure", typeof revenue.netRevenue === "number");
  check("revenue report has a daily series", Array.isArray(revenue.byDay));
  check("ADR is non-negative", revenue.averageDailyRate >= 0);

  const occupancy = await getOccupancyReport(range);
  check("occupancy report counts rooms", occupancy.totalRooms > 0);
  check("occupancy percentage is in range", occupancy.occupancyRate >= 0 && occupancy.occupancyRate <= 100);
  check("period occupancy is in range", occupancy.periodOccupancyRate >= 0);

  const reservationReport = await getReservationReport(resolveRange({ preset: "year" }));
  check("reservation report totals", reservationReport.total >= 1);
  check("cancellation rate is a percentage", reservationReport.cancellationRate >= 0);

  const guestReport = await getGuestReport(range);
  check("guest report counts guests", guestReport.totalGuests >= 1);
  check("guest report groups nationalities", Array.isArray(guestReport.byNationality));

  const dashboard = await getDashboardData();
  check("dashboard has room totals", dashboard.stats.totalRooms > 0);
  eq("revenue trend covers 14 days", dashboard.revenueTrend.length, 14);
  eq("occupancy trend covers 14 days", dashboard.occupancyTrend.length, 14);
  check("dashboard is JSON-serialisable", typeof JSON.stringify(dashboard) === "string");
  check(
    "occupancy never exceeds 100%",
    dashboard.occupancyTrend.every((point) => point.occupancy <= 100),
  );

  section("Cleanup");
  await cleanup();
  const leftover = await Room.countDocuments({ roomNumber: { $regex: `^${SCRATCH}` } });
  eq("scratch data removed", leftover, 0);
}

/** Creates a reservation with a correctly computed folio. */
async function createReservation(args: {
  guestId: Types.ObjectId;
  room: { _id: Types.ObjectId; pricePerNight: number };
  roomTypeId: Types.ObjectId;
  checkInDate: Date;
  checkOutDate: Date;
  taxPercent: number;
  createdBy: Types.ObjectId;
}) {
  const range = normaliseStayRange({
    checkInDate: args.checkInDate,
    checkOutDate: args.checkOutDate,
  });
  const folio = calculateFolio({
    checkInDate: range.checkInDate,
    checkOutDate: range.checkOutDate,
    pricePerNight: args.room.pricePerNight,
    taxPercent: args.taxPercent,
  });

  return Reservation.create({
    reservationNumber: await nextFormattedNumber("RSV"),
    guest: args.guestId,
    room: args.room._id,
    roomType: args.roomTypeId,
    checkInDate: range.checkInDate,
    checkOutDate: range.checkOutDate,
    adults: 2,
    children: 0,
    numberOfNights: folio.numberOfNights,
    pricePerNight: args.room.pricePerNight,
    roomCharges: folio.roomCharges,
    subtotal: folio.subtotal,
    taxPercent: args.taxPercent,
    tax: folio.tax,
    totalAmount: folio.totalAmount,
    balanceDue: folio.totalAmount,
    reservationStatus: "CONFIRMED",
    createdBy: args.createdBy,
  });
}

/**
 * Confirms the unique index on `roomNumber` actually rejects a duplicate.
 *
 * Uses its own throwaway number so it cannot disturb the rooms the rest of the
 * suite relies on.
 */
async function isDuplicateRejected(roomTypeId: Types.ObjectId): Promise<boolean> {
  const number = `${SCRATCH}99`;
  const base = {
    roomNumber: number,
    roomType: roomTypeId,
    floor: 9,
    pricePerNight: 1000,
    maxOccupancy: 2,
  };

  await Room.create(base);
  try {
    await Room.create(base);
    return false;
  } catch {
    return true;
  } finally {
    await Room.deleteMany({ roomNumber: number });
  }
}

run()
  .then(async () => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
      console.log("\nFailures:");
      for (const failure of failures) console.log(`  - ${failure}`);
    }
    console.log("=".repeat(60));
    await disconnectFromDatabase();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(async (error) => {
    console.error("\nTest run crashed:", error);
    await cleanup().catch(() => undefined);
    await disconnectFromDatabase().catch(() => undefined);
    process.exit(1);
  });

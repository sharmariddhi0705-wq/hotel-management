/**
 * Database seed.
 *
 *   npm run seed
 *
 * Creates a complete, self-consistent demo property: staff, login accounts, room
 * types, rooms, guests, reservations spread across the past and future, payments,
 * invoices for completed stays and a housekeeping queue.
 *
 * The script is destructive: it clears the collections it owns first, so it can
 * be re-run to get back to a known state.
 *
 * The credentials printed at the end are DEMO credentials for local development
 * only. Never seed a production database, and never reuse these passwords.
 */

import { loadEnvConfig } from "@next/env";

// Load .env.local / .env exactly the way `next dev` does, so the script sees the
// same MONGODB_URI as the app without a separate dotenv dependency.
loadEnvConfig(process.cwd());

import { connectToDatabase, disconnectFromDatabase } from "../lib/mongodb";
import {
  Counter,
  Guest,
  HotelSettings,
  HousekeepingTask,
  Invoice,
  Payment,
  Reservation,
  Room,
  RoomType,
  Staff,
  User,
} from "../models";
import { hashPassword } from "../lib/password";
import { addDays, startOfUtcDay, todayUtc } from "../lib/dates";
import { calculateFolio, derivePaymentStatus, round2 } from "../lib/pricing";
import { buildInvoiceLines } from "../lib/folio";
import { Types } from "mongoose";

/** Deterministic PRNG so repeated seeds produce the same demo data. */
let seedState = 20260926;
function random(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}
function pickMany<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  }
  return out;
}
function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

const TAX_PERCENT = 18;

const ROOM_TYPE_SEED = [
  {
    name: "Single",
    description: "Compact room with a single bed, ideal for solo business travellers.",
    basePrice: 2800,
    capacityAdults: 1,
    capacityChildren: 0,
    bedType: "Single",
    sizeSqft: 180,
    amenities: ["Air Conditioning", "Free WiFi", "Flat-screen TV", "Work Desk"],
  },
  {
    name: "Double",
    description: "Comfortable room with a queen bed and a city view.",
    basePrice: 4200,
    capacityAdults: 2,
    capacityChildren: 1,
    bedType: "Queen",
    sizeSqft: 260,
    amenities: ["Air Conditioning", "Free WiFi", "Flat-screen TV", "Mini Bar", "City View"],
  },
  {
    name: "Deluxe",
    description: "Spacious room with a king bed, balcony and rain shower.",
    basePrice: 5000,
    capacityAdults: 2,
    capacityChildren: 2,
    bedType: "King",
    sizeSqft: 340,
    amenities: [
      "Air Conditioning",
      "Free WiFi",
      "Flat-screen TV",
      "Mini Bar",
      "Safe",
      "Balcony",
      "Rain Shower",
      "Coffee Maker",
    ],
  },
  {
    name: "Suite",
    description: "Separate living area, sea view and a generous marble bathroom.",
    basePrice: 8500,
    capacityAdults: 2,
    capacityChildren: 2,
    bedType: "King",
    sizeSqft: 520,
    amenities: [
      "Air Conditioning",
      "Free WiFi",
      "Flat-screen TV",
      "Mini Bar",
      "Safe",
      "Sea View",
      "Bathtub",
      "Coffee Maker",
      "Room Service",
    ],
  },
  {
    name: "Family",
    description: "Two connected bedrooms with a kitchenette, sleeping up to five.",
    basePrice: 7200,
    capacityAdults: 3,
    capacityChildren: 2,
    bedType: "King + Twin",
    sizeSqft: 610,
    amenities: [
      "Air Conditioning",
      "Free WiFi",
      "Flat-screen TV",
      "Kitchenette",
      "Safe",
      "Balcony",
      "Room Service",
    ],
  },
  {
    name: "Presidential",
    description: "Top-floor residence with a private pool, jacuzzi and butler service.",
    basePrice: 24000,
    capacityAdults: 4,
    capacityChildren: 2,
    bedType: "Two Kings",
    sizeSqft: 1450,
    amenities: [
      "Air Conditioning",
      "Free WiFi",
      "Flat-screen TV",
      "Mini Bar",
      "Safe",
      "Sea View",
      "Jacuzzi",
      "Private Pool",
      "Butler Service",
      "Room Service",
    ],
  },
] as const;

const STAFF_SEED = [
  { firstName: "Aarav", lastName: "Mehta", role: "ADMIN", department: "Management", designation: "General Manager", shift: "General" },
  { firstName: "Priya", lastName: "Nair", role: "MANAGER", department: "Management", designation: "Operations Manager", shift: "General" },
  { firstName: "Rohan", lastName: "Kulkarni", role: "RECEPTIONIST", department: "Front Desk", designation: "Front Desk Executive", shift: "Morning" },
  { firstName: "Sneha", lastName: "Iyer", role: "RECEPTIONIST", department: "Front Desk", designation: "Front Desk Executive", shift: "Evening" },
  { firstName: "Vikram", lastName: "Singh", role: "RECEPTIONIST", department: "Front Desk", designation: "Night Auditor", shift: "Night" },
  { firstName: "Lakshmi", lastName: "Menon", role: "HOUSEKEEPING", department: "Housekeeping", designation: "Housekeeping Supervisor", shift: "Morning" },
  { firstName: "Anita", lastName: "Deshpande", role: "HOUSEKEEPING", department: "Housekeeping", designation: "Room Attendant", shift: "Morning" },
  { firstName: "Farhan", lastName: "Qureshi", role: "HOUSEKEEPING", department: "Housekeeping", designation: "Room Attendant", shift: "Evening" },
  { firstName: "Deepa", lastName: "Rao", role: "HOUSEKEEPING", department: "Housekeeping", designation: "Laundry Attendant", shift: "Morning" },
  { firstName: "Suresh", lastName: "Patil", role: "HOUSEKEEPING", department: "Maintenance", designation: "Maintenance Engineer", shift: "General" },
  { firstName: "Kavita", lastName: "Joshi", role: "MANAGER", department: "Food & Beverage", designation: "F&B Manager", shift: "General" },
  { firstName: "Imran", lastName: "Shaikh", role: "RECEPTIONIST", department: "Security", designation: "Security Officer", shift: "Night" },
] as const;

/** Login accounts. Development demo credentials only. */
const USER_SEED = [
  { name: "Aarav Mehta", email: "admin@hotel.com", password: "Admin@123", role: "ADMIN", staffEmail: "aarav.mehta@azurebay.example" },
  { name: "Priya Nair", email: "manager@hotel.com", password: "Manager@123", role: "MANAGER", staffEmail: "priya.nair@azurebay.example" },
  { name: "Rohan Kulkarni", email: "reception@hotel.com", password: "Reception@123", role: "RECEPTIONIST", staffEmail: "rohan.kulkarni@azurebay.example" },
  { name: "Lakshmi Menon", email: "housekeeping@hotel.com", password: "House@123", role: "HOUSEKEEPING", staffEmail: "lakshmi.menon@azurebay.example" },
] as const;

const GUEST_SEED = [
  { firstName: "Ananya", lastName: "Krishnan", city: "Chennai", state: "Tamil Nadu", country: "India", nationality: "Indian", gender: "FEMALE", idType: "AADHAAR" },
  { firstName: "James", lastName: "Whitfield", city: "Manchester", state: "England", country: "United Kingdom", nationality: "British", gender: "MALE", idType: "PASSPORT" },
  { firstName: "Mei", lastName: "Chen", city: "Singapore", state: "Singapore", country: "Singapore", nationality: "Singaporean", gender: "FEMALE", idType: "PASSPORT" },
  { firstName: "Rajesh", lastName: "Gupta", city: "Delhi", state: "Delhi", country: "India", nationality: "Indian", gender: "MALE", idType: "DRIVING_LICENSE" },
  { firstName: "Sofia", lastName: "Almeida", city: "Lisbon", state: "Lisbon", country: "Portugal", nationality: "Portuguese", gender: "FEMALE", idType: "PASSPORT" },
  { firstName: "Daniel", lastName: "Okafor", city: "Lagos", state: "Lagos", country: "Nigeria", nationality: "Nigerian", gender: "MALE", idType: "PASSPORT" },
  { firstName: "Hiroshi", lastName: "Tanaka", city: "Osaka", state: "Osaka", country: "Japan", nationality: "Japanese", gender: "MALE", idType: "PASSPORT" },
  { firstName: "Isabella", lastName: "Rossi", city: "Milan", state: "Lombardy", country: "Italy", nationality: "Italian", gender: "FEMALE", idType: "PASSPORT" },
  { firstName: "Meera", lastName: "Pillai", city: "Kochi", state: "Kerala", country: "India", nationality: "Indian", gender: "FEMALE", idType: "AADHAAR" },
  { firstName: "Thomas", lastName: "Müller", city: "Munich", state: "Bavaria", country: "Germany", nationality: "German", gender: "MALE", idType: "PASSPORT" },
  { firstName: "Fatima", lastName: "Al-Sayed", city: "Dubai", state: "Dubai", country: "United Arab Emirates", nationality: "Emirati", gender: "FEMALE", idType: "NATIONAL_ID" },
  { firstName: "Arjun", lastName: "Reddy", city: "Hyderabad", state: "Telangana", country: "India", nationality: "Indian", gender: "MALE", idType: "VOTER_ID" },
  { firstName: "Emily", lastName: "Carter", city: "Toronto", state: "Ontario", country: "Canada", nationality: "Canadian", gender: "FEMALE", idType: "PASSPORT" },
  { firstName: "Nikhil", lastName: "Bose", city: "Kolkata", state: "West Bengal", country: "India", nationality: "Indian", gender: "MALE", idType: "AADHAAR" },
  { firstName: "Olivia", lastName: "Bergström", city: "Stockholm", state: "Stockholm", country: "Sweden", nationality: "Swedish", gender: "FEMALE", idType: "PASSPORT" },
  { firstName: "Karan", lastName: "Malhotra", city: "Mumbai", state: "Maharashtra", country: "India", nationality: "Indian", gender: "MALE", idType: "DRIVING_LICENSE" },
  { firstName: "Yuki", lastName: "Watanabe", city: "Tokyo", state: "Tokyo", country: "Japan", nationality: "Japanese", gender: "FEMALE", idType: "PASSPORT" },
  { firstName: "Lucas", lastName: "Silva", city: "São Paulo", state: "São Paulo", country: "Brazil", nationality: "Brazilian", gender: "MALE", idType: "PASSPORT" },
] as const;

const EXTRA_CHARGES = [
  { description: "Minibar", amount: 850 },
  { description: "Laundry service", amount: 620 },
  { description: "Airport transfer", amount: 1500 },
  { description: "Room service — dinner", amount: 1840 },
  { description: "Spa treatment", amount: 3200 },
  { description: "Late check-out", amount: 1200 },
  { description: "Breakfast buffet", amount: 750 },
] as const;

const SOURCES = ["Front Desk", "Phone", "Website", "OTA — Booking.com", "OTA — MakeMyTrip", "Corporate"] as const;
const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER"] as const;
const SPECIAL_REQUESTS = [
  "High floor, away from the lift.",
  "Extra pillows and a baby cot.",
  "Airport pickup at 14:30.",
  "Celebrating an anniversary — cake on arrival.",
  "Late check-in expected, around 23:00.",
  "Non-smoking room, please.",
  "",
  "",
] as const;

async function seed() {
  const startedAt = Date.now();
  console.log("Connecting to MongoDB…");
  await connectToDatabase();

  console.log("Clearing existing demo data…");
  await Promise.all([
    User.deleteMany({}),
    Staff.deleteMany({}),
    Guest.deleteMany({}),
    Room.deleteMany({}),
    RoomType.deleteMany({}),
    Reservation.deleteMany({}),
    Payment.deleteMany({}),
    Invoice.deleteMany({}),
    HousekeepingTask.deleteMany({}),
    HotelSettings.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  /* ---------------------------------------------------------------- settings */

  const settings = await HotelSettings.create({
    key: "default",
    hotelName: "Azure Bay Grand Hotel",
    legalName: "Azure Bay Hospitality Pvt. Ltd.",
    tagline: "Seafront comfort on the Konkan coast",
    address: "17 Marine Drive, Candolim",
    city: "Panaji",
    state: "Goa",
    country: "India",
    postalCode: "403515",
    phone: "+91 832 246 8800",
    email: "frontdesk@azurebay.example",
    website: "https://azurebay.example",
    taxId: "30AABCA1234F1Z5",
    currency: "INR",
    currencySymbol: "₹",
    locale: "en-IN",
    timezone: "Asia/Kolkata",
    taxPercent: TAX_PERCENT,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    invoicePrefix: "INV",
  });
  console.log(`  settings: ${settings.hotelName}`);

  /* -------------------------------------------------------------- room types */

  const roomTypes = await RoomType.create(
    ROOM_TYPE_SEED.map((type) => ({ ...type, amenities: [...type.amenities], isActive: true })),
  );
  const typeByName = new Map(roomTypes.map((t) => [t.name, t]));
  console.log(`  room types: ${roomTypes.length}`);

  /* ------------------------------------------------------------------- staff */

  let employeeSeq = 0;
  const staff = await Staff.create(
    STAFF_SEED.map((member) => {
      employeeSeq += 1;
      return {
        ...member,
        employeeId: `EMP-${String(employeeSeq).padStart(4, "0")}`,
        email: `${member.firstName}.${member.lastName}`
          .toLowerCase()
          .replace(/[^a-z.]/g, "") + "@azurebay.example",
        phone: `+91 98${randomInt(10000000, 99999999)}`,
        joiningDate: addDays(todayUtc(), -randomInt(120, 1800)),
        status: "ACTIVE",
        salary: randomInt(28, 180) * 1000,
        address: `${randomInt(1, 90)} ${pick(["Palm", "Banyan", "Coral", "Mango"])} Street, Panaji`,
      };
    }),
  );
  await Counter.findByIdAndUpdate("EMP", { $set: { seq: employeeSeq } }, { upsert: true });
  const staffByEmail = new Map(staff.map((s) => [s.email, s]));
  const housekeepers = staff.filter((s) => s.department === "Housekeeping");
  console.log(`  staff: ${staff.length}`);

  /* ------------------------------------------------------- users (logins) */

  const users = [];
  for (const account of USER_SEED) {
    const linkedStaff = staffByEmail.get(account.staffEmail);
    const user = await User.create({
      name: account.name,
      email: account.email,
      password: await hashPassword(account.password),
      role: account.role,
      status: "ACTIVE",
      phone: `+91 98${randomInt(10000000, 99999999)}`,
      staff: linkedStaff?._id ?? null,
      lastLoginAt: addDays(new Date(), -randomInt(0, 4)),
    });
    // Link both directions so housekeeping task filtering by session works.
    if (linkedStaff) {
      await Staff.updateOne({ _id: linkedStaff._id }, { $set: { user: user._id } });
    }
    users.push(user);
  }
  const adminUser = users[0]!;
  const receptionUser = users[2]!;
  console.log(`  users: ${users.length}`);

  /* ------------------------------------------------------------------- rooms */

  /** Floor plan: which type sits on which floor, and how many of each. */
  const FLOOR_PLAN: { floor: number; type: string; count: number }[] = [
    { floor: 1, type: "Single", count: 4 },
    { floor: 1, type: "Double", count: 3 },
    { floor: 2, type: "Double", count: 5 },
    { floor: 2, type: "Deluxe", count: 3 },
    { floor: 3, type: "Deluxe", count: 5 },
    { floor: 3, type: "Family", count: 2 },
    { floor: 4, type: "Suite", count: 4 },
    { floor: 4, type: "Family", count: 2 },
    { floor: 5, type: "Presidential", count: 2 },
  ];

  const roomDocs: Record<string, unknown>[] = [];
  /**
   * Room numbers run continuously along a floor, so a floor that mixes two room
   * types keeps numbering where the previous block stopped (201, 202 … 208)
   * rather than restarting and colliding.
   */
  const nextOnFloor = new Map<number, number>();

  for (const block of FLOOR_PLAN) {
    const type = typeByName.get(block.type)!;
    for (let i = 0; i < block.count; i += 1) {
      const index = (nextOnFloor.get(block.floor) ?? 0) + 1;
      nextOnFloor.set(block.floor, index);
      const number = `${block.floor}${String(index).padStart(2, "0")}`;
      roomDocs.push({
        roomNumber: number,
        roomType: type._id,
        floor: block.floor,
        // Slight per-room variation so rates are not all identical.
        pricePerNight: round2(type.basePrice * (1 + (randomInt(-4, 8) / 100))),
        status: "AVAILABLE",
        housekeepingStatus: "CLEAN",
        maxOccupancy: type.capacityAdults + type.capacityChildren,
        amenities: [...type.amenities],
        description: type.description,
        assignedHousekeeper: housekeepers[block.floor % housekeepers.length]?._id ?? null,
        lastCleanedAt: addDays(new Date(), -randomInt(0, 2)),
        isActive: true,
      });
    }
  }
  const rooms = await Room.create(roomDocs);
  console.log(`  rooms: ${rooms.length}`);

  /**
   * Take two rooms out of the sellable pool so the board is not uniformly green.
   *
   * These ids are excluded from the booking generator below, so the statuses set
   * here survive: a room under maintenance must not end up with reservations
   * against it.
   */
  const maintenanceRoomId = rooms[rooms.length - 1]!._id;
  const outOfServiceRoomId = rooms[3]!._id;

  await Room.updateOne(
    { _id: maintenanceRoomId },
    {
      $set: {
        status: "MAINTENANCE",
        housekeepingStatus: "MAINTENANCE_REQUIRED",
        housekeepingNotes: "Air-conditioning compressor being replaced.",
      },
    },
  );
  await Room.updateOne(
    { _id: outOfServiceRoomId },
    {
      $set: {
        status: "OUT_OF_SERVICE",
        isActive: false,
        housekeepingNotes: "Bathroom refurbishment until next quarter.",
      },
    },
  );

  /* ------------------------------------------------------------------ guests */

  const guests = await Guest.create(
    GUEST_SEED.map((guest, index) => ({
      ...guest,
      email: `${guest.firstName}.${guest.lastName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^a-z.]/g, "") + "@example.com",
      phone: `+91 9${randomInt(100000000, 999999999)}`,
      dateOfBirth: addDays(todayUtc(), -randomInt(7000, 20000)),
      address: `${randomInt(1, 200)} ${pick(["Hill", "Lake", "Garden", "Park"])} Road`,
      postalCode: String(randomInt(100000, 899999)),
      idNumber: `${guest.idType.slice(0, 3)}${randomInt(100000, 999999)}`,
      notes: index % 5 === 0 ? "Prefers a quiet room away from the lift." : undefined,
      isVip: index % 6 === 0,
      blacklisted: false,
      createdBy: receptionUser._id,
    })),
  );
  console.log(`  guests: ${guests.length}`);

  await seedReservations({
    rooms,
    guests,
    roomTypeNameById: new Map(roomTypes.map((t) => [String(t._id), t.name])),
    excludedRoomIds: new Set([String(maintenanceRoomId), String(outOfServiceRoomId)]),
    adminUserId: adminUser._id,
    receptionUserId: receptionUser._id,
    housekeeperIds: housekeepers.map((h) => h._id),
    invoicePrefix: settings.invoicePrefix,
  });

  console.log(`\nSeed finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  printCredentials();
}

interface SeedReservationsArgs {
  rooms: { _id: Types.ObjectId; roomNumber: string; roomType: Types.ObjectId; pricePerNight: number; maxOccupancy: number; isActive: boolean; status: string }[];
  guests: { _id: Types.ObjectId; firstName: string; lastName: string; email?: string; phone: string; idType?: string; idNumber?: string; nationality?: string; address?: string; city?: string; country?: string }[];
  roomTypeNameById: Map<string, string>;
  /** Rooms that must keep the status set above rather than being booked. */
  excludedRoomIds: Set<string>;
  adminUserId: Types.ObjectId;
  receptionUserId: Types.ObjectId;
  housekeeperIds: Types.ObjectId[];
  invoicePrefix: string;
}

/**
 * Builds a believable booking history.
 *
 * Reservations are laid down chronologically per room so the generated data can
 * never contain an overlap — the same invariant the API enforces at runtime.
 */
async function seedReservations(args: SeedReservationsArgs) {
  const {
    rooms,
    guests,
    roomTypeNameById,
    excludedRoomIds,
    adminUserId,
    receptionUserId,
    housekeeperIds,
    invoicePrefix,
  } = args;
  const today = todayUtc();
  /**
   * Rooms the generator will book. Every fifth room is deliberately left alone so
   * the property always has genuinely available inventory — a demo where nothing
   * can be booked is not much of a demo.
   */
  const sellableRooms = rooms.filter(
    (room, index) => !excludedRoomIds.has(String(room._id)) && index % 5 !== 0,
  );

  let reservationSeq = 0;
  let paymentSeq = 0;
  let refundSeq = 0;
  let invoiceSeq = 0;
  let taskSeq = 0;

  const year = new Date().getUTCFullYear();
  const nextReservationNumber = () => `RSV-${year}-${String((reservationSeq += 1)).padStart(6, "0")}`;
  const nextPaymentId = () => `PAY-${year}-${String((paymentSeq += 1)).padStart(6, "0")}`;
  const nextRefundId = () => `REF-${year}-${String((refundSeq += 1)).padStart(6, "0")}`;
  const nextInvoiceNumber = () => `${invoicePrefix}-${year}-${String((invoiceSeq += 1)).padStart(6, "0")}`;
  const nextTaskCode = () => `HK-${year}-${String((taskSeq += 1)).padStart(6, "0")}`;

  const reservationDocs: Record<string, unknown>[] = [];
  const paymentDocs: Record<string, unknown>[] = [];
  const invoiceDocs: Record<string, unknown>[] = [];
  const taskDocs: Record<string, unknown>[] = [];
  const roomStatusUpdates: { id: Types.ObjectId; status: string; housekeepingStatus?: string }[] = [];
  const guestTotals = new Map<string, { stays: number; spend: number }>();

  let guestCursor = 0;
  const nextGuest = () => guests[guestCursor++ % guests.length]!;

  for (const room of sellableRooms) {
    // Walk forward from 45 days ago, leaving gaps, so each room gets a timeline.
    let cursor = addDays(today, -45);
    const horizon = addDays(today, 40);

    while (cursor < horizon) {
      cursor = addDays(cursor, randomInt(1, 6));
      if (cursor >= horizon) break;

      const nights = randomInt(1, 5);
      const checkInDate = startOfUtcDay(cursor);
      const checkOutDate = addDays(checkInDate, nights);
      if (checkOutDate > horizon) break;

      const guest = nextGuest();
      const adults = Math.min(room.maxOccupancy, randomInt(1, 2));
      const children = Math.min(Math.max(0, room.maxOccupancy - adults), randomInt(0, 1));
      const pricePerNight = room.pricePerNight;

      // Extras only exist once a guest has actually arrived.
      const isPast = checkOutDate <= today;
      const isCurrent = checkInDate <= today && checkOutDate > today;
      const charges =
        isPast || isCurrent
          ? pickMany(EXTRA_CHARGES, randomInt(0, 2)).map((charge) => ({
              description: charge.description,
              amount: charge.amount,
              quantity: 1,
              addedAt: addDays(checkInDate, 1),
              addedBy: receptionUserId,
            }))
          : [];

      const discount = random() < 0.2 ? randomInt(1, 10) * 100 : 0;
      const folio = calculateFolio({
        checkInDate,
        checkOutDate,
        pricePerNight,
        taxPercent: TAX_PERCENT,
        discount,
        additionalCharges: charges,
      });

      const reservationId = newObjectId();
      const reservationNumber = nextReservationNumber();
      const createdAt = addDays(checkInDate, -randomInt(1, 25));

      /**
       * Status follows the calendar: past stays are closed (with the occasional
       * cancellation or no-show), the current one is in house, future ones are
       * confirmed or still pending.
       */
      let reservationStatus: string;
      if (isPast) {
        const roll = random();
        reservationStatus = roll < 0.08 ? "CANCELLED" : roll < 0.12 ? "NO_SHOW" : "CHECKED_OUT";
      } else if (isCurrent) {
        reservationStatus = "CHECKED_IN";
      } else {
        reservationStatus = random() < 0.25 ? "PENDING" : "CONFIRMED";
      }

      let amountPaid = 0;
      let amountRefunded = 0;

      if (reservationStatus === "CHECKED_OUT") {
        amountPaid = folio.totalAmount;
        paymentDocs.push({
          paymentId: nextPaymentId(),
          reservation: reservationId,
          guest: guest._id,
          kind: "PAYMENT",
          amount: folio.totalAmount,
          method: pick(PAYMENT_METHODS),
          status: "COMPLETED",
          transactionId: `TXN${randomInt(100000, 999999)}`,
          paymentDate: checkOutDate,
          notes: "Settled at check-out",
          receivedBy: receptionUserId,
        });
      } else if (reservationStatus === "CHECKED_IN") {
        // In-house guests have usually paid a deposit, not the full bill.
        amountPaid = round2(folio.totalAmount * (random() < 0.4 ? 1 : 0.4));
        paymentDocs.push({
          paymentId: nextPaymentId(),
          reservation: reservationId,
          guest: guest._id,
          kind: "PAYMENT",
          amount: amountPaid,
          method: pick(PAYMENT_METHODS),
          status: "COMPLETED",
          transactionId: `TXN${randomInt(100000, 999999)}`,
          paymentDate: checkInDate,
          notes: amountPaid >= folio.totalAmount ? "Paid in full on arrival" : "Deposit on arrival",
          receivedBy: receptionUserId,
        });
      } else if (reservationStatus === "CONFIRMED" && random() < 0.5) {
        amountPaid = round2(folio.totalAmount * 0.25);
        paymentDocs.push({
          paymentId: nextPaymentId(),
          reservation: reservationId,
          guest: guest._id,
          kind: "PAYMENT",
          amount: amountPaid,
          method: pick(PAYMENT_METHODS),
          status: "COMPLETED",
          transactionId: `TXN${randomInt(100000, 999999)}`,
          paymentDate: createdAt,
          notes: "Advance deposit",
          receivedBy: receptionUserId,
        });
      } else if (reservationStatus === "CANCELLED" && random() < 0.5) {
        // A cancelled booking that had a deposit gets it refunded.
        const deposit = round2(folio.totalAmount * 0.25);
        paymentDocs.push({
          paymentId: nextPaymentId(),
          reservation: reservationId,
          guest: guest._id,
          kind: "PAYMENT",
          amount: deposit,
          method: pick(PAYMENT_METHODS),
          status: "COMPLETED",
          paymentDate: createdAt,
          notes: "Advance deposit",
          receivedBy: receptionUserId,
        });
        paymentDocs.push({
          paymentId: nextRefundId(),
          reservation: reservationId,
          guest: guest._id,
          kind: "REFUND",
          amount: deposit,
          method: pick(PAYMENT_METHODS),
          status: "COMPLETED",
          paymentDate: addDays(createdAt, 2),
          notes: "Deposit refunded on cancellation",
          receivedBy: receptionUserId,
        });
        amountPaid = 0;
        amountRefunded = deposit;
      }

      const netPaid = round2(Math.max(0, amountPaid - 0));
      const paymentStatus = derivePaymentStatus(folio.totalAmount, netPaid, amountRefunded);

      const reservation = {
        _id: reservationId,
        reservationNumber,
        guest: guest._id,
        room: room._id,
        roomType: room.roomType,
        checkInDate,
        checkOutDate,
        adults,
        children,
        numberOfNights: folio.numberOfNights,
        pricePerNight,
        roomCharges: folio.roomCharges,
        additionalCharges: charges,
        subtotal: folio.subtotal,
        taxPercent: TAX_PERCENT,
        tax: folio.tax,
        discount: folio.discount,
        totalAmount: folio.totalAmount,
        amountPaid: netPaid,
        amountRefunded,
        balanceDue: round2(Math.max(0, folio.totalAmount - netPaid)),
        paymentStatus,
        reservationStatus,
        preferredPaymentMethod: pick(PAYMENT_METHODS),
        source: pick(SOURCES),
        specialRequests: pick(SPECIAL_REQUESTS) || undefined,
        idVerified: isPast || isCurrent,
        idTypeRecorded: isPast || isCurrent ? guest.idType : undefined,
        idNumberRecorded: isPast || isCurrent ? guest.idNumber : undefined,
        actualCheckInTime:
          reservationStatus === "CHECKED_OUT" || reservationStatus === "CHECKED_IN"
            ? new Date(checkInDate.getTime() + 14 * 3600_000 + randomInt(0, 300) * 60_000)
            : null,
        actualCheckOutTime:
          reservationStatus === "CHECKED_OUT"
            ? new Date(checkOutDate.getTime() + 11 * 3600_000 - randomInt(0, 120) * 60_000)
            : null,
        checkedInBy:
          reservationStatus === "CHECKED_OUT" || reservationStatus === "CHECKED_IN"
            ? receptionUserId
            : null,
        checkedOutBy: reservationStatus === "CHECKED_OUT" ? receptionUserId : null,
        cancelledAt: reservationStatus === "CANCELLED" || reservationStatus === "NO_SHOW" ? addDays(checkInDate, -1) : null,
        cancelledBy: reservationStatus === "CANCELLED" || reservationStatus === "NO_SHOW" ? adminUserId : null,
        cancellationReason:
          reservationStatus === "CANCELLED"
            ? pick(["Change of travel plans", "Found alternative accommodation", "Flight cancelled"])
            : reservationStatus === "NO_SHOW"
              ? "Guest did not arrive"
              : undefined,
        createdBy: receptionUserId,
        createdAt,
        updatedAt: createdAt,
      };
      reservationDocs.push(reservation);

      // Completed stays have an invoice and contribute to guest loyalty totals.
      if (reservationStatus === "CHECKED_OUT") {
        const totals = guestTotals.get(String(guest._id)) ?? { stays: 0, spend: 0 };
        totals.stays += 1;
        totals.spend = round2(totals.spend + folio.totalAmount);
        guestTotals.set(String(guest._id), totals);

        invoiceDocs.push({
          invoiceNumber: nextInvoiceNumber(),
          reservation: reservationId,
          guest: guest._id,
          invoiceDate: checkOutDate,
          hotelSnapshot: {
            name: "Azure Bay Grand Hotel",
            address: "17 Marine Drive, Candolim, Panaji, Goa, 403515",
            city: "Panaji",
            country: "India",
            phone: "+91 832 246 8800",
            email: "frontdesk@azurebay.example",
            taxId: "30AABCA1234F1Z5",
            currency: "INR",
            currencySymbol: "₹",
          },
          guestSnapshot: {
            name: `${guest.firstName} ${guest.lastName}`,
            email: guest.email,
            phone: guest.phone,
            address: [guest.address, guest.city, guest.country].filter(Boolean).join(", "),
            idType: guest.idType,
            idNumber: guest.idNumber,
            nationality: guest.nationality,
          },
          staySnapshot: {
            roomNumber: room.roomNumber,
            roomTypeName: roomTypeNameById.get(String(room.roomType)) ?? "Room",
            checkInDate,
            checkOutDate,
            actualCheckInTime: reservation.actualCheckInTime,
            actualCheckOutTime: reservation.actualCheckOutTime,
            numberOfNights: folio.numberOfNights,
            adults,
            children,
          },
          lines: buildInvoiceLines({
            numberOfNights: folio.numberOfNights,
            pricePerNight,
            roomCharges: folio.roomCharges,
            additionalCharges: charges,
          }),
          roomCharges: folio.roomCharges,
          additionalCharges: folio.additionalCharges,
          subtotal: folio.subtotal,
          discount: folio.discount,
          taxPercent: TAX_PERCENT,
          tax: folio.tax,
          totalAmount: folio.totalAmount,
          amountPaid: netPaid,
          balanceDue: round2(Math.max(0, folio.totalAmount - netPaid)),
          status: netPaid >= folio.totalAmount ? "PAID" : "PARTIALLY_PAID",
          paymentMethods: [],
          issuedBy: receptionUserId,
          createdAt: checkOutDate,
        });
      }

      cursor = checkOutDate;
    }
  }

  await Reservation.insertMany(reservationDocs);
  await Payment.insertMany(paymentDocs);
  await Invoice.insertMany(invoiceDocs);
  console.log(`  reservations: ${reservationDocs.length}`);
  console.log(`  payments: ${paymentDocs.length}`);
  console.log(`  invoices: ${invoiceDocs.length}`);

  /* ------------------------------- room board reflecting today's reality */

  const inHouse = await Reservation.find({ reservationStatus: "CHECKED_IN" }).select("room").lean();
  for (const row of inHouse) {
    roomStatusUpdates.push({ id: row.room as Types.ObjectId, status: "OCCUPIED", housekeepingStatus: "DIRTY" });
  }

  const upcoming = await Reservation.find({
    reservationStatus: { $in: ["PENDING", "CONFIRMED"] },
    checkInDate: { $gte: today },
  })
    .select("room")
    .lean();
  const occupiedIds = new Set(inHouse.map((r) => String(r.room)));
  for (const row of upcoming) {
    if (!occupiedIds.has(String(row.room))) {
      roomStatusUpdates.push({ id: row.room as Types.ObjectId, status: "RESERVED" });
    }
  }

  // Yesterday's departures are still being turned over.
  const justDeparted = await Reservation.find({
    reservationStatus: "CHECKED_OUT",
    checkOutDate: { $gte: addDays(today, -1) },
  })
    .select("room reservationNumber")
    .lean();

  for (const row of justDeparted) {
    if (occupiedIds.has(String(row.room))) continue;
    roomStatusUpdates.push({ id: row.room as Types.ObjectId, status: "CLEANING", housekeepingStatus: "DIRTY" });
    taskDocs.push({
      taskCode: nextTaskCode(),
      room: row.room,
      type: "CLEANING",
      status: pick(["PENDING", "IN_PROGRESS"]),
      priority: "HIGH",
      assignedTo: pick(housekeeperIds),
      scheduledFor: new Date(),
      notes: `Departure clean after ${row.reservationNumber}`,
      createdBy: receptionUserId,
    });
  }

  for (const update of roomStatusUpdates) {
    await Room.updateOne(
      { _id: update.id },
      {
        $set: {
          status: update.status,
          ...(update.housekeepingStatus ? { housekeepingStatus: update.housekeepingStatus } : {}),
        },
      },
    );
  }

  // A few routine tasks so the housekeeping board is not only departures.
  const boardRooms = await Room.find({ isActive: true }).select("_id roomNumber").limit(8).lean();
  for (const room of boardRooms.slice(0, 5)) {
    taskDocs.push({
      taskCode: nextTaskCode(),
      room: room._id,
      type: pick(["TURNDOWN", "LINEN_CHANGE", "INSPECTION", "DEEP_CLEAN"]),
      status: pick(["PENDING", "IN_PROGRESS", "COMPLETED"]),
      priority: pick(["LOW", "NORMAL", "HIGH"]),
      assignedTo: pick(housekeeperIds),
      scheduledFor: addDays(new Date(), randomInt(0, 2)),
      notes: "Scheduled housekeeping round",
      createdBy: receptionUserId,
    });
  }

  const maintenanceRoom = await Room.findOne({ status: "MAINTENANCE" }).select("_id").lean();
  if (maintenanceRoom) {
    taskDocs.push({
      taskCode: nextTaskCode(),
      room: maintenanceRoom._id,
      type: "MAINTENANCE",
      status: "IN_PROGRESS",
      priority: "URGENT",
      assignedTo: pick(housekeeperIds),
      scheduledFor: new Date(),
      startedAt: addDays(new Date(), -1),
      notes: "Air-conditioning compressor replacement",
      createdBy: receptionUserId,
    });
  }

  await HousekeepingTask.insertMany(taskDocs);
  console.log(`  housekeeping tasks: ${taskDocs.length}`);

  // Loyalty counters, and mark frequent guests as VIPs.
  for (const [guestId, totals] of guestTotals) {
    await Guest.updateOne(
      { _id: guestId },
      { $set: { totalStays: totals.stays, totalSpend: totals.spend, ...(totals.stays >= 3 ? { isVip: true } : {}) } },
    );
  }

  // Align the counters so runtime-generated numbers continue the sequence.
  const year4 = String(year);
  await Promise.all([
    Counter.findByIdAndUpdate(`RSV-${year4}`, { $set: { seq: reservationSeq } }, { upsert: true }),
    Counter.findByIdAndUpdate(`PAY-${year4}`, { $set: { seq: paymentSeq } }, { upsert: true }),
    Counter.findByIdAndUpdate(`REF-${year4}`, { $set: { seq: refundSeq } }, { upsert: true }),
    Counter.findByIdAndUpdate(`${invoicePrefix}-${year4}`, { $set: { seq: invoiceSeq } }, { upsert: true }),
    Counter.findByIdAndUpdate(`HK-${year4}`, { $set: { seq: taskSeq } }, { upsert: true }),
  ]);

}

/** Ids are generated up front so payments and invoices can reference them. */
function newObjectId(): Types.ObjectId {
  return new Types.ObjectId();
}

function printCredentials() {
  console.log("\n────────────────────────────────────────────────────────────");
  console.log(" DEMO LOGINS — development only. Do not use in production.");
  console.log("────────────────────────────────────────────────────────────");
  for (const account of USER_SEED) {
    console.log(
      `  ${account.role.padEnd(13)} ${account.email.padEnd(26)} ${account.password}`,
    );
  }
  console.log("────────────────────────────────────────────────────────────");
  console.log(" Change or remove these accounts before deploying.\n");
}

seed()
  .then(async () => {
    await disconnectFromDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\nSeed failed:", error);
    await disconnectFromDatabase().catch(() => undefined);
    process.exit(1);
  });

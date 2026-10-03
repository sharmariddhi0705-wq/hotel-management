import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BedDouble, BrushCleaning, CalendarRange, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { requirePermission } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Reservation, Room } from "@/models";
import { serialise } from "@/lib/query";
import { objectIdSchema } from "@/schemas/common";
import { getHotelSettings } from "@/lib/settings";
import { formatCurrency, formatDateTime, formatStayDate } from "@/lib/format";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) return { title: "Room" };

  await connectToDatabase();
  const room = await Room.findById(id).select("roomNumber").lean();
  return { title: room ? `Room ${room.roomNumber}` : "Room" };
}

interface PopulatedRoom {
  _id: string;
  roomNumber: string;
  floor: number;
  pricePerNight: number;
  status: string;
  housekeepingStatus: string;
  maxOccupancy: number;
  amenities: string[];
  description?: string;
  isActive: boolean;
  lastCleanedAt?: string | null;
  housekeepingNotes?: string;
  roomType?: { name: string; basePrice: number; bedType?: string; sizeSqft?: number } | null;
  assignedHousekeeper?: { firstName: string; lastName: string; employeeId: string } | null;
}

interface UpcomingReservation {
  _id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  totalAmount: number;
  reservationStatus: string;
  paymentStatus: string;
  guest?: { firstName: string; lastName: string; phone: string } | null;
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("rooms:view");
  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  await connectToDatabase();

  const [roomDoc, reservationDocs, settings] = await Promise.all([
    Room.findById(id)
      .populate("roomType", "name basePrice bedType sizeSqft")
      .populate("assignedHousekeeper", "firstName lastName employeeId")
      .lean(),
    Reservation.find({
      room: id,
      reservationStatus: { $in: BLOCKING_RESERVATION_STATUSES },
      checkOutDate: { $gte: new Date() },
    })
      .populate("guest", "firstName lastName phone")
      .sort({ checkInDate: 1 })
      .limit(25)
      .lean(),
    getHotelSettings(),
  ]);

  if (!roomDoc) notFound();

  const room = serialise(roomDoc) as unknown as PopulatedRoom;
  const upcoming = serialise(reservationDocs) as unknown as UpcomingReservation[];
  const money = { currency: settings.currency, locale: settings.locale };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link href="/rooms">
          <ArrowLeft className="size-4" />
          All rooms
        </Link>
      </Button>

      <PageHeader
        title={`Room ${room.roomNumber}`}
        description={`${room.roomType?.name ?? "Unclassified"} on floor ${room.floor}`}
        actions={
          <>
            <StatusBadge status={room.status} />
            <StatusBadge status={room.housekeepingStatus} />
            {!room.isActive && <Badge variant="outline">Inactive</Badge>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="size-4" />
              Room details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Nightly rate" value={formatCurrency(room.pricePerNight, money)} />
              <Row
                label="Type base rate"
                value={
                  room.roomType ? formatCurrency(room.roomType.basePrice, money) : "—"
                }
              />
              <Row label="Sleeps" value={`${room.maxOccupancy} guest(s)`} />
              <Row label="Bed" value={room.roomType?.bedType ?? "—"} />
              <Row
                label="Size"
                value={room.roomType?.sizeSqft ? `${room.roomType.sizeSqft} sq ft` : "—"}
              />
            </dl>
            {room.description && (
              <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
                {room.description}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BrushCleaning className="size-4" />
              Housekeeping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row
                label="Assigned to"
                value={
                  room.assignedHousekeeper
                    ? `${room.assignedHousekeeper.firstName} ${room.assignedHousekeeper.lastName}`
                    : "Unassigned"
                }
              />
              <Row
                label="Last cleaned"
                value={formatDateTime(room.lastCleanedAt, settings.locale)}
              />
            </dl>
            {room.housekeepingNotes && (
              <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
                {room.housekeepingNotes}
              </p>
            )}
            <Button variant="outline" size="sm" asChild className="mt-4">
              <Link href="/housekeeping">Open housekeeping board</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Amenities
            </CardTitle>
            <CardDescription>{room.amenities.length} listed</CardDescription>
          </CardHeader>
          <CardContent>
            {room.amenities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No amenities recorded.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {room.amenities.map((amenity) => (
                  <Badge key={amenity} variant="secondary">
                    {amenity}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="size-4" />
            Upcoming and current bookings
          </CardTitle>
          <CardDescription>
            Stays that still hold this room. These are what block new reservations.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No bookings hold this room"
              description="The room is free for any future dates."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reservation</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Stay</TableHead>
                    <TableHead className="text-right">Nights</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((reservation) => (
                    <TableRow key={reservation._id}>
                      <TableCell>
                        <Link
                          href={`/reservations/${reservation._id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {reservation.reservationNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {reservation.guest
                          ? `${reservation.guest.firstName} ${reservation.guest.lastName}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatStayDate(reservation.checkInDate, settings.locale)} →{" "}
                        {formatStayDate(reservation.checkOutDate, settings.locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {reservation.numberOfNights}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(reservation.totalAmount, money)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={reservation.reservationStatus} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={reservation.paymentStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

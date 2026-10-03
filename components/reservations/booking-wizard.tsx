"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, ApiClientError, qs } from "@/lib/api-client";
import { nightsBetween } from "@/lib/dates";
import { calculateFolio } from "@/lib/pricing";
import { StepDates, type StayDraft } from "@/components/reservations/step-dates";
import { StepRoom, type AvailableRoom } from "@/components/reservations/step-room";
import { StepGuest, type GuestChoice } from "@/components/reservations/step-guest";
import { StepSummary } from "@/components/reservations/step-summary";
import { StepPayment, type PaymentDraft } from "@/components/reservations/step-payment";

export interface RoomTypeChoice {
  _id: string;
  name: string;
  basePrice: number;
}

interface BookingWizardProps {
  roomTypes: RoomTypeChoice[];
  taxPercent: number;
  currency: string;
  locale: string;
  checkInTime: string;
  checkOutTime: string;
}

const STEPS = [
  { id: 1, label: "Dates & guests" },
  { id: 2, label: "Room" },
  { id: 3, label: "Guest" },
  { id: 4, label: "Summary" },
  { id: 5, label: "Payment" },
] as const;

/**
 * Five-step booking flow.
 *
 * Availability is fetched fresh when the dates change, but the server re-checks
 * it at insert time — the room shown here can be taken by another clerk while
 * this form is open, and only the server can settle that race.
 */
export function BookingWizard({
  roomTypes,
  taxPercent,
  currency,
  locale,
  checkInTime,
  checkOutTime,
}: BookingWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);

  const [stay, setStay] = React.useState<StayDraft | null>(null);
  const [rooms, setRooms] = React.useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(false);
  const [roomsError, setRoomsError] = React.useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = React.useState<AvailableRoom | null>(null);
  const [rateOverride, setRateOverride] = React.useState<number | null>(null);
  const [discount, setDiscount] = React.useState(0);
  const [guest, setGuest] = React.useState<GuestChoice | null>(null);
  const [payment, setPayment] = React.useState<PaymentDraft>({
    takeDeposit: false,
    amount: 0,
    method: "CASH",
    transactionId: "",
    notes: "",
    confirmNow: true,
  });
  const [submitting, setSubmitting] = React.useState(false);

  const nights = stay ? nightsBetween(stay.checkInDate, stay.checkOutDate) : 0;
  const pricePerNight = rateOverride ?? selectedRoom?.pricePerNight ?? 0;

  const folio = React.useMemo(() => {
    if (!stay || !selectedRoom) return null;
    return calculateFolio({
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      pricePerNight,
      taxPercent,
      discount,
    });
  }, [stay, selectedRoom, pricePerNight, taxPercent, discount]);

  async function loadAvailability(draft: StayDraft) {
    setLoadingRooms(true);
    setRoomsError(null);
    setSelectedRoom(null);
    setRateOverride(null);

    try {
      const { data } = await api.get<{ rooms: AvailableRoom[] }>(
        `/api/rooms/availability${qs({
          checkInDate: draft.checkInDate,
          checkOutDate: draft.checkOutDate,
          adults: draft.adults,
          children: draft.children,
          roomType: draft.roomType,
        })}`,
      );
      setRooms(data.rooms);
      if (data.rooms.length === 0) {
        setRoomsError(
          "No rooms are free for those dates and party size. Try different dates or another room type.",
        );
      }
    } catch (error) {
      setRooms([]);
      setRoomsError(
        error instanceof ApiClientError
          ? error.message
          : "Could not check availability. Please try again.",
      );
    } finally {
      setLoadingRooms(false);
    }
  }

  async function handleDatesSubmit(draft: StayDraft) {
    setStay(draft);
    setStep(2);
    await loadAvailability(draft);
  }

  async function submitBooking() {
    if (!stay || !selectedRoom || !guest) return;
    setSubmitting(true);

    try {
      const { data, message } = await api.post<{ _id: string; reservationNumber: string }>(
        "/api/reservations",
        {
          checkInDate: stay.checkInDate,
          checkOutDate: stay.checkOutDate,
          room: selectedRoom._id,
          adults: stay.adults,
          children: stay.children,
          pricePerNight,
          taxPercent,
          discount,
          specialRequests: stay.specialRequests || undefined,
          source: stay.source || undefined,
          reservationStatus: payment.confirmNow ? "CONFIRMED" : "PENDING",
          preferredPaymentMethod: payment.method,
          ...(guest.kind === "existing"
            ? { guest: guest.guestId }
            : { newGuest: guest.newGuest }),
          ...(payment.takeDeposit && payment.amount > 0
            ? {
                initialPayment: {
                  amount: payment.amount,
                  method: payment.method,
                  transactionId: payment.transactionId || undefined,
                  notes: payment.notes || undefined,
                },
              }
            : {}),
        },
      );

      toast.success(message);
      router.push(`/reservations/${data._id}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
        // A booking conflict means the room went while this form was open, so
        // send the clerk back to pick another one from fresh availability.
        if (error.code === "BOOKING_CONFLICT") {
          setStep(2);
          await loadAvailability(stay);
        }
      } else {
        toast.error("Could not create the reservation.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Stepper current={step} onStepClick={(id) => id < step && setStep(id)} />

      <Card>
        <CardContent>
          {step === 1 && (
            <StepDates
              roomTypes={roomTypes}
              initial={stay}
              onSubmit={handleDatesSubmit}
            />
          )}

          {step === 2 && stay && (
            <StepRoom
              rooms={rooms}
              loading={loadingRooms}
              error={roomsError}
              nights={nights}
              currency={currency}
              locale={locale}
              selectedRoomId={selectedRoom?._id}
              onSelect={(room) => {
                setSelectedRoom(room);
                setRateOverride(null);
              }}
              onRetry={() => loadAvailability(stay)}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <StepGuest
              value={guest}
              onChange={setGuest}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}

          {step === 4 && stay && selectedRoom && guest && folio && (
            <StepSummary
              stay={stay}
              room={selectedRoom}
              guest={guest}
              folio={folio}
              pricePerNight={pricePerNight}
              discount={discount}
              taxPercent={taxPercent}
              currency={currency}
              locale={locale}
              checkInTime={checkInTime}
              checkOutTime={checkOutTime}
              onRateChange={setRateOverride}
              onDiscountChange={setDiscount}
              onBack={() => setStep(3)}
              onNext={() => setStep(5)}
            />
          )}

          {step === 5 && folio && (
            <StepPayment
              value={payment}
              onChange={setPayment}
              total={folio.totalAmount}
              currency={currency}
              locale={locale}
              submitting={submitting}
              onBack={() => setStep(4)}
              onSubmit={submitBooking}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stepper({
  current,
  onStepClick,
}: {
  current: number;
  onStepClick: (id: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((item, index) => {
        const done = item.id < current;
        const active = item.id === current;
        return (
          <li key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick(item.id)}
              disabled={!done}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-colors",
                done && "text-foreground hover:bg-muted",
                active && "font-medium text-foreground",
                !done && !active && "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : item.id}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

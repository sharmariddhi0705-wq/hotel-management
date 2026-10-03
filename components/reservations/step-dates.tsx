"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/shared/field-error";
import { nightsBetween } from "@/lib/dates";
import type { RoomTypeChoice } from "@/components/reservations/booking-wizard";

export interface StayDraft {
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  roomType?: string;
  specialRequests: string;
  source: string;
}

interface StepDatesProps {
  roomTypes: RoomTypeChoice[];
  initial: StayDraft | null;
  onSubmit: (draft: StayDraft) => void;
}

const SOURCES = [
  "Front Desk",
  "Phone",
  "Website",
  "OTA — Booking.com",
  "OTA — MakeMyTrip",
  "Corporate",
  "Walk-in",
];

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowInput(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

export function StepDates({ roomTypes, initial, onSubmit }: StepDatesProps) {
  const [draft, setDraft] = React.useState<StayDraft>(
    initial ?? {
      checkInDate: todayInput(),
      checkOutDate: tomorrowInput(),
      adults: 2,
      children: 0,
      roomType: undefined,
      specialRequests: "",
      source: "Front Desk",
    },
  );
  const [error, setError] = React.useState<string | null>(null);

  const nights = nightsBetween(draft.checkInDate || todayInput(), draft.checkOutDate || todayInput());

  function update<K extends keyof StayDraft>(key: K, value: StayDraft[K]) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };

      // Keep the departure date after the arrival date as the clerk types.
      if (key === "checkInDate" && next.checkOutDate <= next.checkInDate) {
        const nextDay = new Date(new Date(next.checkInDate).getTime() + 86_400_000);
        next.checkOutDate = nextDay.toISOString().slice(0, 10);
      }
      return next;
    });
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!draft.checkInDate || !draft.checkOutDate) {
      setError("Choose both an arrival and a departure date.");
      return;
    }
    if (draft.checkOutDate <= draft.checkInDate) {
      setError("The departure date must be after the arrival date.");
      return;
    }
    if (draft.adults < 1) {
      setError("At least one adult is required.");
      return;
    }
    onSubmit(draft);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="text-base font-semibold">Stay details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Availability is checked against these dates in the next step.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="checkInDate">Check-in date</Label>
          <Input
            id="checkInDate"
            type="date"
            value={draft.checkInDate}
            onChange={(event) => update("checkInDate", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkOutDate">Check-out date</Label>
          <Input
            id="checkOutDate"
            type="date"
            min={draft.checkInDate}
            value={draft.checkOutDate}
            onChange={(event) => update("checkOutDate", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adults">Adults</Label>
          <Input
            id="adults"
            type="number"
            min={1}
            max={20}
            value={draft.adults}
            onChange={(event) => update("adults", Number(event.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="children">Children</Label>
          <Input
            id="children"
            type="number"
            min={0}
            max={20}
            value={draft.children}
            onChange={(event) => update("children", Number(event.target.value))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="roomTypeFilter">Room type (optional)</Label>
          <Select
            value={draft.roomType ?? "any"}
            onValueChange={(value) => update("roomType", value === "any" ? undefined : value)}
          >
            <SelectTrigger id="roomTypeFilter" className="w-full">
              <SelectValue placeholder="Any room type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any room type</SelectItem>
              {roomTypes.map((type) => (
                <SelectItem key={type._id} value={type._id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source">Booking source</Label>
          <Select value={draft.source} onValueChange={(value) => update("source", value)}>
            <SelectTrigger id="source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="specialRequests">Special requests</Label>
        <Textarea
          id="specialRequests"
          rows={2}
          placeholder="High floor, away from the lift. Extra pillows."
          value={draft.specialRequests}
          onChange={(event) => update("specialRequests", event.target.value)}
        />
      </div>

      <FieldError message={error ?? undefined} />

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {nights > 0
            ? `${nights} night${nights === 1 ? "" : "s"}, ${draft.adults + draft.children} guest(s)`
            : "Choose valid dates to continue"}
        </p>
        <Button type="submit">
          Find rooms
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}

"use client";

import { ArrowLeft, ArrowRight, BedDouble, Check, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export interface AvailableRoom {
  _id: string;
  roomNumber: string;
  floor: number;
  pricePerNight: number;
  maxOccupancy: number;
  amenities: string[];
  description?: string;
  roomType?: { _id: string; name: string } | null;
}

interface StepRoomProps {
  rooms: AvailableRoom[];
  loading: boolean;
  error: string | null;
  nights: number;
  currency: string;
  locale: string;
  selectedRoomId?: string;
  onSelect: (room: AvailableRoom) => void;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepRoom({
  rooms,
  loading,
  error,
  nights,
  currency,
  locale,
  selectedRoomId,
  onSelect,
  onRetry,
  onBack,
  onNext,
}: StepRoomProps) {
  const money = { currency, locale };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Available rooms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only rooms free for the whole stay and large enough for the party are shown.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-xl border p-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-2 h-4 w-32" />
              <Skeleton className="mt-4 h-6 w-28" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="No rooms available"
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Change the dates
            </Button>
          }
        />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Nothing free for those dates"
          description="Try a shorter stay, different dates, or another room type."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const selected = room._id === selectedRoomId;
            const stayTotal = room.pricePerNight * Math.max(1, nights);

            return (
              <li key={room._id}>
                <button
                  type="button"
                  onClick={() => onSelect(room)}
                  aria-pressed={selected}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                      : "hover:border-muted-foreground/30 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold">
                        Room {room.roomNumber}
                        {selected && <Check className="size-4 text-primary" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {room.roomType?.name ?? "Unclassified"} · Floor {room.floor}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      <Users className="size-3" />
                      {room.maxOccupancy}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(room.pricePerNight, money)}
                      <span className="text-xs font-normal text-muted-foreground"> / night</span>
                    </p>
                    {nights > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(stayTotal, money)} for {nights} night
                        {nights === 1 ? "" : "s"}, before tax
                      </p>
                    )}
                  </div>

                  {room.amenities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {room.amenities.slice(0, 3).map((amenity) => (
                        <Badge key={amenity} variant="secondary">
                          {amenity}
                        </Badge>
                      ))}
                      {room.amenities.length > 3 && (
                        <Badge variant="outline">+{room.amenities.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!selectedRoomId}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

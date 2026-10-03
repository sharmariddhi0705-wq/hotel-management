"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Crown, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api, ApiClientError, qs } from "@/lib/api-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
import { phoneSchema } from "@/schemas/common";

interface GuestSearchResult {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  city?: string;
  country?: string;
  isVip: boolean;
  blacklisted: boolean;
  totalStays: number;
}

export type GuestChoice =
  | { kind: "existing"; guestId: string; display: string; phone: string }
  | {
      kind: "new";
      display: string;
      phone: string;
      newGuest: {
        firstName: string;
        lastName: string;
        phone: string;
        email?: string;
        city?: string;
        country?: string;
        nationality?: string;
      };
    };

interface StepGuestProps {
  value: GuestChoice | null;
  onChange: (choice: GuestChoice | null) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Step 3: attach an existing guest profile, or capture a new one.
 *
 * The new guest is *not* created here — it travels with the reservation payload
 * so the profile and the booking are written in the same request, and a failed
 * booking does not leave an orphaned guest behind.
 */
export function StepGuest({ value, onChange, onBack, onNext }: StepGuestProps) {
  const [mode, setMode] = React.useState<"existing" | "new">(
    value?.kind === "new" ? "new" : "existing",
  );

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [results, setResults] = React.useState<GuestSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState({
    firstName: value?.kind === "new" ? value.newGuest.firstName : "",
    lastName: value?.kind === "new" ? value.newGuest.lastName : "",
    phone: value?.kind === "new" ? value.newGuest.phone : "",
    email: value?.kind === "new" ? (value.newGuest.email ?? "") : "",
    city: value?.kind === "new" ? (value.newGuest.city ?? "") : "",
    country: value?.kind === "new" ? (value.newGuest.country ?? "") : "",
    nationality: value?.kind === "new" ? (value.newGuest.nationality ?? "") : "",
  });
  const [draftError, setDraftError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode !== "existing") return;

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    api
      .get<GuestSearchResult[]>(`/api/guests${qs({ search: debouncedSearch, limit: 8 })}`)
      .then(({ data }) => {
        if (!cancelled) setResults(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setResults([]);
        setSearchError(
          error instanceof ApiClientError ? error.message : "Could not search guests.",
        );
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, mode]);

  function chooseExisting(guest: GuestSearchResult) {
    onChange({
      kind: "existing",
      guestId: guest._id,
      display: `${guest.firstName} ${guest.lastName}`,
      phone: guest.phone,
    });
  }

  function commitNewGuest(): boolean {
    if (draft.firstName.trim().length < 1 || draft.lastName.trim().length < 1) {
      setDraftError("Enter both a first and a last name.");
      return false;
    }
    if (!phoneSchema.safeParse(draft.phone).success) {
      setDraftError("Enter a valid phone number.");
      return false;
    }

    onChange({
      kind: "new",
      display: `${draft.firstName.trim()} ${draft.lastName.trim()}`,
      phone: draft.phone.trim(),
      newGuest: {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim() || undefined,
        city: draft.city.trim() || undefined,
        country: draft.country.trim() || undefined,
        nationality: draft.nationality.trim() || undefined,
      },
    });
    setDraftError(null);
    return true;
  }

  function handleNext() {
    if (mode === "new") {
      if (!commitNewGuest()) return;
    } else if (!value || value.kind !== "existing") {
      setSearchError("Select a guest, or switch to adding a new one.");
      return;
    }
    onNext();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Guest</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search for a returning guest, or capture a new profile.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "existing" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("existing");
            if (value?.kind === "new") onChange(null);
          }}
        >
          <Search className="size-4" />
          Existing guest
        </Button>
        <Button
          type="button"
          variant={mode === "new" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("new");
            if (value?.kind === "existing") onChange(null);
          }}
        >
          <UserPlus className="size-4" />
          New guest
        </Button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, phone or email…"
              className="pl-8"
              aria-label="Search guests"
            />
          </div>

          {searching ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="No matching guests"
              description="Switch to “New guest” to capture their details."
            />
          ) : (
            <ul className="space-y-2">
              {results.map((guest) => {
                const selected = value?.kind === "existing" && value.guestId === guest._id;
                return (
                  <li key={guest._id}>
                    <button
                      type="button"
                      onClick={() => chooseExisting(guest)}
                      disabled={guest.blacklisted}
                      aria-pressed={selected}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                          : "hover:bg-muted/50",
                        guest.blacklisted && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          {guest.firstName} {guest.lastName}
                          {guest.isVip && (
                            <Crown className="size-3.5 text-amber-500" aria-label="VIP" />
                          )}
                          {guest.blacklisted && (
                            <Badge variant="destructive">Blacklisted</Badge>
                          )}
                          {selected && <Check className="size-4 text-primary" />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {guest.phone}
                          {guest.email ? ` · ${guest.email}` : ""}
                          {guest.city || guest.country
                            ? ` · ${[guest.city, guest.country].filter(Boolean).join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {guest.totalStays} stay{guest.totalStays === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <FieldError message={searchError ?? undefined} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="newFirstName">First name</Label>
            <Input
              id="newFirstName"
              value={draft.firstName}
              onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newLastName">Last name</Label>
            <Input
              id="newLastName"
              value={draft.lastName}
              onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPhone">Phone</Label>
            <Input
              id="newPhone"
              placeholder="+91 98765 43210"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newEmail">Email (optional)</Label>
            <Input
              id="newEmail"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newCity">City</Label>
            <Input
              id="newCity"
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newCountry">Country</Label>
            <Input
              id="newCountry"
              value={draft.country}
              onChange={(event) => setDraft({ ...draft, country: event.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="newNationality">Nationality</Label>
            <Input
              id="newNationality"
              value={draft.nationality}
              onChange={(event) => setDraft({ ...draft, nationality: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldError message={draftError ?? undefined} />
            <p className="text-xs text-muted-foreground">
              The profile is created together with the reservation. Identification is
              recorded at check-in.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={handleNext}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

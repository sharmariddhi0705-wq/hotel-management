/**
 * Date helpers for stay arithmetic.
 *
 * A hotel night is a *calendar* concept, not a 24-hour span: a guest arriving
 * 10 Oct 14:00 and leaving 13 Oct 11:00 has stayed 3 nights. We therefore
 * normalise every stay boundary to UTC midnight and count whole days between
 * them. Storing midnight-UTC also makes the overlap query below exact.
 */

const MS_PER_DAY = 86_400_000;

/** Strips the time component, anchoring the date at 00:00:00.000 UTC. */
export function startOfUtcDay(value: Date | string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${String(value)}`);
  }
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export function endOfUtcDay(value: Date | string): Date {
  const d = startOfUtcDay(value);
  return new Date(d.getTime() + MS_PER_DAY - 1);
}

export function addDays(value: Date | string, days: number): Date {
  return new Date(new Date(value).getTime() + days * MS_PER_DAY);
}

/** Whole nights between two stay boundaries. Always >= 0. */
export function nightsBetween(checkIn: Date | string, checkOut: Date | string): number {
  const a = startOfUtcDay(checkIn).getTime();
  const b = startOfUtcDay(checkOut).getTime();
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

/**
 * Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd).
 *
 * Half-open is what makes same-day turnover legal — a stay ending 15 Oct does
 * not collide with one starting 15 Oct, because 15 Oct belongs only to the
 * arriving guest.
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function todayUtc(): Date {
  return startOfUtcDay(new Date());
}

/** Inclusive list of UTC day boundaries between two dates. */
export function eachUtcDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfUtcDay(from);
  const last = startOfUtcDay(to);
  while (cursor <= last) {
    days.push(cursor);
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return days;
}

export function isoDay(value: Date | string): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

/** Start of the month containing `value`, at UTC midnight. */
export function startOfUtcMonth(value: Date | string): Date {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function startOfUtcWeek(value: Date | string): Date {
  const d = startOfUtcDay(value);
  // Monday-based week.
  const weekday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - weekday * MS_PER_DAY);
}

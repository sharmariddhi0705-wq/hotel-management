import mongoose, { Schema, type Model } from "mongoose";

/**
 * Atomic sequence generator for human-readable document numbers.
 *
 * `findOneAndUpdate` with `$inc` is a single atomic MongoDB operation, so two
 * concurrent reservations can never be handed the same number — which a
 * "count documents + 1" approach would happily do under load.
 */
export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter: Model<ICounter> =
  (mongoose.models.Counter as Model<ICounter>) ||
  mongoose.model<ICounter>("Counter", CounterSchema);

/** Returns the next value in the named sequence, creating it on first use. */
export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return doc?.seq ?? 1;
}

/**
 * Builds a prefixed, year-scoped, zero-padded document number,
 * e.g. `RSV-2026-000148`.
 */
export async function nextFormattedNumber(
  prefix: string,
  opts: { pad?: number; scopeToYear?: boolean } = {},
): Promise<string> {
  const { pad = 6, scopeToYear = true } = opts;
  const year = new Date().getUTCFullYear();
  const key = scopeToYear ? `${prefix}-${year}` : prefix;
  const seq = await nextSequence(key);
  const padded = String(seq).padStart(pad, "0");
  return scopeToYear ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;
}

export default Counter;

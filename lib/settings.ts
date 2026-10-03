import { connectToDatabase } from "@/lib/mongodb";
import { HotelSettings, type IHotelSettings } from "@/models";

export type PublicHotelSettings = Omit<IHotelSettings, "_id"> & { _id: string };

/**
 * Reads the singleton settings document, creating it with defaults on first
 * call. Upsert-on-read means a fresh database (or one seeded without settings)
 * never leaves invoices and tax calculations without a configuration.
 */
export async function getHotelSettings(): Promise<PublicHotelSettings> {
  await connectToDatabase();
  const doc = await HotelSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return JSON.parse(JSON.stringify(doc)) as PublicHotelSettings;
}

/** Tax rate to apply to new folios. */
export async function getTaxPercent(): Promise<number> {
  const settings = await getHotelSettings();
  return settings.taxPercent ?? 0;
}

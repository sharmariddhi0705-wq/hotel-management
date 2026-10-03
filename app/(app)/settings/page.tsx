import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import type { HotelSettingsInput } from "@/schemas/settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePermission("settings:view");
  const settings = await getHotelSettings();

  // Only the configurable fields reach the form; ids and timestamps stay behind.
  const values: HotelSettingsInput = {
    hotelName: settings.hotelName,
    legalName: settings.legalName,
    tagline: settings.tagline,
    address: settings.address,
    city: settings.city,
    state: settings.state,
    country: settings.country,
    postalCode: settings.postalCode,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    taxId: settings.taxId,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    locale: settings.locale,
    timezone: settings.timezone,
    taxPercent: settings.taxPercent,
    checkInTime: settings.checkInTime,
    checkOutTime: settings.checkOutTime,
    cancellationPolicy: settings.cancellationPolicy,
    invoicePrefix: settings.invoicePrefix,
    invoiceFooter: settings.invoiceFooter,
    logoUrl: settings.logoUrl,
  };

  return (
    <>
      <PageHeader
        title="Hotel settings"
        description="Property details, currency and the tax rate applied to new bookings."
      />
      <SettingsForm values={values} canManage={can(user.role, "settings:manage")} />
    </>
  );
}

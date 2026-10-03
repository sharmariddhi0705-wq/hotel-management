import type { Metadata } from "next";
import {
  BedDouble,
  BrushCleaning,
  CalendarCheck,
  CalendarX,
  CircleDollarSign,
  DoorOpen,
  Percent,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { BookingsChart, RevenueChart } from "@/components/dashboard/revenue-chart";
import { OccupancyChart, RoomStatusChart } from "@/components/dashboard/occupancy-chart";
import {
  RecentMovementsCard,
  RecentPaymentsCard,
  RecentReservationsCard,
} from "@/components/dashboard/activity-feed";
import { getDashboardData } from "@/lib/dashboard";
import { getHotelSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { connectToDatabase } from "@/lib/mongodb";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Live operational figures, so this page is never cached.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() { 
  const user = await requirePermission("dashboard:view");
  await connectToDatabase();

  const [data, settings] = await Promise.all([getDashboardData(), getHotelSettings()]);
  const { stats } = data;
  const money = { currency: settings.currency, locale: settings.locale };

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(" ")[0]}`}
        description={`Live position at ${settings.hotelName}.`}
        actions={<QuickActions role={user.role} />}
      />

      <section
        aria-label="Key figures"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Total rooms"
          value={formatNumber(stats.totalRooms, settings.locale)}
          icon={BedDouble}
          hint={`${stats.outOfServiceRooms} out of service`}
        />
        <StatCard
          label="Available"
          value={formatNumber(stats.availableRooms, settings.locale)}
          icon={DoorOpen}
          tone="positive"
          hint="Ready to sell now"
        />
        <StatCard
          label="Occupied"
          value={formatNumber(stats.occupiedRooms, settings.locale)}
          icon={Users}
          tone="info"
          hint={`${stats.inHouseGuests} reservations in house`}
        />
        <StatCard
          label="Reserved"
          value={formatNumber(stats.reservedRooms, settings.locale)}
          icon={CalendarCheck}
          tone="info"
          hint="Held for future arrivals"
        />

        <StatCard
          label="Occupancy rate"
          value={formatPercent(stats.occupancyRate)}
          icon={Percent}
          tone={stats.occupancyRate >= 70 ? "positive" : "warning"}
          hint="Rooms occupied right now"
        />
        <StatCard
          label="Today's check-ins"
          value={formatNumber(stats.todaysCheckIns, settings.locale)}
          icon={CalendarCheck}
          tone="positive"
          hint={`${stats.pendingArrivals} arrival(s) still expected`}
        />
        <StatCard
          label="Today's check-outs"
          value={formatNumber(stats.todaysCheckOuts, settings.locale)}
          icon={CalendarX}
          tone="warning"
          hint={`${stats.pendingDepartures} departure(s) still due`}
        />
        <StatCard
          label="Cleaning queue"
          value={formatNumber(stats.openHousekeepingTasks, settings.locale)}
          icon={BrushCleaning}
          tone={stats.openHousekeepingTasks > 0 ? "warning" : "positive"}
          hint={`${stats.cleaningRooms} room(s) being turned over`}
        />

        <StatCard
          label="Today's revenue"
          value={formatCurrency(stats.todaysRevenue, money)}
          icon={CircleDollarSign}
          tone="positive"
          hint="Payments received less refunds"
        />
        <StatCard
          label="Revenue this month"
          value={formatCurrency(stats.monthlyRevenue, money)}
          icon={TrendingUp}
          tone="positive"
          hint="Month to date"
        />
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(stats.outstandingBalance, money)}
          icon={Wallet}
          tone={stats.outstandingBalance > 0 ? "critical" : "positive"}
          hint="Across all open folios"
        />
        <StatCard
          label="Guest profiles"
          value={formatNumber(stats.totalGuests, settings.locale)}
          icon={Users}
          hint="On record"
        />
      </section>

      <section aria-label="Trends" className="mt-5 grid gap-4 xl:grid-cols-2">
        <RevenueChart
          data={data.revenueTrend}
          currency={settings.currency}
          locale={settings.locale}
        />
        <OccupancyChart data={data.occupancyTrend} />
        <BookingsChart data={data.revenueTrend} />
        <RoomStatusChart data={data.roomStatusBreakdown} />
      </section>

      <section aria-label="Recent activity" className="mt-4 grid gap-4 xl:grid-cols-2">
        <RecentReservationsCard
          reservations={data.recentReservations}
          currency={settings.currency}
          locale={settings.locale}
        />
        <RecentPaymentsCard
          payments={data.recentPayments}
          currency={settings.currency}
          locale={settings.locale}
        />
        <RecentMovementsCard
          title="Recent check-ins"
          description="Guests who have arrived."
          movements={data.recentCheckIns}
          kind="in"
        />
        <RecentMovementsCard
          title="Recent check-outs"
          description="Stays that have closed."
          movements={data.recentCheckOuts}
          kind="out"
        />
      </section>
    </>
  );
}

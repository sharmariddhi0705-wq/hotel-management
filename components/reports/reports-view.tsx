"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import { label } from "@/lib/constants";
import {
  BedDouble,
  CircleDollarSign,
  Percent,
  Receipt,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import type {
  GuestReport,
  OccupancyReport,
  ReservationReport,
  RevenueReport,
} from "@/lib/reports";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const TYPES = [
  { value: "revenue", label: "Revenue" },
  { value: "occupancy", label: "Occupancy" },
  { value: "reservations", label: "Reservations" },
  { value: "guests", label: "Guests" },
];

interface ReportsViewProps {
  type: string;
  preset: string;
  from?: string;
  to?: string;
  currency: string;
  locale: string;
  revenue?: RevenueReport;
  occupancy?: OccupancyReport;
  reservations?: ReservationReport;
  guests?: GuestReport;
}

/**
 * Report workspace.
 *
 * The report type and date window live in the URL, so a report is shareable and
 * the CSV export can reuse exactly the same query string — export and screen can
 * never disagree.
 */
export function ReportsView(props: ReportsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const money = { currency: props.currency, locale: props.locale };

  const setParam = React.useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const exportHref = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");
    if (!params.get("type")) params.set("type", props.type);
    return `/api/reports?${params.toString()}`;
  }, [searchParams, props.type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={props.type} onValueChange={(value) => setParam({ type: value })}>
          <TabsList>
            {TYPES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="reportPreset" className="text-xs">
              Period
            </Label>
            <Select
              value={props.preset}
              onValueChange={(value) =>
                setParam({
                  preset: value,
                  ...(value === "custom" ? {} : { from: undefined, to: undefined }),
                })
              }
            >
              <SelectTrigger id="reportPreset" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {props.preset === "custom" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="reportFrom" className="text-xs">
                  From
                </Label>
                <Input
                  id="reportFrom"
                  type="date"
                  className="w-40"
                  value={props.from ?? ""}
                  onChange={(event) => setParam({ from: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reportTo" className="text-xs">
                  To
                </Label>
                <Input
                  id="reportTo"
                  type="date"
                  className="w-40"
                  value={props.to ?? ""}
                  onChange={(event) => setParam({ to: event.target.value })}
                />
              </div>
            </>
          )}

          <Button variant="outline" size="sm" asChild>
            <a href={exportHref} download>
              <Download className="size-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {props.type === "revenue" && props.revenue && (
        <RevenuePanel report={props.revenue} money={money} />
      )}
      {props.type === "occupancy" && props.occupancy && (
        <OccupancyPanel report={props.occupancy} money={money} />
      )}
      {props.type === "reservations" && props.reservations && (
        <ReservationPanel report={props.reservations} money={money} />
      )}
      {props.type === "guests" && props.guests && (
        <GuestPanel report={props.guests} money={money} />
      )}
    </div>
  );
}

type Money = { currency: string; locale: string };

function RevenuePanel({ report, money }: { report: RevenueReport; money: Money }) {
  const config = {
    revenue: { label: "Net revenue", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={formatCurrency(report.netRevenue, money)}
          icon={CircleDollarSign}
          tone="positive"
          hint={`${report.transactions} transaction(s)`}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(report.totalCollected, money)}
          icon={Wallet}
          hint={`${formatCurrency(report.totalRefunded, money)} refunded`}
        />
        <StatCard
          label="Average daily rate"
          value={formatCurrency(report.averageDailyRate, money)}
          icon={TrendingUp}
          hint="Per room night sold"
        />
        <StatCard
          label="RevPAR"
          value={formatCurrency(report.revenuePerAvailableRoom, money)}
          icon={Percent}
          hint="Revenue per available room"
        />
        <StatCard
          label="Room revenue"
          value={formatCurrency(report.roomRevenue, money)}
          icon={BedDouble}
        />
        <StatCard
          label="Extras"
          value={formatCurrency(report.extrasRevenue, money)}
          icon={Receipt}
        />
        <StatCard
          label="Tax collected"
          value={formatCurrency(report.taxCollected, money)}
          icon={Receipt}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(report.outstanding, money)}
          icon={Wallet}
          tone={report.outstanding > 0 ? "critical" : "positive"}
        />
      </section>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">Daily net revenue</CardTitle>
          <CardDescription>{report.range.label}</CardDescription>
        </CardHeader>
        <CardContent>
          {report.byDay.length === 0 ? (
            <EmptyState title="No payments in this period" />
          ) : (
            <ChartContainer config={config} className="h-64 w-full">
              <BarChart data={report.byDay} margin={{ left: 4, right: 8, top: 6, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  fontSize={11}
                  tickFormatter={(value: number) => formatCompactCurrency(value, money)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(Number(value), money)}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="text-base">By payment method</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {report.byMethod.length === 0 ? (
            <EmptyState title="No payments in this period" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byMethod.map((row) => (
                  <TableRow key={row.method}>
                    <TableCell>{label(row.method)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.amount, money)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function OccupancyPanel({ report, money }: { report: OccupancyReport; money: Money }) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total rooms" value={report.totalRooms} icon={BedDouble} />
        <StatCard label="Occupied" value={report.occupied} icon={UsersRound} tone="info" />
        <StatCard label="Available" value={report.available} icon={BedDouble} tone="positive" />
        <StatCard label="Reserved" value={report.reserved} icon={BedDouble} tone="info" />
        <StatCard label="Cleaning" value={report.cleaning} icon={BedDouble} tone="warning" />
        <StatCard
          label="Out of service"
          value={report.outOfService}
          icon={BedDouble}
          tone={report.outOfService > 0 ? "critical" : "positive"}
        />
        <StatCard
          label="Occupancy now"
          value={formatPercent(report.occupancyRate)}
          icon={Percent}
          tone={report.occupancyRate >= 70 ? "positive" : "warning"}
        />
        <StatCard
          label="Occupancy for period"
          value={formatPercent(report.periodOccupancyRate)}
          icon={Percent}
          hint={`${report.roomNightsSold} of ${report.roomNightsAvailable} room nights`}
        />
      </section>

      <Card className="gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="text-base">By room type</CardTitle>
          <CardDescription>{report.range.label}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {report.byRoomType.length === 0 ? (
            <EmptyState title="No stays in this period" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room type</TableHead>
                  <TableHead className="text-right">Rooms</TableHead>
                  <TableHead className="text-right">Nights sold</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">Room revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byRoomType.map((row) => (
                  <TableRow key={row.roomType}>
                    <TableCell className="font-medium">{row.roomType}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.rooms}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.nightsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(row.occupancyRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.revenue, money)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const STATUS_COLOURS: Record<string, string> = {
  PENDING: "oklch(0.769 0.188 70.08)",
  CONFIRMED: "oklch(0.685 0.169 237.32)",
  CHECKED_IN: "oklch(0.696 0.17 162.48)",
  CHECKED_OUT: "oklch(0.554 0.046 257.42)",
  CANCELLED: "oklch(0.645 0.246 16.44)",
  NO_SHOW: "oklch(0.577 0.245 27.325)",
};

function ReservationPanel({ report, money }: { report: ReservationReport; money: Money }) {
  const data = report.byStatus.map((row) => ({
    ...row,
    name: label(row.status),
    fill: STATUS_COLOURS[row.status] ?? "var(--chart-1)",
  }));

  const config: ChartConfig = Object.fromEntries(
    data.map((row) => [row.status, { label: row.name, color: row.fill }]),
  );

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total booked" value={report.total} icon={Receipt} />
        <StatCard label="Confirmed" value={report.confirmed} icon={Receipt} tone="info" />
        <StatCard label="Pending" value={report.pending} icon={Receipt} tone="warning" />
        <StatCard label="Checked in" value={report.checkedIn} icon={Receipt} tone="positive" />
        <StatCard label="Checked out" value={report.checkedOut} icon={Receipt} />
        <StatCard label="Cancelled" value={report.cancelled} icon={Receipt} tone="critical" />
        <StatCard label="No-shows" value={report.noShow} icon={Receipt} tone="critical" />
        <StatCard
          label="Cancellation rate"
          value={formatPercent(report.cancellationRate)}
          icon={Percent}
          tone={report.cancellationRate > 15 ? "critical" : "positive"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Status mix</CardTitle>
            <CardDescription>{report.range.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.length === 0 ? (
              <EmptyState title="No reservations booked in this period" />
            ) : (
              <ChartContainer config={config} className="h-56 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={data} dataKey="count" nameKey="name" innerRadius={48} strokeWidth={0}>
                    {data.map((row) => (
                      <Cell key={row.status} fill={row.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle className="text-base">By source</CardTitle>
            <CardDescription>
              Average booking value {formatCurrency(report.averageBookingValue, money)} ·
              average stay {report.averageStayLength} night(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {report.bySource.length === 0 ? (
              <EmptyState title="No reservations in this period" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.bySource.map((row) => (
                    <TableRow key={row.source}>
                      <TableCell>{row.source}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.value, money)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function GuestPanel({ report, money }: { report: GuestReport; money: Money }) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New guests"
          value={report.newGuests}
          icon={UsersRound}
          tone="positive"
          hint={report.range.label}
        />
        <StatCard label="Total profiles" value={report.totalGuests} icon={UsersRound} />
        <StatCard
          label="Returning guests"
          value={report.returningGuests}
          icon={UsersRound}
          tone="info"
          hint="More than one completed stay"
        />
        <StatCard
          label="Average spend"
          value={formatCurrency(report.averageSpend, money)}
          icon={CircleDollarSign}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-3 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle className="text-base">By nationality</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {report.byNationality.length === 0 ? (
              <EmptyState title="No guest profiles yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nationality</TableHead>
                    <TableHead className="text-right">Guests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byNationality.map((row) => (
                    <TableRow key={row.nationality}>
                      <TableCell>{row.nationality}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle className="text-base">Top guests by spend</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {report.topGuests.length === 0 ? (
              <EmptyState title="No completed stays yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead className="text-right">Stays</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topGuests.map((guest) => (
                    <TableRow key={guest._id}>
                      <TableCell>
                        {guest.firstName} {guest.lastName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {guest.totalStays}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(guest.totalSpend, money)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

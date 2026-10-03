"use client";

import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { label } from "@/lib/constants";
import { EmptyState } from "@/components/shared/empty-state";
import { BedDouble } from "lucide-react";

const occupancyConfig = {
  occupancy: { label: "Occupancy", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function OccupancyChart({
  data,
}: {
  data: { date: string; label: string; occupancy: number }[];
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Occupancy rate</CardTitle>
        <CardDescription>Share of rooms sold each night, last 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={occupancyConfig} className="h-56 w-full">
          <LineChart data={data} margin={{ left: 4, right: 8, top: 6, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={38}
              domain={[0, 100]}
              fontSize={11}
              tickFormatter={(value: number) => `${value}%`}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)}%`} />}
            />
            <Line
              dataKey="occupancy"
              type="monotone"
              stroke="var(--color-occupancy)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Room status mix.
 *
 * Colours are literal so they match the status badges exactly. Tailwind v4 only
 * emits palette variables that stylesheets actually reference, so `var(--color-
 * emerald-500)` cannot be relied on from inside a chart prop.
 */
const STATUS_COLOURS: Record<string, string> = {
  AVAILABLE: "oklch(0.696 0.17 162.48)",
  OCCUPIED: "oklch(0.685 0.169 237.32)",
  RESERVED: "oklch(0.606 0.25 292.72)",
  CLEANING: "oklch(0.769 0.188 70.08)",
  MAINTENANCE: "oklch(0.705 0.213 47.6)",
  OUT_OF_SERVICE: "oklch(0.645 0.246 16.44)",
};

export function RoomStatusChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const chartData = data.map((row) => ({
    ...row,
    name: label(row.status),
    fill: STATUS_COLOURS[row.status] ?? "var(--color-chart-1)",
  }));

  const config: ChartConfig = Object.fromEntries(
    chartData.map((row) => [row.status, { label: row.name, color: row.fill }]),
  );

  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Room status</CardTitle>
        <CardDescription>How the {total} active rooms are doing right now.</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="No rooms yet"
            description="Add rooms to see the status board."
          />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ChartContainer config={config} className="h-44 w-44 shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((row) => (
                    <Cell key={row.status} fill={row.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="grid w-full flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
              {chartData.map((row) => (
                <li key={row.status} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                    aria-hidden
                  />
                  <span className="truncate text-muted-foreground">{row.name}</span>
                  <span className="ml-auto font-medium tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

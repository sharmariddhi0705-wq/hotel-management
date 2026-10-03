"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;
  reservations: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
  currency: string;
  locale: string;
}

const revenueConfig = {
  revenue: { label: "Net revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

const bookingConfig = {
  reservations: { label: "Reservations", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RevenueChart({ data, currency, locale }: RevenueChartProps) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Revenue, last 14 days</CardTitle>
        <CardDescription>Payments received less refunds, per day.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueConfig} className="h-56 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              width={58}
              fontSize={11}
              tickFormatter={(value: number) =>
                formatCompactCurrency(value, { currency, locale })
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(Number(value), { currency, locale })}
                />
              }
            />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function BookingsChart({ data }: { data: RevenuePoint[] }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Reservations booked</CardTitle>
        <CardDescription>New bookings created per day.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={bookingConfig} className="h-56 w-full">
          <BarChart data={data} margin={{ left: 4, right: 8, top: 6, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              fontSize={11}
            />
            <YAxis tickLine={false} axisLine={false} width={28} fontSize={11} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="reservations" fill="var(--color-reservations)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

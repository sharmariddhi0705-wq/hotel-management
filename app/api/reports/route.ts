import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { reportQuerySchema } from "@/schemas/report";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";
import { searchParamsToObject } from "@/lib/query";
import {
  getGuestReport,
  getOccupancyReport,
  getReservationReport,
  getRevenueReport,
  resolveRange,
} from "@/lib/reports";
import { csvResponse, toCsv } from "@/lib/csv";
import { label } from "@/lib/constants";

/**
 * Reporting endpoint.
 *
 * `type` selects the report, `preset`/`from`/`to` the window, and `format=csv`
 * streams the same figures as a download instead of JSON — so the export can
 * never disagree with what is on screen.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("reports:view");
    const query = reportQuerySchema.parse(searchParamsToObject(request));

    await connectToDatabase();
    const range = resolveRange(query);

    switch (query.type) {
      case "occupancy": {
        const report = await getOccupancyReport(range);
        if (query.format === "csv") {
          return csvResponse(
            toCsv(report.byRoomType, [
              { header: "Room type", value: (r) => r.roomType },
              { header: "Rooms", value: (r) => r.rooms },
              { header: "Room nights sold", value: (r) => r.nightsSold },
              { header: "Occupancy %", value: (r) => r.occupancyRate },
              { header: "Room revenue", value: (r) => r.revenue },
            ]),
            `occupancy-report-${isoStamp(range.from)}.csv`,
          );
        }
        return ok(report, "Occupancy report ready");
      }

      case "reservations": {
        const report = await getReservationReport(range);
        if (query.format === "csv") {
          return csvResponse(
            toCsv(report.byStatus, [
              { header: "Status", value: (r) => label(r.status) },
              { header: "Reservations", value: (r) => r.count },
            ]),
            `reservation-report-${isoStamp(range.from)}.csv`,
          );
        }
        return ok(report, "Reservation report ready");
      }

      case "guests": {
        const report = await getGuestReport(range);
        if (query.format === "csv") {
          return csvResponse(
            toCsv(report.topGuests, [
              { header: "Guest", value: (g) => `${g.firstName} ${g.lastName}` },
              { header: "Stays", value: (g) => g.totalStays },
              { header: "Total spend", value: (g) => g.totalSpend },
            ]),
            `guest-report-${isoStamp(range.from)}.csv`,
          );
        }
        return ok(report, "Guest report ready");
      }

      case "revenue":
      default: {
        const report = await getRevenueReport(range);
        if (query.format === "csv") {
          return csvResponse(
            toCsv(report.byDay, [
              { header: "Date", value: (r) => r.date },
              { header: "Net revenue", value: (r) => r.revenue },
            ]),
            `revenue-report-${isoStamp(range.from)}.csv`,
          );
        }
        return ok(report, "Revenue report ready");
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function isoStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

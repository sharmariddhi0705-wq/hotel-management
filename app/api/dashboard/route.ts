import { connectToDatabase } from "@/lib/mongodb";
import { getDashboardData } from "@/lib/dashboard";
import { requirePermission } from "@/lib/session";
import { handleApiError, ok } from "@/lib/api-response";

/** JSON view of the dashboard, for client-side refresh. */
export async function GET() {
  try {
    await requirePermission("dashboard:view");
    await connectToDatabase();
    const data = await getDashboardData();
    return ok(data, "Dashboard loaded");
  } catch (error) {
    return handleApiError(error);
  }
}

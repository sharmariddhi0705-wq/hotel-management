import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { landingPageForRole } from "@/lib/permissions";

/**
 * Entry point. Sends signed-in staff to the first page their role can use, and
 * everyone else to the sign-in screen.
 */
export default async function RootPage() {
  const session = await auth();
  if (session?.user?.role) {
    redirect(landingPageForRole(session.user.role));
  }
  redirect("/login");
}

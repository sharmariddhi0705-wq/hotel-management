import { Info } from "lucide-react";

const ACCOUNTS = [
  { role: "Admin", email: "admin@hotel.com", password: "Admin@123" },
  { role: "Manager", email: "manager@hotel.com", password: "Manager@123" },
  { role: "Receptionist", email: "reception@hotel.com", password: "Reception@123" },
  { role: "Housekeeping", email: "housekeeping@hotel.com", password: "House@123" },
];

/**
 * Seeded demo logins.
 *
 * Only rendered outside production so a real deployment never advertises
 * credentials, even if the database was seeded by mistake.
 */
export function DemoCredentials() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="mt-8 rounded-lg border border-dashed p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Info className="size-3.5" />
        Demo accounts (development only — created by <code className="font-mono">npm run seed</code>)
      </p>
      <ul className="mt-2.5 space-y-1">
        {ACCOUNTS.map((account) => (
          <li
            key={account.email}
            className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground"
          >
            <span className="w-20 shrink-0 font-medium text-foreground">{account.role}</span>
            <code className="font-mono">{account.email}</code>
            <code className="font-mono">{account.password}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

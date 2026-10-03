# Hotel Management System — working notes

Next.js 15 (App Router) + TypeScript + MongoDB/Mongoose + Auth.js v5 + Tailwind v4 + shadcn/ui.

## Conventions

- **Status values** live in `lib/constants.ts`. Mongoose enums, Zod schemas and UI
  labels all derive from those arrays — add a value there, not in three places.
- **Stay dates** are stored at UTC midnight (`lib/dates.ts`). Format them with
  `timeZone: "UTC"` (`formatStayDate`), never local time, or dates shift by a day.
- **Money** goes through `lib/pricing.ts`. `recalculateReservationTotals`
  (`lib/folio.ts`) is the only writer of a reservation's money fields; call it
  after anything that can change a bill.
- **Availability**: `lib/availability.ts` owns the half-open interval overlap
  check. Never hand-roll a date comparison for booking conflicts.
- **Reads** shared by pages and API routes live in `lib/data.ts` so a filter is
  defined once.
- **Authorisation** is server-side: `requirePermission()` from `lib/session.ts` in
  every route handler. `lib/permissions.ts` is the single permission map; the
  sidebar and middleware both read it. Never trust a role from a request body.
- **API responses** always use the `ok()` / `created()` / `handleApiError()`
  helpers in `lib/api-response.ts`.
- Keep pages server components; push interactivity into small client components.

## Commands

```bash
npm run dev        # dev server
npm run seed       # reset + seed demo data
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

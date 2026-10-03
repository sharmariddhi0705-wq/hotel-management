# Azure Bay PMS — Hotel Management System

A working Property Management System for a hotel front desk: reservations with
double-booking prevention, check-in and check-out, guest folios, automatic
invoicing, housekeeping, staff, reporting and role-based access.

Built with Next.js 15 (App Router), TypeScript, MongoDB/Mongoose, Auth.js v5,
Tailwind CSS v4 and shadcn/ui.

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [MongoDB setup](#mongodb-setup)
- [Seed data and demo credentials](#seed-data-and-demo-credentials)
- [Commands](#commands)
- [Architecture](#architecture)
- [Authentication and authorisation](#authentication-and-authorisation)
- [Business rules](#business-rules)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Notes and known limitations](#notes-and-known-limitations)

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then set MONGODB_URI and AUTH_SECRET
npm run seed
npm run dev
```

Open <http://localhost:3000> and sign in with one of the
[demo accounts](#seed-data-and-demo-credentials).

**No MongoDB installed?** Start a disposable in-memory one in a second terminal:

```bash
npm run dev:db
```

It writes its connection string into `.env.local` for you. Data lives in memory
and is lost when you stop it, so use a real MongoDB for anything you want to keep.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | Connection string, e.g. `mongodb://127.0.0.1:27017/hotel-management` or an Atlas `mongodb+srv://…` URI. |
| `AUTH_SECRET` | yes | Secret used to sign session cookies. Generate with `npx auth secret` or `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | yes in production | The site's public URL, e.g. `https://pms.example.com`. Used to build password-reset links. |
| `ALLOW_PUBLIC_REGISTRATION` | no | `false` disables `/register` so only an admin can create accounts. Defaults to open. |

`.env.local` is gitignored; `.env.example` is committed as the template.

---

## MongoDB setup

### Local

Install MongoDB Community Edition, then:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/hotel-management
```

### MongoDB Atlas

1. Create a free cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → allow your IP, or `0.0.0.0/0` for a hosted deployment.
4. **Connect** → *Drivers* → copy the connection string and add the database name:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hotel-management?retryWrites=true&w=majority
```

URL-encode any special characters in the password (`@` → `%40`).

The connection is cached on `globalThis` (`lib/mongodb.ts`) so Next.js hot reloads
do not open a new pool on every change. Indexes are declared on the schemas and
created by Mongoose on first connect.

---

## Seed data and demo credentials

```bash
npm run seed
```

This **clears and repopulates** the collections it owns, then creates a
believable property: 6 room types, 30 rooms across 5 floors, 12 staff, 18 guests,
several hundred reservations spread across the past and future, matching payments,
invoices for completed stays, and a housekeeping queue. Statuses are derived from
the calendar, so the dashboard has in-house guests, arrivals, departures and rooms
being turned over from the moment you first open it.

> **These are demo credentials for local development only.** Change or delete
> these accounts before deploying anything publicly, and never run the seed
> against a production database.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@hotel.com` | `Admin@123` |
| Manager | `manager@hotel.com` | `Manager@123` |
| Receptionist | `reception@hotel.com` | `Reception@123` |
| Housekeeping | `housekeeping@hotel.com` | `House@123` |

The seed is deterministic — re-running it gives the same data, dated relative to
the day you run it.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000. |
| `npm run dev:db` | Disposable in-memory MongoDB, for when none is installed. |
| `npm run seed` | Reset and repopulate the demo data. |
| `npm run test:flows` | 110 end-to-end checks of the business rules against the real database. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |

---

## Architecture

**Server-first.** Pages are React Server Components that query MongoDB directly
through a shared read layer (`lib/data.ts`). Only genuinely interactive pieces —
forms, filter bars, dialogs, charts — are client components. Nothing ships the
whole page to the browser.

**One definition per rule.** The same Zod schema validates an API request body
and the form that produces it. The same filter builder serves a page and its API
route. The same `calculateFolio` prices a quote in the booking wizard and the bill
that is written to the database.

```
Browser ── form (React Hook Form + Zod) ──► /api/… route handler
                                              │ requirePermission()  ← server-side gate
                                              │ schema.parse()       ← server-side validation
                                              │ service layer        ← availability / folio / invoices
                                              ▼
                                           MongoDB
Page (RSC) ──► lib/data.ts ──────────────────►
```

**Layers**

| Layer | Location | Responsibility |
| --- | --- | --- |
| Models | `models/` | Mongoose schemas, indexes, validation, relationships. |
| Schemas | `schemas/` | Zod validation shared by API routes and forms. |
| Services | `lib/availability.ts`, `lib/folio.ts`, `lib/invoices.ts`, `lib/rooms.ts` | Business rules. The only place money and availability are decided. |
| Reads | `lib/data.ts` | Paginated, filtered queries used by both pages and API routes. |
| API | `app/api/` | Thin handlers: authorise, validate, delegate, respond. |
| UI | `app/(app)/`, `components/` | Server-rendered pages with small client islands. |

**Consistent responses.** Every endpoint answers with the same envelope:

```jsonc
{ "success": true,  "message": "Room created successfully", "data": {}, "meta": {} }
{ "success": false, "message": "Room number already exists", "code": "CONFLICT", "errors": {} }
```

`lib/errors.ts` maps every thrown value — Zod, Mongoose validation, cast errors,
duplicate keys, connection failures — to a safe message and status. Internal
database errors are logged server-side and never sent to the client.

---

## Authentication and authorisation

- **Auth.js v5** with a Credentials provider and JWT sessions.
- Passwords hashed with **bcrypt** (via `bcryptjs`, which produces interchangeable
  `$2a`/`$2b` hashes without a native build step).
- Sign-in failures are indistinguishable from one another and run the same
  comparison work either way, so the endpoint cannot be used to discover which
  email addresses have accounts.
- Password-reset tokens are stored **hashed**, expire after an hour, and work once.

Authorisation is a single map in `lib/permissions.ts`. It drives three things at
once, so they can never disagree:

1. which sidebar links render,
2. which routes middleware allows (`auth.config.ts`, Edge runtime, no database),
3. which API calls succeed (`requirePermission()` in every handler).

Roles are read from the signed session token, never from a request body. Hiding a
link is a convenience; the server-side check is the gate.

| | Admin | Manager | Receptionist | Housekeeping |
| --- | :-: | :-: | :-: | :-: |
| Dashboard | ● | ● | ● | ● |
| Reservations, check-in/out | ● | ● | ● | |
| Rooms & room types | ● | ● | view | view |
| Guests | ● | ● | ● | |
| Payments | ● | ● | ● (no refunds) | |
| Invoices | ● | ● | view | |
| Housekeeping | ● | ● | view | own rooms |
| Staff | ● | ● | | |
| Reports | ● | ● | | |
| Users & roles | ● | | | |
| Settings | ● | view | | |

A manager cannot create, edit or delete an administrator. Nobody can change their
own role, deactivate themselves, or delete the last active administrator.

---

## Business rules

**Double-booking prevention.** A stay occupies the half-open interval
`[checkIn, checkOut)`. Two stays clash when `existing.checkIn < new.checkOut` and
`new.checkIn < existing.checkOut` — a single indexed MongoDB query. Half-open is
what makes same-day turnover legal:

```
Existing: 10 Oct ──────────► 15 Oct
12 → 14 Oct   rejected (inside)
 8 → 11 Oct   rejected (overlaps the start)
14 → 17 Oct   rejected (overlaps the end)
15 → 18 Oct   allowed   (arrives the day the room is vacated)
 5 → 10 Oct   allowed   (leaves the day the other arrives)
```

The check runs immediately before the insert, not when the room list was
displayed — the room can be taken while a booking form is open, and only the
server can settle that race. Rooms under maintenance, out of service, or too small
for the party are rejected with a specific reason.

**Stay dates** are stored at UTC midnight, so a night is a calendar concept and
never shifts with the viewer's timezone.

**The folio.** `recalculateReservationTotals` is the only writer of a
reservation's money fields. Anything that can change a bill — editing dates,
adding a charge, taking a payment, issuing a refund — calls it afterwards, and it
recomputes from the payment records. The balance is therefore always a consequence
of the ledger rather than something kept in step by hand.

```
room nights × rate
  + additional charges
  = subtotal
  − discount
  = taxable amount
  + tax
  = total        − payments + refunds = balance due
```

Tax is charged *after* the discount. A reservation is only `PAID` when
`amountPaid >= totalAmount`. A payment larger than the outstanding balance is
refused with the exact figure, because that is a data-entry mistake far more often
than a genuine deposit. Refunds are separate records, never negative payments, so
both movements stay visible.

**Check-in** requires a reservation that is `PENDING` or `CONFIRMED`, an arrival
date that has arrived, a guest who is not blacklisted, and a room that is clean and
unoccupied. It stamps `actualCheckInTime` and `checkedInBy`, records the guest's
identification, and sets the room `OCCUPIED`.

**Check-out** requires `CHECKED_IN`. It posts any final charges, takes the
settlement, and refuses to close while money is outstanding unless the desk
explicitly confirms (for corporate billing or a disputed charge). It then stamps
`actualCheckOutTime` and `checkedOutBy`, sets the reservation `CHECKED_OUT`, moves
the room to `CLEANING`/`DIRTY`, raises a housekeeping task, and issues the invoice.

**Invoices** freeze the hotel, guest and stay details at the moment of issue. If
the hotel changes address or the guest updates their phone number, an issued
invoice keeps showing what it was given. Re-issuing returns the existing invoice
rather than creating a duplicate.

**Housekeeping** closes the loop: marking a vacated room clean is what returns it
to the sellable pool — to `AVAILABLE`, or to `RESERVED` when a later booking still
holds it. A room with a guest in house is never freed this way.

All of the above is covered by `npm run test:flows`.

---

## API reference

All routes answer with the shared envelope and enforce permissions server-side.
List endpoints accept `page`, `limit`, `search`, `sort`, `order` plus their own
filters, and return `meta` with pagination details.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | GET, POST | Sign in, sign out, session, CSRF. |
| `/api/auth/register` | POST | Public sign-up (always least-privileged role). |
| `/api/auth/forgot-password` | POST | Start a reset. Response never reveals whether the email exists. |
| `/api/auth/reset-password` | POST | Complete a reset with a one-time token. |
| `/api/auth/change-password` | POST | Change your own password. |
| `/api/users`, `/api/users/[id]` | GET, POST, PATCH, DELETE | Accounts and roles (admin). |
| `/api/rooms`, `/api/rooms/[id]` | GET, POST, PATCH, DELETE | Rooms. Deleting one with history retires it instead. |
| `/api/rooms/availability` | GET | Bookable rooms for a date range and party size. |
| `/api/room-types`, `/api/room-types/[id]` | GET, POST, PATCH, DELETE | Rate categories. |
| `/api/guests`, `/api/guests/[id]` | GET, POST, PATCH, DELETE | Guest profiles, with stay and payment history. |
| `/api/reservations`, `/api/reservations/[id]` | GET, POST, PATCH, DELETE | Bookings. Availability re-checked on write. |
| `/api/reservations/[id]/cancel` | POST | Cancel or mark a no-show; frees the dates. |
| `/api/reservations/[id]/charges` | POST, DELETE | Post or remove folio charges. |
| `/api/check-in` | POST | Arrival, with all preconditions enforced. |
| `/api/check-out` | POST | Settle, close the stay, issue the invoice. |
| `/api/payments`, `/api/payments/[id]` | GET, POST, PATCH, DELETE | Payments and refunds. |
| `/api/invoices`, `/api/invoices/[id]` | GET, POST, DELETE | Invoices; DELETE voids rather than erases. |
| `/api/housekeeping`, `/api/housekeeping/[id]` | GET, POST, PATCH, DELETE | Housekeeping tasks. |
| `/api/housekeeping/rooms`, `/api/housekeeping/rooms/[id]` | GET, PATCH | The floor board and room status changes. |
| `/api/staff`, `/api/staff/[id]` | GET, POST, PATCH, DELETE | Staff records. |
| `/api/reports` | GET | Revenue, occupancy, reservation and guest reports. `format=csv` exports the same figures. |
| `/api/settings` | GET, PATCH | Hotel configuration. |
| `/api/dashboard` | GET | Dashboard figures as JSON. |

---

## Project structure

```
hotel-management/
├── app/
│   ├── (auth)/              login, register, forgot-password, reset-password
│   ├── (app)/               authenticated shell + every dashboard page
│   │   ├── dashboard/  reservations/  check-in/  check-out/
│   │   ├── rooms/      rooms/types/   guests/    payments/
│   │   ├── invoices/   housekeeping/  staff/     reports/
│   │   └── users/      settings/      profile/
│   ├── api/                 route handlers (table above)
│   ├── forbidden/  error.tsx  not-found.tsx  layout.tsx
├── components/
│   ├── ui/                  shadcn/ui primitives
│   ├── layout/              shell, sidebar, header, user menu
│   ├── shared/              table toolbar, pagination, states, badges, dialogs
│   └── dashboard/ rooms/ guests/ reservations/ payments/ invoices/
│       housekeeping/ staff/ users/ reports/ settings/ auth/
├── lib/
│   ├── mongodb.ts           cached connection
│   ├── auth.ts  session.ts  permissions.ts   authn + authz
│   ├── availability.ts      double-booking prevention
│   ├── folio.ts  pricing.ts invoices.ts      money
│   ├── data.ts  query.ts    shared reads
│   ├── dashboard.ts reports.ts  aggregations
│   └── constants.ts dates.ts format.ts csv.ts errors.ts api-response.ts
├── models/                  User Guest Room RoomType Reservation Payment
│                            Invoice Staff HousekeepingTask HotelSettings Counter
├── schemas/                 Zod schemas, one per domain
├── hooks/                   debounced value, URL-backed list filters
├── types/                   Auth.js module augmentation
├── scripts/                 seed.ts  test-flows.ts  dev-mongo.ts
├── middleware.ts            Edge route protection
└── .env.example
```

---

## Deployment

1. Provision MongoDB Atlas and allow your host's IP range.
2. Set `MONGODB_URI`, `AUTH_SECRET` and `NEXTAUTH_URL` in the host's environment.
3. Set `ALLOW_PUBLIC_REGISTRATION=false` unless you want open sign-up.
4. Build and start:

```bash
npm ci
npm run build
npm start
```

On Vercel, add the same variables under *Settings → Environment Variables*; the
build and start commands are detected automatically. Middleware runs on the Edge
runtime and deliberately imports no database code, so it deploys as-is.

Before going live: create a real administrator, delete the seeded demo accounts,
and configure an email provider for password resets (see below).

---

## Notes and known limitations

- **Password-reset emails are not sent.** No mail transport is configured, so the
  reset link is written to the server log (and returned in the API response in
  development only). Wire an email provider into
  `app/api/auth/forgot-password/route.ts` for production.
- **`bcryptjs` rather than native `bcrypt`.** Same algorithm and interchangeable
  hashes, no native compilation — `npm install` works on every platform and the
  code runs unchanged on serverless hosts.
- **PDF invoices use the browser's print dialogue** ("Save as PDF") with a
  dedicated print stylesheet, so the file matches the screen exactly without
  bundling a PDF renderer.
- **Double-booking is enforced in the service layer**, because MongoDB has no
  range-exclusion constraint. Under extreme concurrency on a replica set, wrap
  the availability check and the insert in a transaction for a stronger guarantee.
- **Room images** are stored as URLs; no upload pipeline is included.
#   h o t e l - m a n a g e m e n t  
 
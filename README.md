# StockSense

Inventory management for a business that has outgrown registers and spreadsheets:
products, receipts, delivery orders, internal transfers, physical counts, and a
stock ledger that explains every number on screen.

Built with Next.js 16 (App Router, Server Actions), Prisma 7 on PostgreSQL,
TypeScript and Tailwind 4.

---

## The idea the whole system rests on

**Every change in stock is a movement from one location to another.**

Receipts, deliveries, internal transfers and adjustments are not four different
stock algorithms. They are four screens that all call one function,
[`applyMove`](src/lib/stock.ts), with different source and destination locations.

What makes that work is *virtual locations*: vendors, customers and inventory
corrections each get a `Location` row, exactly like a real rack does. Stock
arriving is a movement out of `Partners/Vendors`; stock shipping is a movement
into `Partners/Customers`.

| Operation | Source | Destination | Effect on on-hand |
|---|---|---|---|
| Receipt `WH/IN/00001` | `Partners/Vendors` *(virtual)* | `WH/Stock` | **+ qty** |
| Delivery `WH/OUT/00001` | `WH/Stock` | `Partners/Customers` *(virtual)* | **− qty** |
| Internal transfer `WH/INT/00001` | `WH/Stock` | `WH/Production` | 0 — only the location changes |
| Adjustment, counted **>** system | `Virtual/Adjustment` *(virtual)* | the counted location | **+ difference** |
| Adjustment, counted **<** system | the counted location | `Virtual/Adjustment` | **− difference** |

Three consequences worth knowing:

- **On-hand quantity is never stored on a product.** It is the sum of
  `StockQuant` rows over locations of type `INTERNAL`. Nothing can drift out of
  step with the ledger, because there is nothing to drift.
- **Quantities across *all* locations always sum to zero.** Virtual locations
  carry the negative side. The verification script asserts this.
- **Real locations may never go negative; virtual ones must.**
  `Partners/Vendors` sitting at −420 kg simply records that 420 kg came in from
  suppliers.

---

## Running it

You need Node 20+ and Docker (for Postgres — or point `DATABASE_URL` at any
Postgres, such as a free Neon database).

```bash
npm install
cp .env.example .env     # then set AUTH_SECRET (see below)
npm run db:up            # Postgres on localhost:5433
npm run db:deploy        # apply migrations
npm run db:seed          # two warehouses, 12 products, open documents
npm run dev
```

Generate the signing key for the session cookie:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then open <http://localhost:3000>.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Inventory manager | `manager@stocksense.app` | `stocksense123` |
| Warehouse staff | `staff@stocksense.app` | `stocksense123` |

Managers can additionally manage warehouses, locations and categories. The nav
hides those pages from staff and
[`requireManager`](src/lib/auth.ts) enforces it server-side.

### Password reset without an email server

Leave the `SMTP_*` variables blank and reset codes are printed to the terminal
running `npm run dev` instead of being emailed, so the flow is demonstrable on a
laptop with no mail setup. Fill them in and real mail is sent through Nodemailer.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | **End-to-end check of the inventory flow** (below) — 28 checks |
| `npm run verify:security` | Rate limiting, session tokens, password hashing — 20 checks |
| `npm run verify:all` | Both of the above |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply existing migrations (CI, production) |
| `npm run db:seed` | Seed demo data — idempotent, safe to re-run |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio |

### `npm run verify`

[`scripts/verify-flow.ts`](scripts/verify-flow.ts) drives the *real* services —
the same code the server actions call — through the exact scenario in the
problem statement, then checks the guard rails:

```
Step 1 — receive 100 kg from a vendor        WH/Stock 100, vendor −100
Step 2 — transfer all 100 to production      WH/Stock 0, WH/Production 100
Step 3 — deliver 20 to a customer            WH/Production 80
Step 4 — count the rack, find 77             WH/Production 77

Delivery preparation: mark picked, mark packed, no stock moves until validate

Guard rails: over-delivery refused with nothing written · double validation
refused · canceling a validated document refused · a receipt from a real
location refused · picking a receipt refused · counting a virtual location
refused

Accounting identity: every location sums to zero · real locations hold 77
```

It runs on a throwaway SKU and cleans up after itself, so it is safe against the
demo database.

---

## How the code is arranged

```
prisma/
  schema.prisma          14 models; the datasource has no url (Prisma 7)
  seed.ts                idempotent; books opening stock through applyMove
prisma.config.ts         Prisma 7 config: schema path, migrations, seed command
scripts/verify-flow.ts   end-to-end check of the inventory flow
src/
  app/
    (auth)/              login, signup, forgot-password, reset-password
    (app)/               everything behind the session cookie
  components/
    documents/           line editor, picking form, list/detail pages, config
    products/ settings/ ui/ layout/
  config/nav.ts          every sidebar link, filtered by role
  lib/
    stock.ts             applyMove — the only writer of StockQuant/StockMove
    refs.ts              WH/IN/00001, allocated from an atomic counter
    auth.ts              sessions, hashing, requireUser / requireManager
    session.ts           JWT only — no bcrypt, so proxy.ts can import it
    errors.ts            StockError, dependency-free
    form-state.ts        the form contract client components import
    forms.ts             server-side error mapping (Prisma, Zod, StockError)
    validators.ts        every Zod schema
    env.ts               validated once at boot
  server/
    services/            inventory rules, callable without a request
    actions/             "use server" — authenticate, parse, delegate, revalidate
    queries/             read models for pages
  proxy.ts               route protection (Next 16's renamed middleware)
```

**Why services and actions are separate.** A server action needs a request: it
reads cookies for the session and calls `revalidatePath`. That makes the rules
inside it impossible to run from a script or a test. So the rules live in
`server/services/*`, taking a plain `userId`, and the actions are thin wrappers.
`npm run verify` exercises the services directly — which is the only reason it
can prove the engine rather than just the pages.

### Correctness details worth pointing at

- **Validation is one transaction.** If any line would take a real location
  below zero, nothing is written at all and the document stays exactly as it
  was. `verify` asserts this after a deliberate over-delivery.
- **Document references come from a counter table**
  ([`DocumentSequence`](prisma/schema.prisma)), incremented atomically inside
  the same transaction that creates the document. Deriving the number from a row
  count would hand the same reference to two people validating at once.
- **Adjustments re-read the system quantity at the moment they are applied**, and
  store that snapshot on the line. A movement between opening the count sheet
  and applying it cannot be silently overwritten.
- **Quantities are `DECIMAL(14,3)`**, not floats, and arithmetic goes through
  Prisma's `Decimal`.
- **Reset codes are stored as bcrypt digests**, expire in ten minutes, are
  single-use, and requesting a new one consumes the old. Forgot-password always
  reports success so it cannot be used to discover which emails have accounts.
- **Login gives one message for both failure modes**, for the same reason.
- **Validated documents are immutable** — they cannot be edited, canceled or
  deleted, because their movements are already in the ledger. Correct them with
  another document.
- **Products are archived, never deleted.** Their SKU appears on past documents
  and the ledger must keep naming something real.

### Notes on the stack

Prisma 7 removed `url` from the datasource block: the connection string lives in
`prisma.config.ts` for the CLI, and the client connects through the `@prisma/adapter-pg`
driver adapter in [`src/lib/db.ts`](src/lib/db.ts). Next 16 renamed `middleware.ts`
to `proxy.ts`. Both are current as written.

`npm audit` reports findings in the Prisma **CLI's** dependency tree (`mysql2`,
which this project does not use, and a config-merge package). They are
devDependencies and not in the runtime bundle; `npm audit fix --force` would
downgrade to a Prisma 8 release candidate, which is worse.

---

## Security

| Control | How |
|---|---|
| Passwords | bcrypt, cost 10, salted per user |
| Sessions | HS256 JWT in an `httpOnly`, `sameSite=lax` cookie, `secure` in production, 7 days. Carries only the user id, so revoking a role takes effect at once. |
| Route protection | `proxy.ts` on the Edge for every request, then `requireUser()` again inside the layout |
| Role enforcement | `requireManager()` in the page *and* the action — hiding a nav link is presentation, not a control |
| Reset codes | 6 digits from `crypto.randomInt`, stored as a bcrypt digest, 10-minute expiry, single use, and requesting a new one burns the old |
| Rate limiting | Login, signup, reset requests, reset-code verification and password changes, capped per IP and per account |
| Account enumeration | Login gives one message for both failure modes; forgot-password always reports success |
| Input validation | Every form parsed with Zod on the server before it reaches the database |
| SQL injection | Prisma parameterises everything; no raw SQL in the app |
| Open redirect | `?next=` accepts relative paths only |
| Error leakage | Unknown errors are logged server-side and replaced with a generic message |
| Headers | CSP with `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`; plus nosniff, Referrer-Policy, Permissions-Policy, HSTS in production, and no `X-Powered-By` |

`npm run verify:security` exercises the rate limiter, session signing and
password hashing directly — 20 checks.

**Two honest limits.** Rate-limit counters live in memory, so a deployment
running several instances limits per instance; the interface in
`lib/rate-limit.ts` is ready to sit on Redis. And the CSP allows
`script-src 'unsafe-inline'`, because Next.js injects its own bootstrap inline
and the theme script has to run before first paint; moving to a nonce would
remove that.

---

## Deploying

Vercel plus any hosted Postgres (Neon, Supabase, RDS):

1. Import the repository.
2. Set `DATABASE_URL` and `AUTH_SECRET`, plus the `SMTP_*` variables if you want
   real reset emails.
3. `postinstall` already runs `prisma generate`. Run `npm run db:deploy` once
   against the production database, and `npm run db:seed` if you want the demo
   data there too.

# StockSense — Complete Technical Reference

Companion to [README.md](README.md). That one tells you how to run the project.
This one walks through **every file, every table, every decision**.

- **127 files**, ~10,600 lines of TypeScript
- **29 routes**, 14 database tables, 48 automated checks
- Next.js 16 · React 19 · Prisma 7 · PostgreSQL 17 · Tailwind 4 · TypeScript 5

---

## Table of contents

1. [What the project is](#1-what-the-project-is)
2. [The core idea](#2-the-core-idea-everything-is-a-movement)
3. [Tech stack — every dependency and why](#3-tech-stack--every-dependency-and-why)
4. [Full directory tree](#4-full-directory-tree)
5. [Root configuration files](#5-root-configuration-files)
6. [Database layer (`prisma/`)](#6-database-layer-prisma)
7. [The 14 tables explained](#7-the-14-tables-explained)
8. [Library layer (`src/lib/`)](#8-library-layer-srclib)
9. [Server layer (`src/server/`)](#9-server-layer-srcserver)
10. [Routes (`src/app/`)](#10-routes-srcapp)
11. [Components (`src/components/`)](#11-components-srccomponents)
12. [How a request flows](#12-how-a-request-flows-end-to-end)
13. [Authentication and authorisation](#13-authentication-and-authorisation)
14. [The four operations, step by step](#14-the-four-operations-step-by-step)
15. [Design system](#15-design-system)
16. [Testing and verification](#16-testing-and-verification)
17. [Scripts reference](#17-scripts-reference)
18. [Known constraints](#18-known-constraints)
19. [Requirements traceability](#19-requirements-traceability)

---

## 1. What the project is

An Inventory Management System that replaces manual registers and spreadsheets
with one real-time application. It covers the full lifecycle of stock:

| Capability | Where it lives |
|---|---|
| Sign up, log in, OTP password reset | `/login` `/signup` `/forgot-password` `/reset-password` |
| Dashboard with 5 KPIs and 4 filters | `/dashboard` |
| Product catalogue, SKU search, categories, units of measure | `/products` `/settings/categories` |
| Stock availability per location | `/products/[id]` |
| Reordering rules and low-stock alerts | `/products/[id]` + topbar badge |
| Receipts — incoming goods from vendors | `/receipts` |
| Delivery orders — outgoing goods to customers | `/deliveries` |
| Internal transfers — stock moving inside the company | `/transfers` |
| Inventory adjustments — physical count vs system | `/adjustments` |
| Move history — the full stock ledger | `/moves` |
| Multi-warehouse and locations | `/settings/warehouses` |
| Profile, role, password change | `/profile` |

**Two user roles.** Warehouse staff run all operations. Inventory managers can
additionally manage warehouses, locations and categories.

---

## 2. The core idea: everything is a movement

This is the one thing to understand. Everything else follows from it.

> **Every change in stock is a movement from one location to another.**

Receipts, deliveries, transfers and adjustments are **not four different stock
algorithms**. They are four screens that all call one function — `applyMove()`
in `src/lib/stock.ts` — with different source and destination locations.

The trick that makes this work is **virtual locations**. Vendors, customers and
inventory corrections each get a `Location` row, exactly like a real rack does:

| Location | Type | Real? | Purpose |
|---|---|---|---|
| `WH/Stock` | `INTERNAL` | Yes | Main warehouse floor |
| `WH/Production` | `INTERNAL` | Yes | Production rack |
| `WH/Rack-A`, `WH/Rack-B` | `INTERNAL` | Yes | Shelving |
| `Partners/Vendors` | `VENDOR` | **No** | Where incoming goods come from |
| `Partners/Customers` | `CUSTOMER` | **No** | Where outgoing goods go |
| `Virtual/Adjustment` | `ADJUSTMENT` | **No** | Counterpart of a stock correction |

So every operation becomes the same shape:

| Operation | Source | Destination | On-hand effect |
|---|---|---|---|
| Receipt `WH/IN/00001` | `Partners/Vendors` | `WH/Stock` | **+ qty** |
| Delivery `WH/OUT/00001` | `WH/Stock` | `Partners/Customers` | **− qty** |
| Transfer `WH/INT/00001` | `WH/Stock` | `WH/Production` | **0** (location only) |
| Adjustment, counted **>** system | `Virtual/Adjustment` | counted location | **+ difference** |
| Adjustment, counted **<** system | counted location | `Virtual/Adjustment` | **− difference** |

### Three consequences

**1. On-hand quantity is never stored on a product.** It is derived:

```sql
SELECT SUM(quantity) FROM stock_quants
JOIN locations ON ...
WHERE locations.type = 'INTERNAL'
```

Nothing can drift out of step with the ledger, because there is nothing to drift.

**2. Quantities across *all* locations always sum to zero.** Virtual locations
carry the negative side. `Partners/Vendors` sitting at −420 kg simply records
that 420 kg came in from suppliers. `npm run verify` asserts this identity.

**3. Real locations may never go negative; virtual ones must.** That single rule,
enforced inside `applyMove`, is what prevents over-delivery.

### The problem statement's own example

| Step | Document | Movement | WH/Stock | WH/Production |
|---|---|---|---|---|
| Receive 100 kg steel | `WH/IN/00001` | Vendors → WH/Stock | 100 | 0 |
| Move to production rack | `WH/INT/00001` | WH/Stock → WH/Production | 0 | 100 |
| Deliver 20 | `WH/OUT/00001` | WH/Production → Customers | 0 | 80 |
| 3 kg damaged | `ADJ/00001` | WH/Production → Virtual/Adjustment | 0 | **77** |

Four documents, four `StockMove` rows that are never edited again. This exact
scenario is what `npm run verify` runs.

---

## 3. Tech stack — every dependency and why

### Runtime dependencies

| Package | Version | Why it is here |
|---|---|---|
| `next` | 16.3.6 | App Router, Server Components, Server Actions. One codebase for UI and backend — no separate API server, no CORS. |
| `react` / `react-dom` | 19.2.8 | `useActionState` and `useFormStatus` drive every form. |
| `@prisma/client` | 7.10.0 | Type-safe database access. Generated types mean the DB schema and TypeScript can't disagree. |
| `@prisma/adapter-pg` | 7.10.0 | Prisma 7 connects through a driver adapter, not a datasource URL. |
| `pg` | latest | The actual PostgreSQL driver the adapter wraps. |
| `zod` | 4.x | Every form input is validated server-side before it reaches the database. |
| `bcryptjs` | 3.x | Password and OTP hashing. Pure JS, so no native build step on Windows. |
| `jose` | 6.x | Signs and verifies the session JWT. Works on the Edge runtime, which `proxy.ts` needs. |
| `nodemailer` | 10.x | Sends password-reset codes over SMTP. |
| `lucide-react` | 1.x | Icon set. Tree-shakeable. |
| `clsx` + `tailwind-merge` | — | The `cn()` helper: conditional classes that resolve Tailwind conflicts correctly. |
| `class-variance-authority` | 0.7 | Typed component variants (button `variant` × `size`). |
| `date-fns` | 4.x | Date helpers. |
| `server-only` | 1.x | Build-time guard: importing a server module from a client component becomes a **build error**, not a runtime leak. |

### Development dependencies

| Package | Why |
|---|---|
| `typescript` 5 | Strict mode throughout. |
| `prisma` 7.10.0 | Migrations, generate, studio. **Pinned** — see below. |
| `tailwindcss` 4 + `@tailwindcss/postcss` | CSS-first config via `@theme`, no `tailwind.config.js`. |
| `eslint` 9 + `eslint-config-next` | Includes React 19 rules like `set-state-in-effect`. |
| `tsx` | Runs the seed and verification scripts as TypeScript. |
| `@types/*` | Type definitions for bcryptjs, nodemailer, pg, node, react. |

### Why Prisma is pinned to exactly 7.10.0

`npm install prisma` resolves to **8.0.0-rc.17** — npm has a release candidate
tagged as `latest`. That RC does not match the 7.x client, and it drags in a
toolchain (`@prisma/dev`, `alchemy`, `hono`) that produced 13 audit warnings.
Both `prisma` and `@prisma/client` are pinned to `7.10.0` together.

### Two framework changes that trip people up

| Change | Old | New |
|---|---|---|
| Prisma 7 datasource | `url = env("DATABASE_URL")` in schema | `prisma.config.ts` + driver adapter |
| Next 16 middleware | `middleware.ts`, `export function middleware` | `proxy.ts`, `export default function proxy` |

Both are handled correctly in this codebase.

---

## 4. Full directory tree

```
stocksense/
├── .env                          # secrets, gitignored
├── .env.example                  # template, committed
├── .gitattributes                # LF line endings everywhere
├── .gitignore
├── docker-compose.yml            # PostgreSQL 17 on port 5433
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── prisma.config.ts              # Prisma 7 config (schema, migrations, seed)
├── tsconfig.json
├── README.md                     # how to run it
├── readme2.md                    # this file
│
├── docs/
│   └── problem-statement.pdf
│
├── prisma/
│   ├── schema.prisma             # 14 models, 5 enums
│   ├── seed.ts                   # idempotent demo data
│   └── migrations/
│       ├── 20260926040105_init/migration.sql
│       ├── 20260926040220_document_sequence/migration.sql
│       └── migration_lock.toml
│
├── scripts/
│   ├── verify-flow.ts            # 28-check end-to-end verification
│   └── verify-security.ts        # 20-check security verification
│
└── src/
    ├── proxy.ts                  # route protection (Edge runtime)
    │
    ├── app/
    │   ├── layout.tsx            # root layout, fonts, theme bootstrap
    │   ├── globals.css           # design tokens, light + dark
    │   ├── page.tsx              # redirects to /dashboard
    │   ├── not-found.tsx         # root 404
    │   ├── global-error.tsx      # error in the root layout itself
    │   │
    │   ├── (auth)/               # signed-out routes
    │   │   ├── layout.tsx        # split-screen brand panel
    │   │   ├── login/
    │   │   │   ├── page.tsx
    │   │   │   └── login-form.tsx
    │   │   ├── signup/page.tsx
    │   │   ├── forgot-password/page.tsx
    │   │   └── reset-password/page.tsx
    │   │
    │   └── (app)/                # signed-in routes
    │       ├── layout.tsx        # loads user + alerts, renders AppShell
    │       ├── error.tsx         # page error boundary
    │       ├── not-found.tsx     # 404 inside the shell
    │       ├── dashboard/page.tsx
    │       ├── products/
    │       │   ├── page.tsx
    │       │   ├── new/page.tsx
    │       │   └── [id]/page.tsx
    │       ├── receipts/
    │       │   ├── page.tsx
    │       │   ├── new/page.tsx
    │       │   └── [id]/
    │       │       ├── page.tsx
    │       │       └── edit/page.tsx
    │       ├── deliveries/       # same 4 files
    │       ├── transfers/        # same 4 files
    │       ├── adjustments/      # same 4 files
    │       ├── moves/page.tsx
    │       ├── settings/
    │       │   ├── warehouses/page.tsx
    │       │   └── categories/
    │       │       ├── page.tsx
    │       │       └── categories-manager.tsx
    │       └── profile/
    │           ├── page.tsx
    │           └── profile-forms.tsx
    │
    ├── components/
    │   ├── action-button.tsx     # button that runs a server action
    │   ├── filters.tsx           # URL-driven filter controls
    │   ├── kpi-tile.tsx
    │   ├── ui/                   # button, field, badge, card, table, alert, submit-button, skeleton
    │   ├── layout/               # app-shell, theme-toggle
    │   ├── documents/            # config, line-editor, picking-*, adjustment-*
    │   ├── products/             # product-form, reorder-rules
    │   └── settings/             # warehouse-manager
    │
    ├── config/
    │   └── nav.ts                # every sidebar link, role-filtered
    │
    ├── lib/
    │   ├── stock.ts              # ★ applyMove — the heart
    │   ├── refs.ts               # WH/IN/00001 allocation
    │   ├── db.ts                 # Prisma singleton
    │   ├── env.ts                # validated environment
    │   ├── errors.ts             # StockError
    │   ├── auth.ts               # sessions, requireUser, requireManager
    │   ├── session.ts            # JWT only (Edge-safe)
    │   ├── password.ts           # bcrypt only (Next-free)
    │   ├── otp.ts                # reset codes
    │   ├── mailer.ts             # SMTP with console fallback
    │   ├── validators.ts         # every Zod schema
    │   ├── forms.ts              # server-side error mapping
    │   ├── form-state.ts         # client-safe form contract
    │   ├── enums.ts              # Prisma enums without the 46 KB
    │   ├── rate-limit.ts         # login / OTP / signup throttling
    │   └── utils.ts              # cn, formatQty, formatMoney, dates
    │
    └── server/
        ├── services/             # inventory rules, no request needed
        │   ├── pickings.ts
        │   └── adjustments.ts
        ├── actions/              # "use server" — thin wrappers
        │   ├── auth.ts
        │   ├── products.ts
        │   ├── pickings.ts
        │   ├── adjustments.ts
        │   └── settings.ts
        └── queries/              # read models for pages
            ├── products.ts
            ├── documents.ts
            └── dashboard.ts
```

---

## 5. Root configuration files

| File | Lines | What it does |
|---|---|---|
| `package.json` | 54 | Dependencies and the 16 npm scripts. `postinstall` runs `prisma generate` so a fresh clone or a Vercel build always has a current client. |
| `prisma.config.ts` | 23 | Prisma 7 config. Points at the schema and migrations folder, sets the seed command, and supplies `DATABASE_URL` — which Prisma 7 no longer reads from the schema. Also calls `process.loadEnvFile()` because Prisma 7 does not load `.env` on its own. |
| `docker-compose.yml` | 21 | PostgreSQL 17 Alpine on **port 5433** (not 5432, to avoid clashing with a local Postgres), with a named volume and a `pg_isready` healthcheck. |
| `.env.example` | 14 | Template: `DATABASE_URL`, `AUTH_SECRET`, five `SMTP_*` variables. Committed so a clone knows what it needs. |
| `.gitattributes` | 8 | `* text=auto eol=lf`. Without it, a Windows checkout commits CRLF and every file looks rewritten in the diff. |
| `.gitignore` | 43 | Ignores `node_modules`, `.next`, `.env*` — **but not `.env.example`** (`!.env.example`) and **not `prisma/migrations/`**, which must be committed or databases silently diverge. |
| `tsconfig.json` | 34 | Strict mode, `@/*` path alias to `src/*`, the Next plugin. |
| `eslint.config.mjs` | 18 | Next + TypeScript rules, including React 19's `set-state-in-effect`. |
| `next.config.ts` | 7 | Near-default. Typed routes are on, which is why `PageProps<"/products/[id]">` exists. |
| `postcss.config.mjs` | 7 | Loads `@tailwindcss/postcss`. Tailwind 4 needs nothing else. |

---

## 6. Database layer (`prisma/`)

### `prisma/schema.prisma` — 292 lines

Declares **5 enums** and **14 models**. Notable choices:

- `datasource db` has a `provider` but **no `url`** — Prisma 7 forbids it.
- All quantities are `Decimal @db.Decimal(14, 3)`. Never floats: `0.1 + 0.2`
  must be `0.3` when you are counting stock.
- Money is `Decimal @db.Decimal(12, 2)`.
- Every model has `@@map("snake_case")` so table names read naturally in SQL.
- Cascade rules are deliberate: deleting a picking cascades its lines and moves;
  deleting a **product** is `Restrict`ed from line tables, because a validated
  document must keep naming something real.

### `prisma/seed.ts` — 307 lines

Idempotent (`upsert` everywhere) — safe to run repeatedly. Creates:

- 2 users: `manager@stocksense.app` and `staff@stocksense.app`, both `stocksense123`
- 2 warehouses: `WH` Main (Gurugram), `WH2` Secondary (Jaipur)
- 6 internal locations + 3 virtual locations
- 4 categories, 12 products with real SKUs (`STL-ROD-12`, `CHR-OAK-01`, …)
- 10 opening balances — **booked through `applyMove`**, not written straight into
  `StockQuant`, so the ledger is correct from the first row
- 5 reorder rules, deliberately set so 2 products are low and 2 are out of stock
- 4 draft documents, so every dashboard KPI is non-zero on first load

### `prisma/migrations/`

Three migrations. `_init` (317 lines of SQL) creates everything,
`_document_sequence` adds the reference counter table, and
`_delivery_pick_pack` adds the two delivery preparation timestamps.

---

## 7. The 14 tables explained

### Identity

**`users`** — `id`, `name`, `email` (unique), `passwordHash`, `role`, timestamps.
Role is `MANAGER` or `STAFF`.

**`password_otps`** — `userId`, `codeHash` (bcrypt — the six digits are *never*
stored), `expiresAt`, `consumedAt`. Single-use, ten-minute expiry.

### Places

**`warehouses`** — `name`, `code` (unique, e.g. `WH`). The code becomes the
document prefix: `WH/IN/00001`.

**`locations`** — `name`, `code`, `type`, nullable `warehouseId`.
`@@unique([warehouseId, code])`. Virtual locations have `warehouseId = null`.

> Postgres treats NULLs as distinct, so that unique constraint cannot enforce
> uniqueness for warehouse-less rows. The seed uses find-then-create for virtual
> locations instead, and `virtualLocationId()` looks them up by code.

### Catalogue

**`categories`** — `name` (unique).

**`products`** — `name`, `sku` (unique, uppercased), `uom`, `categoryId`,
`costPrice`, `salePrice`, `isActive`. Indexed on `name` and `sku` for search.
Archived rather than deleted.

**`reorder_rules`** — `productId` + `warehouseId` (unique together), `minQty`,
`maxQty`. Drives low-stock alerts and the suggested top-up quantity.

### Stock

**`stock_quants`** — the on-hand table. `productId` + `locationId` unique
together, plus `quantity`. **Written only by `applyMove`.**

**`stock_moves`** — the ledger. `productId`, `quantity`, `sourceLocationId`,
`destLocationId`, `reference`, optional `pickingId` / `adjustmentId`,
`createdById`, `movedAt`. **Append-only: never updated, never deleted.**

### Documents

**`pickings`** — one table for all three document types. `reference` (unique),
`type` (`RECEIPT` / `DELIVERY` / `INTERNAL`), `status`, `partnerName`,
`sourceLocationId`, `destLocationId`, `warehouseId`, `scheduledAt`,
`pickedAt`, `packedAt`, `validatedAt`, `note`, `createdById`.

> **Why pick and pack are timestamps, not statuses.** The problem statement
> describes a delivery as pick items, pack items, validate — but it also fixes
> the status list the dashboard filters by at Draft / Waiting / Ready / Done /
> Canceled. Adding PICKED and PACKED would contradict that list, so the two
> preparation steps are recorded as timestamps inside READY. Neither moves
> stock.

**`picking_lines`** — `pickingId`, `productId`, `demandQty`, `doneQty`.
`@@unique([pickingId, productId])` so a product cannot appear twice.

> **Demand vs done.** Demand is what was ordered; done is what actually moves.
> Done defaults to demand and can be trimmed for a partial receipt or shipment.

**`adjustments`** — `reference`, `status`, `locationId`, `note`, `validatedAt`.

**`adjustment_lines`** — `systemQty` (snapshot taken at validation),
`countedQty`. The difference is what moves.

**`document_sequences`** — `prefix` (primary key, e.g. `WH/IN`), `next`.
Incremented atomically inside the same transaction that creates the document.

> Deriving the reference from `COUNT(*)` would hand the same number to two
> people validating at the same moment — which, during a live demo, is exactly
> when it would happen.

### Status lifecycle

```
DRAFT ──check availability──> READY ──validate──> DONE
  │                             │                   │
  │                          WAITING             immutable
  │                     (not enough stock)
  └──cancel──> CANCELED ──reset──> DRAFT
```

`DONE` is terminal. A validated document cannot be edited, cancelled or deleted —
its movements are already in the ledger. Correct it with another document.

---

## 8. Library layer (`src/lib/`)

### `stock.ts` — 168 lines · **the most important file**

```ts
export async function applyMove(tx: Tx, move: MoveInput) {
  if (move.quantity.lessThanOrEqualTo(0)) throw new StockError(...);
  if (move.sourceLocationId === move.destLocationId) throw new StockError(...);

  await adjustQuant(tx, move.productId, move.sourceLocationId, move.quantity.negated());
  await adjustQuant(tx, move.productId, move.destLocationId, move.quantity);

  return tx.stockMove.create({ data: { ... } });
}
```

`adjustQuant` upserts with a database-level `increment` (so concurrent
validations cannot lose updates), then checks the result: if the location is
`INTERNAL` and the quantity went below zero, it throws — which aborts the whole
surrounding transaction.

Also exports `virtualLocationId()`, `onHandByProduct()`, `onHandByLocation()`,
`onHandAt()` and `stockLevel()`.

**Every caller must pass a transaction client.** A half-validated document would
leave the ledger and the quantities disagreeing — the one state this model must
never reach.

### The rest

| File | Lines | Purpose |
|---|---|---|
| `refs.ts` | 37 | `nextReference(tx, prefix)` — atomic upsert on `document_sequences`, formats `WH/IN/00001`. |
| `db.ts` | 27 | Prisma singleton with the `PrismaPg` adapter, cached on `globalThis` in dev so hot reload doesn't open a new pool per edit. |
| `env.ts` | 47 | Zod-validated environment, parsed once at import. A missing `AUTH_SECRET` fails at boot with a readable message, not as a mystery 500 on the login form. |
| `errors.ts` | 13 | `StockError` alone, with **zero imports** — so it can be referenced from code reachable by the browser without dragging Prisma along. |
| `auth.ts` | 74 | `startSession`, `endSession`, `getCurrentUser` (wrapped in React `cache`, so one render = one query), `requireUser`, `requireManager`. |
| `session.ts` | 50 | JWT sign/verify with `jose`. **No bcrypt, no Prisma** — `proxy.ts` runs on the Edge runtime and cannot import those. The token carries only the user id. |
| `password.ts` | 13 | bcrypt hash/verify, **no Next.js imports** — so `prisma/seed.ts` can reuse the app's real hashing instead of reimplementing it. |
| `otp.ts` | 60 | Issues and consumes reset codes. Issuing a new one consumes the old; consuming burns the code in the same `updateMany` that verifies it, so it cannot be used twice. |
| `mailer.ts` | 48 | Nodemailer. **Without SMTP configured, prints the code to the server console** — so `npm run dev` works with no mail setup and a demo never depends on email arriving. |
| `validators.ts` | 193 | Every Zod schema. Quantities capped to fit `DECIMAL(14,3)`; SKUs uppercased and pattern-checked; document lines reject duplicate products. |
| `forms.ts` | 65 | `toFormState(error)` maps `ZodError` → field errors, `StockError` → its message, Prisma `P2002`/`P2003`/`P2025` → readable text, **anything else → logged server-side and replaced with a generic line.** |
| `form-state.ts` | 25 | The `FormState` type and `initialFormState`. Zero imports, so client components use this instead of `forms.ts`. |
| `enums.ts` | 60 | Plain copies of the Prisma enums, typed `as const satisfies Record<T, T>` so they cannot drift from the schema. Saves 46 KB in the browser. |
| `utils.ts` | 78 | `cn()`, `formatQty`, `formatMoney` (INR), `formatDate`, `formatDateTime`, `uomLabel`. |
| `rate-limit.ts` | 106 | Fixed-window limiter plus `clientIp()`. Every budget is declared in one `LIMITS` object. In-memory, so it limits per instance — documented in the file. |

### Three deliberate file splits

Each exists to solve a real bundling problem:

| Split | Why |
|---|---|
| `errors.ts` out of `stock.ts` | `forms.ts` needs `StockError`; importing it from `stock.ts` pulled Prisma, `pg` and the DB URL into the **browser bundle**. Build failed with `module not found: pg`. |
| `session.ts` out of `auth.ts` | `proxy.ts` runs on Edge and cannot load bcrypt or Prisma. Session verification needed to be importable there. |
| `password.ts` out of `auth.ts` | `prisma/seed.ts` runs under plain `tsx`, where `next/headers` and `next/navigation` do not exist. |

---

## 9. Server layer (`src/server/`)

Three folders, three jobs.

### `services/` — the inventory rules

Plain async functions taking a `userId`. **No cookies, no `revalidatePath`, no
request.** That is what makes them callable from a script — and why
`npm run verify` can prove the engine rather than just the pages.

**`services/pickings.ts`** (303 lines) — `createPicking`, `updatePicking`,
`checkAvailability`, `validatePicking`, `cancelPicking`, `resetPickingToDraft`,
`deletePicking`, plus `assertLocationsUsable`.

`assertLocationsUsable` is the security boundary: it re-checks that locations
belong to the document's warehouse and that the document type matches the
location types. Without it, editing a hidden form field could point a delivery
at another warehouse's rack.

**`services/adjustments.ts`** (193 lines) — the same shape for counts, plus
`locationCountSheet()` which pre-fills a count with current stock.

### `actions/` — the `"use server"` boundary

Thin by design: **authenticate → parse → delegate → revalidate → map errors.**

| File | Lines | Exports |
|---|---|---|
| `auth.ts` | 247 | signup, login, logout, request reset, reset, update profile, change password |
| `products.ts` | 199 | create, update, save/delete reorder rule, archive toggle |
| `pickings.ts` | 156 | create, update, check availability, validate, cancel, reset, delete |
| `adjustments.ts` | 125 | the same seven for counts |
| `settings.ts` | 205 | warehouses, locations, categories — all `requireManager` |

> **The redirect trap.** `redirect()` throws a special `NEXT_REDIRECT` error. A
> `try/catch` around it would swallow the navigation. Every action here assigns
> the destination inside the `try` and calls `redirect()` **after** it.

### `queries/` — read models

| File | Lines | Purpose |
|---|---|---|
| `products.ts` | 170 | `listProducts` with search/category/warehouse/level filters, `sumOnHand`, `listProductsNeedingReorder`, `listCategories`. |
| `documents.ts` | 324 | `listPickings`, `getPicking`, `listAdjustments`, `getAdjustment`, `listMoves`, plus reference data for dropdowns. Converts every `Decimal` to `number` at the boundary so results cross to client components cleanly. |
| `dashboard.ts` | 168 | `getDashboardData` (all 5 KPIs + recent documents) and `getLocationTotals`. |

---

## 10. Routes (`src/app/`)

29 routes. Two route groups: `(auth)` for signed-out, `(app)` for signed-in.
Route groups do not appear in the URL — they exist to give each half its own layout.

### Root

| File | Lines | Purpose |
|---|---|---|
| `layout.tsx` | 40 | Geist fonts, metadata template, and an inline script that applies the stored theme **before first paint** (otherwise the page renders light then flips). |
| `globals.css` | 130 | Design tokens in OKLCH for light and dark, `@theme inline` mapping, `@custom-variant dark`. |
| `page.tsx` | 7 | Redirects to `/dashboard`. |

### `(auth)` — signed out

| Route | Files | Notes |
|---|---|---|
| `layout.tsx` | 69 | Split screen: brand panel left (hidden on phones), form right. |
| `/login` | `page.tsx` 38 + `login-form.tsx` 61 | Server page reads `?next=`; client form handles state. Demo credentials shown on the card. |
| `/signup` | 95 | Name, email, role, password. |
| `/forgot-password` | 63 | Requests an OTP. Always reports success. |
| `/reset-password` | 101 | Six-digit code + new password. |

### `(app)` — signed in

| Route | Lines | What it does |
|---|---|---|
| `layout.tsx` | 21 | `requireUser()` — the second gate after `proxy.ts` — loads the low-stock count and renders `AppShell`. |
| `/dashboard` | 351 | 5 KPI tiles, 4 filters, recent documents, reorder alerts, stock-by-location bars. |
| `/products` | 186 | Table with SKU/name search, category, warehouse, stock level, archived. Footer shows total units and stock value at cost. |
| `/products/new` | 39 | Form + optional opening stock. |
| `/products/[id]` | 327 | 4 stat tiles, stock per location, move history, edit form, reorder rules, archive. |
| `/receipts` etc. | 12 / 10 / 11 / 11 | **Four thin files each** — all three document types share the same components. |
| `/adjustments` | 137 | List. |
| `/adjustments/new` | 87 | Location picker (URL-driven, so the server can pre-fill the count sheet) + editor. |
| `/adjustments/[id]` | 206 | System vs counted vs difference, corrections written, summary. |
| `/moves` | 198 | The ledger: 6 filters, virtual locations in italics, links back to source documents. |
| `/settings/warehouses` | 89 | Manager-only. Warehouses, locations, and the virtual-location explainer. |
| `/settings/categories` | 30 + 107 | Manager-only. |
| `/profile` | 103 + 125 | Stats, details form, password change, role explainer. |

### Why receipts, deliveries and transfers are 10-line files

```tsx
// src/app/(app)/receipts/page.tsx — the whole file
export default async function Page({ searchParams }: PageProps<"/receipts">) {
  return <PickingListPage config={PICKING_CONFIG.RECEIPT} searchParams={await searchParams} />;
}
```

Everything that legitimately differs between the three lives in
`components/documents/config.ts`: the route, the titles, whether there is a
partner and what it is called, which end is virtual, the empty-state copy. The
behaviour is written once.

---

## 11. Components (`src/components/`)

### `ui/` — the primitives

| File | Lines | Notes |
|---|---|---|
| `button.tsx` | 40 | CVA: 5 variants × 4 sizes. Exports `Button` and `ButtonLink`. |
| `field.tsx` | 93 | `Input`, `Textarea`, `Select`, and `Field` (label + control + message). The message slot **always renders**, so a row of fields doesn't shift when one becomes invalid. |
| `badge.tsx` | 70 | `Badge`, `StatusBadge` (5 document statuses), `StockBadge` (3 stock levels). |
| `card.tsx` | 96 | `Card`, `CardHeader`, `CardBody`, `PageHeader`, `EmptyState`. |
| `table.tsx` | 68 | `TableShell` gives each table its own horizontal scroll container, so a wide document never makes the page scroll sideways. |
| `alert.tsx` | 48 | 4 tones with icons. `role="alert"` for errors. |
| `submit-button.tsx` | 31 | `useFormStatus` — disables while submitting, which also prevents the double-click that would validate a document twice. |

### `layout/`

**`app-shell.tsx`** (174) — sidebar, mobile drawer, topbar, low-stock badge,
account block. Imports `navFor(role)` itself, so nav icons stay client-side.
Closes the mobile drawer in the link's `onClick` rather than in an effect.

**`theme-toggle.tsx`** (32) — no React state at all. Which icon shows is decided
by CSS from the `dark` class, avoiding a hydration mismatch.

### `documents/`

| File | Lines | Purpose |
|---|---|---|
| `config.ts` | 80 | The `PICKING_CONFIG` table — everything that differs between the three types. |
| `line-editor.tsx` | 430 | `ProductPicker` (SKU + name search), `PickingLineEditor` (demand/done), `AdjustmentLineEditor` (system/counted/live difference). Rows serialise to JSON in one hidden input. |
| `picking-form.tsx` | 262 | Create/edit. Warehouse change cascades the location dropdowns; the virtual end is shown read-only. |
| `picking-list-page.tsx` | 151 | Shared list with search, status and warehouse filters. |
| `picking-detail-page.tsx` | 229 | Status flow strip, line table with totals, the movements the validation wrote. |
| `picking-pages.tsx` | 104 | `PickingNewPage` and `PickingEditPage`. Redirects away from editing a validated document. |
| `picking-actions.tsx` | 92 | Validate / check availability / edit / cancel / reset / delete, by status. |
| `adjustment-form.tsx` | 91 | Count sheet + note. |
| `adjustment-actions.tsx` | 71 | Apply / edit / cancel / reset / delete. |

### Shared

**`action-button.tsx`** (95) — `ActionGroup` owns one result message via context;
`ActionButton` runs a server action in a transition, with two-step confirm for
destructive ones. A global toast would put "Not enough stock in WH/Stock"
somewhere other than where the user just clicked.

**`filters.tsx`** (177) — `FilterSelect`, `SearchInput` (300 ms debounce),
`DateFilter`, `FilterBar`. **Filters live in the URL**, so a filtered view can be
linked, bookmarked and reloaded — which is how the dashboard deep-links into
"products that are low on stock".

**`kpi-tile.tsx`** (56) — optionally a link.

**`products/product-form.tsx`** (222), **`products/reorder-rules.tsx`** (148),
**`settings/warehouse-manager.tsx`** (233).

---

## 12. How a request flows, end to end

Validating a receipt:

```
1. Browser      user clicks "Validate receipt"
                  │
2. ActionButton  starts a transition, calls validatePickingAction(id)
                  │  (React sends an RPC to the server — no fetch, no API route)
                  │
3. actions/      requireUser()  ─── reads the session cookie
   pickings.ts                       verifies the JWT
                                     loads the user from the database
                  │
4. services/     validatePicking(userId, id)
   pickings.ts     └─ prisma.$transaction:
                        ├─ load picking + lines
                        ├─ reject if DONE / CANCELED / no lines
                        ├─ for each line with doneQty > 0:
                        │     applyMove(tx, ...)
                        │       ├─ decrement source quant
                        │       ├─ increment dest quant
                        │       ├─ throw if an INTERNAL location went negative
                        │       └─ insert the stock_moves row
                        └─ set status = DONE, validatedAt = now
                  │
5. actions/      revalidatePath("/receipts", "/dashboard", "/moves", "/products")
                 return formSuccess("WH/IN/00003 validated. 2 movements recorded.")
                  │
6. Browser       ActionGroup renders the message; the page re-renders with new data
```

**If step 4 throws**, the transaction rolls back completely — no quants changed,
no moves written, document untouched — and the error surfaces as a readable
message next to the button.

---

## 13. Authentication and authorisation

### Sessions

1. Login verifies the password with bcrypt.
2. `jose` signs a JWT containing **only the user id**, with issuer and audience claims.
3. It is set as an `httpOnly`, `sameSite=lax` cookie, `secure` in production, 7 days.
4. `proxy.ts` verifies it on every request at the edge.
5. `getCurrentUser()` loads the user fresh from the database each render.

> The token carries only the id, so **revoking a manager takes effect
> immediately** rather than when their cookie happens to expire.

### Two gates

| Gate | Where | Does what |
|---|---|---|
| `proxy.ts` | Edge, every request | Anonymous → `/login?next=…`. Signed-in on an auth page → `/dashboard`. |
| `requireUser()` | `(app)/layout.tsx` | Second check, so every page under `(app)` is safe on its own. |
| `requireManager()` | Manager-only pages and actions | → `/dashboard?denied=managers-only`. |

Hiding a nav link is presentation. `requireManager` is the enforcement.

### OTP password reset

1. `/forgot-password` → `issueOtp()` generates 6 digits with `crypto.randomInt`.
2. Only the **bcrypt digest** is stored. Previous unconsumed codes are burned.
3. Emailed, or printed to the console when SMTP is not configured.
4. `/reset-password` verifies and burns the code in one `updateMany` guarded on
   `consumedAt: null` — so two simultaneous requests cannot both succeed.

> The form **always reports success**, whether or not the email exists, so it
> cannot be used to discover which addresses have accounts. Login likewise gives
> one message for both failure modes.

---

## 14. The four operations, step by step

### Receipt

1. `/receipts/new` — supplier, destination, product lines. Source is fixed to
   `Partners/Vendors`.
2. Saved as `DRAFT` with reference `WH/IN/00001`.
3. **Validate** → one `applyMove` per line, Vendors → destination.
4. Stock increases. `Partners/Vendors` goes further negative.

### Delivery order

1. `/deliveries/new` — customer, source location, lines. Destination fixed to
   `Partners/Customers`.
2. **Check availability** → `READY` if everything is on the shelf, `WAITING` if not.
3. **Mark picked** → items are off the shelf. Timestamp only; no stock moves.
4. **Mark packed** → ready to despatch. Packing implies picking, so a warehouse
   doing both at once can press one button.
5. **Validate** → source → Customers. If any line exceeds what is there, the
   whole thing is refused and nothing is written.

The strip on the document reads **Draft → Picked → Packed → Shipped** for
deliveries, and **Draft → Ready → Received/Transferred** for the other two.

### Internal transfer

Both ends are real locations. Total on-hand is unchanged — only the location moves.

### Inventory adjustment

1. `/adjustments/new` — pick a location; the sheet is **pre-filled** with current stock.
2. Enter counted quantities; the difference updates live.
3. **Apply** → for each line, the system quantity is **read again**, stored on
   the line as a snapshot, and the difference moved:
   - counted > system → `Virtual/Adjustment` → location (surplus)
   - counted < system → location → `Virtual/Adjustment` (shortage)
   - equal → nothing

> Re-reading at apply time means a movement between opening the sheet and
> applying it cannot be silently overwritten.

---

## 15. Design system

**Colour** — warm bone paper, warm ink, and brass. OKLCH tokens on `:root`,
redefined under `.dark`, exposed through `@theme inline`.

The neutrals carry a little yellow rather than the usual blue, which is what
stops a dense data screen reading cold. There are **two** emphasis colours
rather than one: **ink** for anything solid you press, and **brass** for
anything live — the current page, a link, a focus ring. Keeping those apart
means a screen full of tables has exactly one warm highlight drawing the eye.
In dark mode the solid button inverts to light-on-dark and the brass lifts.

Status keeps its own family (green / amber / red), desaturated so it reads as
information rather than decoration.

Every foreground/background pair was checked against WCAG: **all pass AA in
both themes**, most at AAA. The brass and amber were darkened in light mode
specifically to clear 4.5:1.

**Typography** — three faces with distinct jobs. **Instrument Serif** for page
titles and the wordmark only, so the serif reads as a masthead rather than
decoration; **Geist Sans** for everything operational; **Geist Mono** for SKUs,
references and quantities, with `.tabular` applying `font-variant-numeric:
tabular-nums` so columns of digits do not jitter.

**Depth** — two soft layered shadows and hairline borders. Cards and tables use
a 12px radius, controls 8px.

**Dark mode** — class-based on `<html>`, defaulting to the OS preference, with an
inline script applying it before first paint.

**Responsive** — sidebar becomes a drawer below `lg`, tables scroll inside their
own containers, filter bars wrap.

**Accessibility** — visible focus rings, `aria-invalid` on bad fields,
`role="alert"` on errors, `sr-only` labels on icon buttons, `prefers-reduced-motion`
honoured.

---

## 16. Testing and verification

### `scripts/verify-flow.ts` — 28 checks

Drives the **real services** through the problem statement's scenario, on a
throwaway SKU, cleaning up after itself.

```
Step 1 — receive 100 kg      → WH/Stock 100, vendor −100, ref matches WH/IN/#####
Step 2 — transfer to rack    → availability READY, Stock 0, Production 100
Step 3 — deliver 20          → Production 80, customers 20
Step 4 — count 77            → 1 product corrected, Production 77, ref ADJ/#####
Ledger                       → exactly 4 movements

Delivery prep  mark picked, mark packed, no stock moves until validate

Guard rails
  over-delivery refused · stock untouched · no partial movements written
  document still DRAFT · availability marks it WAITING
  double validation refused · cancelling a validated document refused
  a receipt from a real location refused · picking a receipt refused
  counting a virtual location refused

Accounting identity
  every location sums to zero · real locations hold 77
```

### `scripts/verify-security.ts` — 20 checks

```
Rate limiting     attempt over the limit blocked - retry delay reported
                  a correct password clears the lockout
                  other accounts keep their own budget
                  reset-code guessing capped at 5 - window expiry honoured

Session tokens    valid token round-trips - missing rejected - garbage rejected
                  tampered signature rejected
                  token signed with another key rejected

Password hashing  hash is not the password - bcrypt digest
                  right password verifies - wrong one does not - salted
```

### A regression these caught

Adding a blanket `loading.tsx` under `(app)` opened a Suspense boundary, which
makes Next.js start streaming — and the HTTP status is fixed at 200 once the
first byte is sent. Every missing record then answered **200 instead of 404**,
while still rendering the correct Not-found page, so it was invisible in a
browser. Skeletons now live only on segments with no `notFound()` beneath
them, and the constraint is written down in `components/ui/skeleton.tsx`.

### What was verified during the build

- `npm run build` — 29 routes compile
- `npm run typecheck` — clean, no `any`, no suppressions
- `npm run lint` — clean, including React 19 rules
- All 29 routes return 200 with a real session
- Anonymous requests redirect; tampered cookies rejected
- Staff bounced from `/settings/*`; manager links hidden from their sidebar
- **Client bundle audited**: no `DATABASE_URL`, `AUTH_SECRET`, bcrypt, Prisma
  adapter or Prisma metadata in any chunk
- **Security headers served**: all five present on a live response
- **Status codes correct**: 404 for a missing record on every detail route,
  200 for every real one

---

## 17. Scripts reference

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | The 28-check inventory-flow verification |
| `npm run verify:security` | The 20-check security verification |
| `npm run verify:all` | Both |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:migrate` | Create and apply a migration (dev) |
| `npm run db:deploy` | Apply existing migrations (CI, production) |
| `npm run db:seed` | Seed demo data — idempotent |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:studio` | Prisma Studio |

The seed and verify scripts run as:

```
tsx --env-file=.env --conditions=react-server <script>
```

`--env-file` because Prisma 7 and plain Node do not read `.env`;
`--conditions=react-server` because those scripts import modules guarded by
`server-only`, which throws unless that condition is set.

---

## 18. Known constraints

**Not built** (outside the problem statement): barcode scanning, purchase
orders, supplier/customer master records, batch and serial tracking, landed
costs, stock valuation reports, audit trail of edits, pagination beyond the
300-row ledger cap, automated tests beyond `verify-flow`.

**`npm audit`** reports 4 findings, all in the Prisma **CLI's** dependency tree
(`mysql2`, which this project does not use, and a config-merge package). They
are devDependencies, absent from the runtime bundle, and `audit fix --force`
would downgrade to the Prisma 8 release candidate — which is worse.

**Concurrency** is handled where it matters: quantity updates use database-level
increments, reference allocation is an atomic upsert, and OTP consumption is
guarded on `consumedAt: null`. There is no optimistic locking on document
*edits* — two people editing the same draft simultaneously, last write wins.

**Decimal at the boundary.** Prisma `Decimal` objects are not serialisable across
the React Server Component boundary, so query functions convert to `number`
before returning. Precision is preserved in the database and in all arithmetic;
the conversion happens only for display.

---

## 19. Requirements traceability

Every line of the problem statement, and where it is implemented. This is the
table to read with the PDF open beside it.

### Authentication

| Requirement | Where |
|---|---|
| The user signs up / logs in | `/signup`, `/login` · `server/actions/auth.ts` |
| OTP-based password reset | `/forgot-password`, `/reset-password` · `lib/otp.ts`, `lib/mailer.ts` |
| Redirected to Inventory Dashboard | `proxy.ts` and `app/page.tsx` both send you to `/dashboard` |

### Dashboard KPIs

| Requirement | Where |
|---|---|
| Total Products in Stock | `getDashboardData` → `productsInStock`, with total units and product count |
| Low Stock / Out of Stock Items | Two separate tiles, driven by `stockLevel()` against each reorder rule |
| Pending Receipts | Count of `RECEIPT` documents in Draft / Waiting / Ready |
| Pending Deliveries | Same for `DELIVERY` |
| Internal Transfers Scheduled | Same for `INTERNAL`, shown on the deliveries tile |

### Dynamic filters

| Requirement | Where |
|---|---|
| By document type: Receipts / Delivery / Internal / Adjustments | `?type=` — all four, adjustments included |
| By status: Draft, Waiting, Ready, Done, Canceled | `?status=` — exactly these five, and no others were added |
| By warehouse **or location** | `?warehouse=` and `?location=`; location is the narrower and wins |
| By product category | `?category=` |

All four live in the URL, so a filtered dashboard can be bookmarked and shared.

### Navigation

| Requirement | Where |
|---|---|
| Products: create/update | `/products/new`, `/products/[id]` |
| Products: stock availability per location | `onHandByLocation()` table on the product page |
| Products: product categories | `/settings/categories` |
| Products: reordering rules | Per warehouse, on the product page |
| Operations: Receipts | `/receipts` |
| Operations: Delivery Orders | `/deliveries` |
| Operations: Inventory Adjustment | `/adjustments` |
| Operations: Move History | `/moves` |
| Operations: Dashboard | `/dashboard` |
| Setting: Warehouse | `/settings/warehouses`, with locations |
| Profile menu: My Profile | `/profile`, in the sidebar footer |
| Profile menu: Logout | Sidebar footer and the profile page |

### Core features

| Requirement | Where |
|---|---|
| Product: Name, SKU/Code, Category, Unit of Measure | `productSchema` and the product form |
| Product: Initial stock (optional) | Opening-stock fields, booked through `applyMove` so the ledger explains it |
| Receipt: create, add supplier and products, input quantities, validate → stock increases | `/receipts/new` → **Validate** |
| Receive 50 units of Steel Rods → stock +50 | Exactly what `npm run verify` step 1 asserts (with 100 kg) |
| Delivery: **pick items** | **Mark picked** — records `pickedAt`, moves no stock |
| Delivery: **pack items** | **Mark packed** — records `packedAt` |
| Delivery: validate → stock decreases | **Validate**, refused if the shelf cannot cover it |
| Internal transfers: Main → Production, Rack A → Rack B, WH1 → WH2 | `/transfers`, any two internal locations in the warehouse |
| Each movement logged in the ledger | `StockMove`, append-only, written only by `applyMove` |
| Adjustments: select product/location, enter counted quantity, auto-update and log | `/adjustments/new`, pre-filled count sheet |

### Additional features

| Requirement | Where |
|---|---|
| Alerts for low stock | Topbar badge, dashboard panel, product badges |
| Multi-warehouse support | Two warehouses seeded; every document, rule and filter is warehouse-aware |
| SKU search and smart filters | SKU search on `/products`, in the line editor, and filter bars on every list |

### The worked example, end to end

The PDF's four-step example is not just implemented — it is the automated test.
`npm run verify` runs it on every invocation:

| PDF step | Assertion |
|---|---|
| Receive 100 kg steel → +100 | `WH/Stock` holds 100, vendor location shows −100 |
| Internal transfer to production rack → total unchanged, location updated | `WH/Stock` 0, `WH/Production` 100 |
| Deliver 20 → −20 | `WH/Production` 80, customers 20 |
| Adjust 3 damaged → −3 | `WH/Production` 77 |
| Everything logged in the Stock Ledger | Exactly four movements recorded |

### Deliberately not added

The PDF fixes the status list at Draft / Waiting / Ready / Done / Canceled, so
`PICKED` and `PACKED` were **not** added as statuses even though the delivery
process names those steps — they are timestamps inside `READY` instead. Adding
them would have broken the status filter the same document asks for.

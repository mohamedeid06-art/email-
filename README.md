# Bulk Email Alias Manager (`AliasForge`)

A full-stack dark SaaS dashboard built with **Next.js (App Router) + TypeScript** and **PostgreSQL** to provision, route, search, audit, and export bulk email aliases integrated with the official **SimpleLogin API**.

---

## Core Features

1. **Linear & Raycast-Inspired Dark SaaS Interface**
   - Deep navy/obsidian surfaces (`#060911` / `#0B101B`), 1px translucent hairline borders, subtle glassmorphism, and keyboard ergonomics (`⌘K` to search, `Alt+G` to focus bulk generator, `Alt+C` for API settings).
2. **Secure Server-Side SimpleLogin API Integration**
   - Connects to the official SimpleLogin API (`https://app.simplelogin.io` or self-hosted URL) using the `Authentication` header.
   - **Zero Frontend Key Exposure**: API keys are encrypted at rest in PostgreSQL using **AES-256-GCM** (`src/lib/crypto.ts`) and never returned to the browser (only a masked preview such as `sl_••••••••••••8f2a` is shown).
   - **Rate-Limit & Error Handling**: Automatic `HTTP 429 Too Many Requests` detection with `Retry-After` parsing, exponential backoff with jitter, and sequential batch pacing (`220ms` interval) so requests respect provider rate limits.
   - **Dual Execution Modes**: Supports **Live SimpleLogin API Mode** and a built-in **Sandbox Provider Simulator** for immediate testing with full PostgreSQL persistence.
3. **Primary Forwarding Email Configuration**
   - Enter and update your primary destination email address, or pick from verified SimpleLogin mailboxes fetched from `GET /api/v2/mailboxes`.
4. **Provider Quota & Permitted Limit Enforcement**
   - Queries `GET /api/user_info` (`is_premium`, `in_trial`, `max_alias_free_plan`) and `GET /api/v5/alias/options` (`can_create`, `suffixes`).
   - Strictly enforces the user's remaining free-plan quota or rate-safe per-batch cap in both the UI slider/input and server API validation.
5. **Official API Alias Generation Modes**
   - **Random Words**: `POST /api/alias/random/new?mode=word`
   - **UUID Token**: `POST /api/alias/random/new?mode=uuid`
   - **Custom Prefix Pattern**: `POST /api/v3/alias/custom/new` using cryptographically signed `signed_suffix` tokens and `mailbox_ids`.
6. **Searchable, Sortable, Paginated Alias Directory**
   - Instant search across alias address, primary forwarding email, domain, display label, notes, and batch ID.
   - Filter by creation status (`All`, `Active`, `Disabled`, `Failed`), domain suffix, or generation batch.
   - Sort by Alias Email, Status, Forwarding Email, Activity (`nb_forward`), or Created timestamp.
   - Pagination with customizable page sizes (`10`, `25`, `50`, `100`).
7. **Excel (`.xlsx`) and CSV (`.csv`) Exports**
   - Export all filtered aliases or specifically selected rows to formatted `.xlsx` workbooks or UTF-8 BOM `.csv` files via `/api/aliases/export`.
8. **Single & Bulk Alias Management**
   - Enable/disable forwarding (`POST /api/aliases/:id/toggle`), edit forwarding target and audit notes, or delete aliases (`DELETE /api/aliases/:id`) individually or in bulk via the floating command bar.

---

## Architecture & Database

- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend**: Next.js TypeScript Route Handlers (`src/app/api/...`).
- **Database**: PostgreSQL (`db/schema.sql`).
  - Connects to any external PostgreSQL instance via `DATABASE_URL` (`pg.Pool`).
  - Automatically falls back to an embedded persistent **PostgreSQL 16** cluster (`@electric-sql/pglite` stored in `./data/postgres`) when `DATABASE_URL` is not set, so the app runs out-of-the-box with genuine PostgreSQL SQL (`JSONB`, `TIMESTAMPTZ`, `ILIKE`, `ON CONFLICT`, indexes).

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Start external PostgreSQL via Docker Compose
# If skipped, the app automatically uses the built-in persistent PostgreSQL 16 engine in ./data/postgres
docker compose up -d

# 3. Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

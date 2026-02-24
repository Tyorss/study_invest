# Daily Paper Trading Journal (KRW Base)

A lightweight paper-trading journal for a 10-person competition.

## Product Direction

This app is intentionally simple:

- Every trade is entered manually with an explicit price.
- No order engine (no MARKET/LIMIT/STOP queue processing).
- Portfolio is record-first: trades are the source of truth.
- Taxes, fees, and slippage are not applied by default.
- US trades require USDKRW FX for that trade date (or latest prior date).
- Daily snapshots are used to view portfolio change over time.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres)
- API routes for trade entry, cron ingestion, and CSV export
- Market data provider chain (`TWELVE`, `YAHOO`) with fallback

## Core Flow

1. Submit manual trade via `POST /api/trades`
2. App stores trade directly in `trades`
3. For US instrument trades, app validates USDKRW availability for the trade date
4. Daily jobs update market data and snapshots
5. Leaderboard and participant pages read from `daily_snapshots`

## Database

Apply migrations in order:

- `migrations/0001_init.sql` (required)
- `migrations/0002_participant_notes.sql` (required)
- `migrations/0003_order_execution_and_actions.sql` (legacy/optional)

Required tables for current primary flow:

- `participants`
- `portfolios`
- `instruments`
- `prices`
- `fx_rates`
- `trades`
- `daily_snapshots`
- `participant_notes`
- `participant_note_lines`
- `job_runs`
- `settings`

Notes:

- Legacy order/corporate-action tables can exist, but the core journal flow does not depend on them.
- `daily_snapshots` uses `unique(participant_id, date)`.

## Valuation Rules

Implemented in `lib/engine/snapshot.ts`.

- Rebuild positions in chronological trade order from `trades`
- `BUY` cannot make KRW cash negative
- `SELL` and `CLOSE` cannot exceed current holdings
- `CLOSE` exits full current quantity
- US valuation uses USDKRW on or before each relevant date
- If close price is missing, valuation falls back to average cost

## Cron Jobs

Secured by `CRON_SECRET`:

- `GET/POST /api/cron/update-prices`
- `GET/POST /api/cron/update-fx`
- `GET/POST /api/cron/generate-snapshots`
- `GET/POST /api/cron/run-daily` (runs all 3)

Auth options:

- `x-cron-secret: <CRON_SECRET>`
- `Authorization: Bearer <CRON_SECRET>`
- `?secret=<CRON_SECRET>`

## Backfill

```bash
npm run backfill -- prices 2026-01-01 2026-02-20
npm run backfill -- fx 2026-01-01 2026-02-20
npm run backfill -- snapshots 2026-01-01 2026-02-20
npm run backfill -- all 2026-01-01 2026-02-20
```

Daily run locally:

```bash
npm run cron:daily -- 2026-02-22
```

## Environment Setup

Set `.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `MARKET_DATA_PROVIDERS=TWELVE,YAHOO` (recommended)
- `MARKET_DATA_PROVIDER` (optional legacy single provider)
- `TWELVE_DATA_API_KEY` (required when using `TWELVE`)
- `MARKET_HOLIDAYS_KR` (optional)
- `MARKET_HOLIDAYS_US` (optional)

## Run

```bash
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```

From Windows browser, open:

- `http://localhost:3000`

## Main UI

- `/`: leaderboard and risk metrics from `daily_snapshots`
- `/participants/[participantId]`: trade journal, manual trade entry, holdings, charts, notes
- CSV export: `/api/participants/[participantId]/export`

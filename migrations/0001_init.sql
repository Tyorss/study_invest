create extension if not exists pgcrypto;

create table if not exists settings (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_tag text not null,
  starting_cash_krw numeric(20,2) not null default 10000000000,
  created_at timestamptz not null default now()
);

create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references participants(id) on delete cascade,
  base_currency text not null default 'KRW',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_portfolio_base_ccy check (base_currency in ('KRW'))
);

create table if not exists instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  market text not null,
  currency text not null,
  asset_type text not null default 'EQUITY',
  provider_symbol text not null,
  is_active boolean not null default true,
  is_benchmark boolean not null default false,
  benchmark_code text null,
  created_at timestamptz not null default now(),
  constraint chk_market check (market in ('KR', 'US', 'INDEX')),
  constraint chk_currency check (currency in ('KRW', 'USD')),
  constraint chk_benchmark_code check (benchmark_code is null or benchmark_code in ('SPY', 'KOSPI')),
  constraint chk_benchmark_active check (not is_benchmark or is_active)
);

create table if not exists prices (
  id bigserial primary key,
  instrument_id uuid not null references instruments(id) on delete cascade,
  date date not null,
  close numeric(20,6) not null,
  source text not null default 'provider',
  created_at timestamptz not null default now(),
  unique (instrument_id, date)
);

create index if not exists idx_prices_inst_date on prices(instrument_id, date desc);
create index if not exists idx_prices_date on prices(date desc);

create table if not exists fx_rates (
  id bigserial primary key,
  pair text not null,
  date date not null,
  rate numeric(20,6) not null,
  source text not null default 'provider',
  created_at timestamptz not null default now(),
  unique (pair, date)
);

create index if not exists idx_fx_pair_date on fx_rates(pair, date desc);

create table if not exists trades (
  id bigserial primary key,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  instrument_id uuid not null references instruments(id),
  trade_date date not null,
  side text not null,
  quantity numeric(20,6) not null,
  price numeric(20,6) not null,
  fee_rate numeric(12,8) null,
  slippage_bps numeric(12,4) null,
  note text null,
  created_at timestamptz not null default now(),
  constraint chk_trade_side check (side in ('BUY', 'SELL', 'CLOSE')),
  constraint chk_trade_qty_nonneg check (quantity >= 0),
  constraint chk_trade_price_pos check (price > 0)
);

create index if not exists idx_trades_portfolio_date on trades(portfolio_id, trade_date, id);

create table if not exists daily_snapshots (
  id bigserial primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  date date not null,
  nav_krw numeric(20,2) not null,
  cash_krw numeric(20,2) not null,
  holdings_value_krw numeric(20,2) not null,
  realized_pnl_krw numeric(20,2) not null,
  unrealized_pnl_krw numeric(20,2) not null,
  total_return_pct numeric(12,8) not null,
  spy_return_pct numeric(12,8) null,
  kospi_return_pct numeric(12,8) null,
  alpha_spy_pct numeric(12,8) null,
  alpha_kospi_pct numeric(12,8) null,
  ret_daily numeric(12,8) null,
  vol_ann_252 numeric(12,8) null,
  sharpe_252 numeric(12,8) null,
  mdd_to_date numeric(12,8) not null,
  beta_spy_252 numeric(12,8) null,
  beta_kospi_252 numeric(12,8) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, date)
);

create index if not exists idx_snapshots_date on daily_snapshots(date desc);
create index if not exists idx_snapshots_participant_date on daily_snapshots(participant_id, date);

create table if not exists notes_market (
  id bigserial primary key,
  date date not null unique,
  title text null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_runs (
  id bigserial primary key,
  job_name text not null,
  target_date date not null,
  status text not null,
  error_message text null,
  metrics_json jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  constraint chk_job_status check (status in ('success', 'partial', 'failed'))
);

create index if not exists idx_job_runs_name_date on job_runs(job_name, target_date desc, run_at desc);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_settings_touch on settings;
create trigger trg_settings_touch
before update on settings
for each row
execute function touch_updated_at();

drop trigger if exists trg_snapshots_touch on daily_snapshots;
create trigger trg_snapshots_touch
before update on daily_snapshots
for each row
execute function touch_updated_at();

drop trigger if exists trg_notes_touch on notes_market;
create trigger trg_notes_touch
before update on notes_market
for each row
execute function touch_updated_at();

insert into settings (key, value_json)
values
  ('GAME_START_DATE', '{"date":"2026-01-01"}'::jsonb)
on conflict (key) do update
set value_json = excluded.value_json;

insert into participants (name, color_tag, starting_cash_krw)
values
  ('근거핑', '#FAD4D8', 10000000000),
  ('Gloria', '#D8EAFE', 10000000000),
  ('사이다맛떡', '#D8F5E3', 10000000000),
  ('노팬티', '#FEE7C8', 10000000000),
  ('천천히', '#E8D9FF', 10000000000),
  ('selfishmartyr', '#F9DDEB', 10000000000),
  ('적랑', '#D9F2FF', 10000000000),
  ('불광동불주먹', '#E9F7D2', 10000000000),
  ('밸런스', '#FFE3D8', 10000000000),
  ('911GT3RS', '#DDE5FF', 10000000000)
on conflict (name) do update
set color_tag = excluded.color_tag,
    starting_cash_krw = excluded.starting_cash_krw;

insert into portfolios (participant_id, base_currency, is_active)
select p.id, 'KRW', true
from participants p
on conflict (participant_id) do nothing;

insert into instruments (
  symbol, name, market, currency, asset_type, provider_symbol, is_active, is_benchmark, benchmark_code
)
values
  ('005930', 'Samsung Electronics', 'KR', 'KRW', 'EQUITY', '005930:KRX', true, false, null),
  ('000660', 'SK Hynix', 'KR', 'KRW', 'EQUITY', '000660:KRX', true, false, null),
  ('035420', 'NAVER', 'KR', 'KRW', 'EQUITY', '035420:KRX', true, false, null),
  ('069500', 'KODEX 200', 'KR', 'KRW', 'ETF', '069500:KRX', true, false, null),
  ('AAPL', 'Apple Inc', 'US', 'USD', 'EQUITY', 'AAPL', true, false, null),
  ('MSFT', 'Microsoft Corp', 'US', 'USD', 'EQUITY', 'MSFT', true, false, null),
  ('NVDA', 'NVIDIA Corp', 'US', 'USD', 'EQUITY', 'NVDA', true, false, null),
  ('SPY', 'SPDR S&P 500 ETF Trust', 'US', 'USD', 'ETF', 'SPY', true, true, 'SPY'),
  ('QQQ', 'Invesco QQQ Trust', 'US', 'USD', 'ETF', 'QQQ', true, false, null),
  ('KS11', 'KOSPI Index', 'INDEX', 'KRW', 'INDEX', 'KOSPI', true, true, 'KOSPI')
on conflict (symbol) do update
set name = excluded.name,
    market = excluded.market,
    currency = excluded.currency,
    asset_type = excluded.asset_type,
    provider_symbol = excluded.provider_symbol,
    is_active = excluded.is_active,
    is_benchmark = excluded.is_benchmark,
    benchmark_code = excluded.benchmark_code;

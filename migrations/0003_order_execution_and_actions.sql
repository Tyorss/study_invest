create table if not exists orders (
  id bigserial primary key,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  instrument_id uuid not null references instruments(id),
  trade_date date not null,
  side text not null,
  order_type text not null default 'MARKET',
  time_in_force text not null default 'DAY',
  requested_quantity numeric(20,6) not null,
  filled_quantity numeric(20,6) not null default 0,
  limit_price numeric(20,6) null,
  stop_price numeric(20,6) null,
  status text not null default 'PENDING',
  status_reason text null,
  note text null,
  created_by text not null default 'system',
  source text not null default 'api',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_orders_side check (side in ('BUY', 'SELL', 'CLOSE')),
  constraint chk_orders_type check (order_type in ('MARKET', 'LIMIT', 'STOP')),
  constraint chk_orders_tif check (time_in_force in ('DAY', 'GTC')),
  constraint chk_orders_qty_pos check (requested_quantity > 0),
  constraint chk_orders_filled_qty_nonneg check (filled_quantity >= 0),
  constraint chk_orders_status check (
    status in ('PENDING', 'REJECTED', 'PARTIAL', 'FILLED', 'CANCELED')
  ),
  constraint chk_orders_limit_logic check (
    (order_type <> 'LIMIT') or (limit_price is not null and limit_price > 0)
  ),
  constraint chk_orders_stop_logic check (
    (order_type <> 'STOP') or (stop_price is not null and stop_price > 0)
  )
);

create index if not exists idx_orders_portfolio_trade_date
  on orders(portfolio_id, trade_date desc, id desc);
create index if not exists idx_orders_status_trade_date
  on orders(status, trade_date desc, id desc);

drop trigger if exists trg_orders_touch on orders;
create trigger trg_orders_touch
before update on orders
for each row
execute function touch_updated_at();

create table if not exists order_fills (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  fill_date date not null,
  quantity numeric(20,6) not null,
  price numeric(20,6) not null,
  fill_policy text not null,
  provider_used text null,
  price_source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint chk_fills_qty_pos check (quantity > 0),
  constraint chk_fills_price_pos check (price > 0),
  constraint chk_fills_policy check (
    fill_policy in (
      'MANUAL',
      'CLOSE_ON_DATE',
      'NEXT_OPEN_PROXY',
      'LIMIT_TOUCH',
      'STOP_TRIGGER',
      'DELIST_PAYOUT'
    )
  ),
  constraint chk_fills_price_source check (
    price_source in ('manual', 'provider', 'carry_forward', 'corporate_action')
  )
);

create index if not exists idx_order_fills_order_id
  on order_fills(order_id, id asc);
create index if not exists idx_order_fills_fill_date
  on order_fills(fill_date desc, id desc);

create table if not exists corporate_actions (
  id bigserial primary key,
  instrument_id uuid not null references instruments(id) on delete cascade,
  action_date date not null,
  action_type text not null,
  split_from numeric(20,6) null,
  split_to numeric(20,6) null,
  cash_per_share numeric(20,6) null,
  payout_price numeric(20,6) null,
  note text null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument_id, action_date, action_type),
  constraint chk_corp_action_type check (action_type in ('SPLIT', 'DIVIDEND', 'DELIST')),
  constraint chk_corp_split check (
    (action_type <> 'SPLIT')
    or (split_from is not null and split_to is not null and split_from > 0 and split_to > 0)
  ),
  constraint chk_corp_dividend check (
    (action_type <> 'DIVIDEND')
    or (cash_per_share is not null and cash_per_share >= 0)
  ),
  constraint chk_corp_delist check (
    (action_type <> 'DELIST') or payout_price is null or payout_price >= 0
  )
);

create index if not exists idx_corp_actions_inst_date
  on corporate_actions(instrument_id, action_date asc, id asc);
create index if not exists idx_corp_actions_date
  on corporate_actions(action_date asc, id asc);

drop trigger if exists trg_corp_actions_touch on corporate_actions;
create trigger trg_corp_actions_touch
before update on corporate_actions
for each row
execute function touch_updated_at();

create table if not exists audit_logs (
  id bigserial primary key,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor text not null default 'system',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chk_audit_entity_type check (
    entity_type in ('ORDER', 'FILL', 'TRADE', 'CORP_ACTION', 'NOTES', 'SYSTEM')
  )
);

create index if not exists idx_audit_entity
  on audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_created_at
  on audit_logs(created_at desc, id desc);

alter table trades
  add column if not exists order_id bigint null references orders(id) on delete set null;
alter table trades
  add column if not exists fill_id bigint null unique references order_fills(id) on delete set null;
alter table trades
  add column if not exists execution_policy text null;
alter table trades
  add column if not exists price_source text null;

create index if not exists idx_trades_order_id on trades(order_id);

-- 0011: Restructure around Study Tracker as main page.
-- - Adds `category` to study_tracker_ideas to distinguish Top Pick vs Watchlist vs Study.
-- - Seeds the 5 canonical study industries (방산/조선/반도체/소프트웨어/화장품) if missing.
-- - Adds a lightweight `author` column to study_call_updates (it already exists as
--   `created_by`, so we just reuse it). Similar free-board update table is reused.

-- 1) Category for top pick / watchlist / study (session-linked)
alter table if exists study_tracker_ideas
  add column if not exists category text null default 'study';

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_category;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_category
  check (category is null or category in ('top_pick', 'watchlist', 'study'));

create index if not exists idx_study_tracker_category
  on study_tracker_ideas(category);

-- Initialize existing rows: ideas with is_included=true and position_status='active'
-- become top_pick. Everything else stays 'study'.
update study_tracker_ideas
set category = 'top_pick'
where category = 'study'
  and coalesce(is_included, false) = true
  and coalesce(position_status, 'active') = 'active';

-- 2) Seed 5 study industries (only if none with that name exist)
insert into study_sessions (presented_at, presenter, industry_name, title, note)
select v.presented_at::date, v.presenter, v.industry_name, v.title, v.note
from (values
  ('2025-09-01', '스터디', '방산', '방산 산업 발표', '방산 산업 — 자유주제 기업 발표 병행'),
  ('2025-10-01', '스터디', '조선', '조선 산업 발표', '조선 산업 + 조선 기업'),
  ('2025-11-01', '스터디', '반도체', '반도체 산업 발표', '반도체 산업 + 반도체 기업'),
  ('2025-12-01', '스터디', '소프트웨어', '소프트웨어 산업 발표', '소프트웨어 산업 + 소프트웨어 기업'),
  ('2026-01-01', '스터디', '화장품', '화장품(소비재) 산업 발표', '소비재 산업 + 소비재 기업 (예정)')
) as v(presented_at, presenter, industry_name, title, note)
where not exists (
  select 1 from study_sessions s where s.industry_name = v.industry_name
);

-- 3) Per-industry value chain storage (for Stage 2 — scaffold table now so
--    future industry detail page can read/write without another migration).
create table if not exists study_session_value_chains (
  session_id bigint primary key references study_sessions(id) on delete cascade,
  layers jsonb not null default '[]'::jsonb,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  companies jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_study_session_value_chains_touch on study_session_value_chains;
create trigger trg_study_session_value_chains_touch
before update on study_session_value_chains
for each row
execute function touch_updated_at();

-- 4) Presentation summary fields on study_sessions (Stage 2 scaffold)
alter table if exists study_sessions
  add column if not exists summary_md text null,
  add column if not exists summary_updated_at timestamptz null;

create table if not exists study_sessions (
  id bigserial primary key,
  presented_at date not null,
  presenter text not null,
  industry_name text not null,
  title text not null,
  thesis text null,
  anti_thesis text null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_sessions_presented_at
  on study_sessions(presented_at desc, id desc);

drop trigger if exists trg_study_sessions_touch on study_sessions;
create trigger trg_study_sessions_touch
before update on study_sessions
for each row
execute function touch_updated_at();

create table if not exists study_session_companies (
  id bigserial primary key,
  session_id bigint not null references study_sessions(id) on delete cascade,
  company_name text not null,
  ticker text not null,
  sector text null,
  session_stance text not null default 'watch',
  mention_reason text null,
  follow_up_status text not null default 'waiting_event',
  next_event_date date null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_study_session_stance check (
    session_stance in ('bullish', 'watch', 'neutral', 'avoid')
  ),
  constraint chk_study_session_follow_up check (
    follow_up_status in ('waiting_event', 'ready_for_call', 'dropped', 'converted')
  )
);

create index if not exists idx_study_session_companies_session
  on study_session_companies(session_id, id desc);

drop trigger if exists trg_study_session_companies_touch on study_session_companies;
create trigger trg_study_session_companies_touch
before update on study_session_companies
for each row
execute function touch_updated_at();

alter table if exists study_tracker_ideas
  add column if not exists source_session_id bigint null references study_sessions(id) on delete set null,
  add column if not exists source_coverage_id bigint null references study_session_companies(id) on delete set null,
  add column if not exists call_direction text null default 'long',
  add column if not exists conviction_score integer null,
  add column if not exists invalidation_rule text null,
  add column if not exists time_horizon text null;

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_call_direction;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_call_direction
  check (call_direction is null or call_direction in ('long', 'avoid', 'watch'));

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_conviction_score;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_conviction_score
  check (conviction_score is null or conviction_score between 1 and 5);

create index if not exists idx_study_tracker_source_session
  on study_tracker_ideas(source_session_id, source_coverage_id);

update study_tracker_ideas
set call_direction = coalesce(call_direction, 'long')
where call_direction is null;

create table if not exists study_call_feedback (
  id bigserial primary key,
  idea_id bigint not null references study_tracker_ideas(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  stance text not null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_study_call_feedback_stance check (
    stance in ('agree', 'neutral', 'disagree')
  ),
  unique (idea_id, participant_id)
);

create index if not exists idx_study_call_feedback_idea
  on study_call_feedback(idea_id, created_at desc);

drop trigger if exists trg_study_call_feedback_touch on study_call_feedback;
create trigger trg_study_call_feedback_touch
before update on study_call_feedback
for each row
execute function touch_updated_at();

create table if not exists study_call_updates (
  id bigserial primary key,
  idea_id bigint not null references study_tracker_ideas(id) on delete cascade,
  update_type text not null default 'update',
  title text null,
  body text not null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_study_call_update_type check (
    update_type in ('update', 'catalyst', 'risk', 'postmortem')
  )
);

create index if not exists idx_study_call_updates_idea
  on study_call_updates(idea_id, created_at desc);

drop trigger if exists trg_study_call_updates_touch on study_call_updates;
create trigger trg_study_call_updates_touch
before update on study_call_updates
for each row
execute function touch_updated_at();

alter table if exists trades
  add column if not exists source_idea_id bigint null references study_tracker_ideas(id) on delete set null;

create index if not exists idx_trades_source_idea
  on trades(source_idea_id, trade_date desc, id desc);

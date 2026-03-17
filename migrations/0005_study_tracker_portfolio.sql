alter table if exists study_tracker_ideas
  add column if not exists is_included boolean not null default false,
  add column if not exists included_at date null,
  add column if not exists included_price numeric(20,6) null,
  add column if not exists weight numeric(12,8) null,
  add column if not exists position_status text null,
  add column if not exists exited_at date null,
  add column if not exists exited_price numeric(20,6) null;

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_position_status;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_position_status
  check (position_status is null or position_status in ('active', 'closed'));

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_weight;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_weight
  check (weight is null or weight > 0);

create index if not exists idx_study_tracker_is_included
  on study_tracker_ideas(is_included, position_status, included_at desc, id desc);

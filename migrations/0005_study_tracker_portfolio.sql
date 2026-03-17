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

update study_tracker_ideas
set
  is_included = true,
  included_at = coalesce(included_at, entry_date, presented_at),
  included_price = coalesce(included_price, pitch_price),
  position_status = coalesce(position_status, 'active')
where coalesce(is_included, false) = false
  and status = '편입';

update study_tracker_ideas
set
  is_included = true,
  included_at = coalesce(included_at, entry_date, presented_at),
  included_price = coalesce(included_price, pitch_price),
  position_status = coalesce(position_status, 'closed'),
  exited_at = coalesce(exited_at, exit_date),
  exited_price = coalesce(
    exited_price,
    current_price,
    case
      when pitch_price is not null and close_return_pct is not null
        then pitch_price * (1 + close_return_pct)
      else null
    end
  )
where coalesce(is_included, false) = false
  and status = '전량청산';

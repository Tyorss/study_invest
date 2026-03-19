alter table if exists study_tracker_ideas
  add column if not exists current_target_price numeric(20,6) null,
  add column if not exists target_status text null,
  add column if not exists target_updated_at timestamptz null,
  add column if not exists target_note text null;

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_target_status;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_target_status
  check (
    target_status is null or target_status in (
      'active',
      'target_hit',
      'revising',
      'upgraded',
      'downgraded',
      'trim_or_hold',
      'closed',
      'invalidated'
    )
  );

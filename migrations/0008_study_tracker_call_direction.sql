alter table if exists study_tracker_ideas
  alter column call_direction set default 'neutral';

alter table if exists study_tracker_ideas
  drop constraint if exists chk_study_tracker_call_direction;

alter table if exists study_tracker_ideas
  add constraint chk_study_tracker_call_direction
  check (call_direction is null or call_direction in ('long', 'neutral', 'short'));

update study_tracker_ideas
set call_direction = case
  when target_price is null or pitch_price is null or pitch_price <= 0 then coalesce(call_direction, 'neutral')
  when abs(target_price / pitch_price - 1) <= 0.1 then 'neutral'
  when target_price > pitch_price then 'long'
  else 'short'
end;

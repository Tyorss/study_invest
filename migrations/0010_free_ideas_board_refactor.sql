alter table if exists study_session_companies
  add column if not exists summary_line text null,
  add column if not exists checkpoint_note text null,
  add column if not exists risk_note text null;

alter table if exists study_session_companies
  drop constraint if exists chk_study_session_stance;

alter table if exists study_session_companies
  drop constraint if exists chk_study_session_follow_up;

alter table if exists study_session_companies
  alter column session_stance set default 'neutral';

alter table if exists study_session_companies
  alter column follow_up_status set default 'watching';

update study_session_companies
set session_stance = case
  when session_stance = 'bullish' then 'long'
  when session_stance = 'avoid' then 'short'
  else 'neutral'
end;

update study_session_companies
set follow_up_status = case
  when follow_up_status = 'waiting_event' then 'waiting_event'
  when follow_up_status = 'ready_for_call' then 'ready_for_call'
  else 'archived'
end;

alter table if exists study_session_companies
  add constraint chk_study_session_stance
  check (session_stance in ('long', 'short', 'neutral'));

alter table if exists study_session_companies
  add constraint chk_study_session_follow_up
  check (follow_up_status in ('watching', 'waiting_event', 'ready_for_call', 'archived'));

create table if not exists participant_notes (
  participant_id uuid primary key references participants(id) on delete cascade,
  market_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participant_note_lines (
  id bigserial primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  sort_order integer not null,
  symbol text null,
  memo_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, sort_order)
);

create index if not exists idx_note_lines_participant_order
  on participant_note_lines(participant_id, sort_order);

drop trigger if exists trg_participant_notes_touch on participant_notes;
create trigger trg_participant_notes_touch
before update on participant_notes
for each row
execute function touch_updated_at();

drop trigger if exists trg_participant_note_lines_touch on participant_note_lines;
create trigger trg_participant_note_lines_touch
before update on participant_note_lines
for each row
execute function touch_updated_at();


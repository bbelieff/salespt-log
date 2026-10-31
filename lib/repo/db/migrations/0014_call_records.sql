-- 통화 정리 (docs/plans/active/call-summary.md, belie 2026-10-31). Additive only: one new table.
-- One row per call started from the DB관리시트 📞 button (dialed), then its uploaded recording. Status-based queue (pm2 restart safe).
-- The lead row owns its calls: deleting the lead (휴지통 이동) removes them.
create table if not exists public.call_records (
  id uuid primary key,
  spreadsheet_id text not null,
  lead_id uuid not null,
  email text not null,
  status text not null check (status in ('dialed','queued','processing','review','confirmed','failed','discarded')),
  called_at timestamptz not null,
  audio_path text,
  audio_seconds int,
  transcript text not null default '',
  raw jsonb,
  extraction jsonb,
  error text not null default '',
  attempts int not null default 0,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  foreign key (spreadsheet_id, lead_id) references public.db_sheet_leads (spreadsheet_id, id) on delete cascade
);
create index if not exists call_records_lead on public.call_records (spreadsheet_id, lead_id, created_at desc);
create index if not exists call_records_queue on public.call_records (status, created_at) where status in ('queued','processing');
revoke all on public.call_records from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on public.call_records from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on public.call_records from authenticated; end if;
end $$;
alter table public.call_records enable row level security;

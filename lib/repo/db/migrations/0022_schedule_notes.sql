-- 일정·계약 탭 주간 보드의 메모·주간 이슈 — 수강생마다 키 하나에 한 줄 (docs/plans/active/schedule-week-board.md, belie 2026-11-11 「이대로 운영반영」).
-- Additive only: one new table. 적용은 db-migrate 워크플로로 따로. 표가 없으면 앱은 메모·이슈 칸만 「저장 불가」로 보이고 나머지는 그대로 동작한다.
-- note_key: 'memo:YYYY-MM-DD'(그날 메모, body = 문자열) · 'issues:YYYY-MM-DD'(금요일 시작 수강 주의 이슈 목록, body = 배열).
create table if not exists public.schedule_notes (
  email text not null,
  note_key text not null,
  body jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (email, note_key)
);
revoke all on public.schedule_notes from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on public.schedule_notes from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on public.schedule_notes from authenticated; end if;
end $$;
alter table public.schedule_notes enable row level security;

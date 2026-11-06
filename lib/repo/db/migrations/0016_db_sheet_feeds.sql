-- DB 시트 자동 확인 (docs/plans/active/db-sheet-feed.md, belie 2026-11-06). Additive only: one new table.
-- 수강생이 연결한 공급처 구글시트(애드프로·디비스트 등) 한 줄 = 한 연결. 07~21시 매시간 새 줄만 DB관리시트에 넣는다.
-- 고객 원문은 저장하지 않는다: seen = 이미 본 줄의 해시 지문, pending_inflow = 유입 반영을 아직 묻지 않은 DB id.
create table if not exists public.db_sheet_feeds (
  id uuid primary key,
  email text not null,
  spreadsheet_id text not null,
  sheet_id text not null,
  gid text not null default '',
  supplier text not null,
  channel text not null,
  rules jsonb not null default '{}'::jsonb,
  seen text[] not null default '{}',
  pending_inflow text[] not null default '{}',
  review_count integer not null default 0,
  enabled boolean not null default true,
  fail_count integer not null default 0,
  last_slot text,
  last_checked_at timestamptz,
  last_added integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique (spreadsheet_id, sheet_id, gid)
);
create index if not exists db_sheet_feeds_enabled on public.db_sheet_feeds (enabled, last_slot);
revoke all on public.db_sheet_feeds from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on public.db_sheet_feeds from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on public.db_sheet_feeds from authenticated; end if;
end $$;
alter table public.db_sheet_feeds enable row level security;


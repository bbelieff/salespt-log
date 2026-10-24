-- 0009 — 서버 전용 표 잠그기 (화석 조사 B6, 2026-10-15). 적용은 db-migrate 워크플로로 따로(belie 승인 후).
--
-- 왜: 일부 표는 앱이 실행 중에 직접 만들었다(company_vault·vault_pins 는 2026-10-09 #1101, sheet_rows 등은
-- 파일럿 시절). 0005·0008 이 만든 표와 달리 이 표들에는 Supabase 기본 역할(anon·authenticated) 권한 회수와
-- 행 단위 보안(RLS) 켜기가 없다. 앱은 서버의 DB 연결(표 주인)로만 접근하므로 RLS 를 켜도 앱 동작은 같고,
-- 브라우저용 공개 키 경로로는 아무것도 못 읽게 된다.
--
-- 안전: 표가 없으면 건너뛴다(to_regclass). 주인 연결은 RLS 를 우회한다(FORCE 안 씀). 데이터 변경 없음.
-- 되돌리기: alter table ... disable row level security (권한은 원래 PUBLIC 기본 권한만 있었다).

create table if not exists public.company_vault (
  spreadsheet_id text not null,
  company_key text not null,
  sealed text not null,
  item_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (spreadsheet_id, company_key)
);
create table if not exists public.vault_pins (
  spreadsheet_id text primary key,
  pin_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'company_vault', 'vault_pins', 'gcal_tokens', 'gcal_event_ids', 'sheet_rows', 'users', 'cohorts',
    'cohort_pending_creates', 'expense_entry_idempotency', 'ops_log'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from public', t);
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute format('revoke all on public.%I from anon', t);
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute format('revoke all on public.%I from authenticated', t);
      end if;
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

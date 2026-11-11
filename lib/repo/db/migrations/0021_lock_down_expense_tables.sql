-- 0021 — 지출 표 9개 잠그기 (Supabase 보안 경고 rls_disabled_in_public, belie 2026-11-11 「진행해」).
-- 적용은 db-migrate 워크플로(installed, dry-run 먼저)로 따로.
--
-- 왜: 0019 가 서버 전용 표 30개를 잠갔지만, 지출 장부 표들은 앱이 실행 중 자체 스키마 기록(expense_schema_migrations)으로
-- 만들어 목록에서 빠졌다. 이 표들은 Supabase 기본 역할(anon·authenticated)로 공개 주소에서 읽기·쓰기·삭제가 가능한 상태였다.
-- 같은 지출 쪽 expense_entry_idempotency 는 앱이 만들 때 이미 같은 방식으로 잠근다(expense-idempotency.ts) — 그 방식 그대로.
--
-- 안전: 표가 없으면 건너뛴다(to_regclass). 앱은 표 주인 연결이라 RLS 를 우회한다(FORCE 안 씀) — 지출 화면 동작 같음.
--   데이터 변경 없음.
-- 되돌리기: alter table ... disable row level security (권한은 원래 PUBLIC 기본 권한만 있었다).

do $$
declare t text;
begin
  foreach t in array array[
    'expense_entries', 'expense_categories', 'expense_category_audits', 'expense_category_audit_items',
    'expense_recurring_rules', 'expense_recurring_occurrences', 'expense_recurring_skips',
    'expense_recurring_pauses', 'expense_schema_migrations'
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

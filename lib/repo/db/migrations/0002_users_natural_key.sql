-- R7 Phase 1 (BBE-55) — users 자연키 교정: (email, cohort) → (email, cohort, name).
--
-- 왜 (BBE-54 설계의 실측 반증, 2026-08-08):
--   BBE-54 는 "등록 = email × cohort" 로 봤지만, 실제 레지스트리(145행)를 세어보니 그 키로는
--   **54행이 유실**된다. 두 가지 현실 때문:
--    ① prep 행(admin 사전등록, `lib/repo/users-prep.ts:buildPrepRowValues`)은 **email 이 빈 문자열**
--       — 수강생이 self-claim 할 때 비로소 채워진다. 실측 67행. 같은 기수의 prep 행 전부가
--       ("", "7") 한 키로 뭉개진다.
--    ② 멀티계정 per 시트(`users-claim.ts` §3) — 같은 (cohort,name)에 email 이 다른 행이 여럿.
--       그래서 (cohort,name) 단독도 키가 못 된다.
--   세 컬럼을 함께 쓰면 145행 중 143키 — 남는 2건은 (email·cohort·name·spreadsheet_id·role·status가)
--   **완전히 동일한 실제 중복 행**(A1-1 김덕호 row29/63 · A1-4 박준용 row43/64)이라 접히는 게 맞다
--   (`lib/repo/user-priority.ts:dedupKeepIndex` 가 정리 대상으로 이미 알고 있는 부류).
--
-- 되돌리기: 이 파일을 되돌리려면 역방향 마이그레이션을 새로 추가한다(적용된 파일은 수정 금지 —
-- 러너가 체크섬으로 드리프트를 막는다).

-- 구 제약을 **이름으로 추측하지 않고** 정의로 찾아 지운다. 0001 의 인라인 `unique (email, cohort)`
-- 는 Postgres 관례상 `users_email_cohort_key` 가 되지만, 이름이 다르면 `drop constraint if exists`
-- 가 조용히 no-op 하고 옛 제약이 남아 prep 행 INSERT 가 전부 실패한다 — 그 실패 모드를 없앤다.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where rel.relname = 'users'
      and ns.nspname = current_schema()
      and con.contype = 'u'
      and (
        select array_agg(att.attname order by att.attname)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
      ) = array['cohort', 'email']::name[]
  loop
    execute format('alter table users drop constraint %I', c.conname);
  end loop;
end $$;

alter table users drop constraint if exists users_email_cohort_name_key;
alter table users add constraint users_email_cohort_name_key unique (email, cohort, name);

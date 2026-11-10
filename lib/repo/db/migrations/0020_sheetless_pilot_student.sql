-- 0020 — 시트 없는 수강생 3단계 실전 시험용 합성 수강생 1명 (ADR-0038, belie 2026-11-10 「3단계 진행해」).
-- 적용은 db-migrate 워크플로(installed, dry-run 먼저)로 따로.
--
-- 무엇: 0기에 `local:` 번호를 가진 합성 수강생 1행. 실제 사람 아님 — 이메일은 절대 존재할 수 없는 .invalid 주소라
--   본인 로그인은 불가하고, 관리자가 「보고 편집」(impersonation)으로 열어 저장·새로고침을 확인한다.
-- 수강 날짜: 같은 0기의 기존 행 값을 그대로 복사한다(날짜 하드코딩 금지 — CLAUDE.md §2.5).
-- 안전: 다른 행은 건드리지 않는다. 이 이메일 행이 이미 있으면 아무것도 안 한다(멱등).
--   레지스트리 시트에는 이 행이 없다 — 시트→DB 백필(backfill-registry)은 행을 지우지 않으므로 그대로 남는다.
-- 되돌리기: delete from users where email = 'sheetless-pilot@salesptlog.invalid';
--   (그 수강생이 남긴 기록: delete from sheet_rows where spreadsheet_id = 'local:5a1e7c0d-3b2f-4c8e-9d61-0f4a2b6c8e10';)

insert into users (id, email, cohort, name, spreadsheet_id, role, status, cohort_label, course_start_iso, graduation_iso, memo)
select
  '5a1e7c0d-3b2f-4c8e-9d61-0f4a2b6c8e10',
  'sheetless-pilot@salesptlog.invalid',
  '0',
  '시험(시트없음)',
  'local:5a1e7c0d-3b2f-4c8e-9d61-0f4a2b6c8e10',
  'trainee',
  'active',
  '0',
  src.course_start_iso,
  src.graduation_iso,
  'ADR-0038 3단계 합성 시험 계정 — 실제 수강생 아님'
from (
  select course_start_iso, graduation_iso from users
  where cohort = '0' and course_start_iso <> '' and graduation_iso <> ''
  order by updated_at desc limit 1
) src
where not exists (select 1 from users where email = 'sheetless-pilot@salesptlog.invalid');

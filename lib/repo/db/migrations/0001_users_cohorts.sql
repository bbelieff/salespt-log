-- R7 Phase 1 (BBE-54) — users/cohorts 레지스트리 Postgres 스키마.
-- 이 마이그레이션만으로는 앱 코드가 이 테이블을 읽거나 쓰지 않는다(배선은 BBE-55/56) — 동작 변화 0.
--
-- 설계 결정 (BBE-54, 2026-08-06 · 근거는 PR 본문·Linear 코멘트 참조):
--  · users 는 "사람" 단위가 아니라 "등록(email × cohort)" 단위 행 — 현재 시트 레지스트리와 같은
--    현실을 그대로 옮긴다(아레나 재참가자는 숫자기수·아레나·트레이너 최대 3행을 동시에 갖는다,
--    lib/repo/user-priority.ts 실측). D2(아레나 라벨 통합 규칙) 미결이 이 결정에 걸려 있었으나,
--    canonical-person 병합을 서비스 레이어(추후 pickPreferredUser SQL 이식)로 미루면 스키마
--    자체는 D2 답변 없이도 안전하게 진행 가능 — email 단독 UNIQUE 를 걸지 않는 것으로 충분.
--    자연키 = (email, cohort).
--  · gcal_token/gcal_settings(시트 S/T) 컬럼은 이번에 자리만 만든다 — BBE-58 이 별도 테이블로
--    분리할 예정. 분리 시 FK 는 등록-row surrogate id 가 아니라 email 기준을 권장(우선순위 행이
--    바뀌어도[예: archived→아레나 승격] 연결이 끊기지 않도록).
--  · id = uuid(앱이 crypto.randomUUID() 로 생성해 INSERT, DB default 없음) — lib/repo/db/expense-ledger.ts
--    가 확립한 최신 관례를 따른다(구 sheet_rows/cohort_pending_creates 의 bigserial 관례 대신).

create table if not exists users (
  id uuid primary key,
  email text not null,
  cohort text not null,
  name text not null default '',
  spreadsheet_id text not null default '',
  role text not null default 'trainee' check (role in ('trainee', 'trainer', 'admin')),
  status text not null default 'active' check (status in ('active', 'pending', 'archived')),
  assigned_trainer text not null default '',
  team text not null default '',
  cohort_label text not null default '',
  name_label text not null default '',
  course_start_iso text not null default '',
  graduation_iso text not null default '',
  sort_order int not null default 0,
  drive_parent_path text not null default '',
  feedback_folder_id text not null default '',
  drive_link_status text not null default '',
  memo text not null default '',
  captain_of text not null default '',
  gcal_token text not null default '',
  gcal_settings text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, cohort)
);
create index if not exists users_email_idx on users (email);
create index if not exists users_cohort_idx on users (cohort);

create table if not exists cohorts (
  id uuid primary key,
  label text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  note text not null default '',
  type text not null default 'cohort' check (type in ('cohort', 'arena')),
  template_sheet_id text not null default '',
  root_folder_id text not null default '',
  roster_sheet_id text not null default '',
  sheets_folder_id text not null default '',
  company_parent_folder_id text not null default '',
  season_start_iso text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (label)
);

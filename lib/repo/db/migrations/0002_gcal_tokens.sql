-- R7 Phase 1 (BBE-58) — gcal 토큰·설정을 레지스트리 시트 S/T열에서 Postgres 로 이전.
--
-- 설계 결정 (BBE-58, 2026-08-06 · 근거는 PR 본문·Linear 코멘트 참조):
--  · **자연키 = email** (users.id FK 아님). 0001_users_cohorts.sql 주석이 이미 권고한 방향 —
--    users 는 "등록(email × cohort)" 단위라 한 사람이 최대 3행(숫자기수·아레나·트레이너)을
--    갖고, 우선순위 행이 바뀌면(archived→아레나 승격) surrogate id FK 는 연결이 끊긴다.
--    캘린더 연동은 "사람" 단위 사실이므로 email 이 옳은 키다.
--  · **users 테이블 FK 를 걸지 않는다** — 실측(2026-08-06): `users` 는 0001 로 생성만 됐고
--    읽기·쓰기 코드가 아직 없다(BBE-55/56 미착수) = **운영 DB 에서 비어 있다**. FK 를 걸면
--    gcal 저장이 전부 실패한다. users 배선이 끝난 뒤 FK 추가는 별도 마이그레이션으로 가능.
--  · **token_enc 는 암호문 그대로 옮긴다** — 복호화·재암호화 불필요. lib/repo/gcal-crypto.ts
--    실측: 키는 AUTH_SECRET→HKDF 로 매 호출 파생하고 저장 포맷은 `v1:{iv}:{tag}:{ct}` 인
--    자기완결 문자열이라, **저장 위치가 시트냐 DB냐와 무관**하다. 이전은 문자열 이동일 뿐이며
--    AUTH_SECRET 로테이션 시 전원 재연결이 필요한 성질(ADR-0028)도 그대로 유지된다.
--  · **행의 존재 자체가 정본 표식**이다(§ 아래 주의). token_enc='' 인 행 = "연결 해제됨"이고,
--    행이 아예 없음 = "아직 DB 로 이전 안 됨(시트 폴백 대상)". 이 둘을 구분하지 않으면
--    연결 해제가 시트 폴백으로 되살아난다(gcal-token.ts 가 이 불변식을 강제).
--
-- ⚠️ 보안: token_enc 는 AES-256-GCM 암호문이다. 평문은 이 테이블에 절대 들어가지 않는다.
--    조회·로그·마이그레이션 스크립트 어디에서도 이 컬럼 값을 출력하지 않는다(ADR-0028 §3).

create table if not exists gcal_tokens (
  email text primary key,
  -- AES-256-GCM 암호문(`v1:iv:tag:ct`) 또는 '' (=연결 해제). 평문 저장 금지.
  token_enc text not null default '',
  -- GcalSettings JSON 문자열(예: {"calendarId":"primary"}). 빈 문자열 = 기본값 사용.
  settings text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

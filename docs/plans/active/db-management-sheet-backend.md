# DB관리시트 저장·영업 연동

사용자 2026-10-11 직접 구현 요청: 목업 v0.31을 기준으로 프론트 저장부터 기존 Supabase 재조회, 날짜별 실적과 미팅예약 연결까지 구현·검증한다.

## 확인한 환경
- base: 9abae99e6e06381aad4f35e05b64190cb712dc75. 전용 db-management-sheet-mockup-261010 worktree. 보호 PR #1002/#798 무접촉.
- 기존 Supabase ref: aoevgfroxdvgbmgvzlfb (`db-migration-pilot.md`). VPS 기존 DATABASE_URL의 project ref 일치 확인. 현재 pooler host는 aws-1-ap-southeast-1.pooler.supabase.com. 초기 문서의 서울 표기를 현재 실제 리전으로 단정하지 않는다.
- Supabase MCP는 다른 계정의 moawork만 보임. 대상 변경/새 프로젝트 생성/자격증명 복사 없이 기존 서버 경로 사용.
- 최초 동작은 DB 정본 사용자만 허용. legacy 기수 전환은 이 기능 때문에 변경하지 않는다.

## 저장 구조와 API 계약
- db_sheet_leads: 서버가 결정한 spreadsheet_id + UUID, 원본 DB정보 JSON, 유입일/채널, 확인한 업체정보 별도 JSON, revision. 원본과 확인정보를 서로 덮지 않는다.
- db_sheet_contacts: spreadsheet_id + lead ID + 상담일 고유키, 결과/메모. 최초상담일은 유효 상담의 최소 날짜. 단순 부재/거절은 실적 제외. 결과 변경으로 이전 상담 이력이 사라지지 않는다.
- 미팅은 기존 sheet_rows meetings가 정본. 안정된 meeting UUID를 lead에 연결하고 기존 컨택/일정/계약 API를 재사용한다. 별도 미팅 사본을 만들지 않는다.
- 사용자별 소유키는 요청 본문이 아니라 기존 student-view 및 writable identity에서 해석한다. read-only 대리보기는 쓰기 거부. 새 테이블 RLS on, browser grants 없음, 기존 서버 DB 접속만 사용.
- API 재시도는 idempotency 키, 변경은 revision 검사. 네트워크 응답 유실에도 중복 생성하지 않는다. DB 실패는 성공으로 표시하지 않으며 입력을 유지한다.

## 집계 설계 검토
- 기존 daily POST는 전체 수동 절대값을 저장한다. 단순 +1 후 재저장 금지. 수동분과 DB시트 자동 기여분을 구분해야 한다.
- 자동 유입은 유입일에, 유효 컨택은 상담일에, 미팅예약은 기존 예약일 기준 실제 카드수에 반영한다. 미팅날짜는 일정 노출 기준이다.
- 기존 채널 소유권: 매입DB 생산은 매입원장; 직접생산 생산=유입; 콜지기소 생산/유입은 발굴원장 파생. 공급처와 채널을 혼동하지 않는다.
- 사용자 확정: 메타는 직접생산, 같은 업체도 상담 날짜마다 1건. 같은 날짜 중복 기록은 증가하지 않는다. 기존 컨택 수동 입력 유지.

## 검증 완료조건
1. 새로고침/새 브라우저 세션 GET에도 저장값 일치(세션 스토리지 제외).
2. 유입 A일 → A 유입, 상담 B일 → B 컨택, 미팅예약 B일/실제미팅 C일 → 컨택 B·일정 C.
3. 부재/단순거절 제외, 유효 상담 후 재통화에도 과거 실적 보존.
4. 날짜/채널 수정 시 이전 기여분 제거·새 기여분 반영, 수동 실적 보존.
5. 중복 재시도·동시 요청·다른 브라우저 stale 저장 방어.
6. 타인 UUID 접근/변경 거부, SQL 실패 rollback, 저장 실패 재시도.
7. 실제 Supabase migration 적용·서버 API 저장/재조회 E2E를 로컬 PostgreSQL 검사와 분리 기록.
8. check.sh, production build, 독립 검토, CI, 배포 SHA 및 health, 운영 검증을 각각 증거화.

## 현재 상태
구현 및 로컬 브라우저·PostgreSQL(PGlite) 검증 완료. 기존 Supabase에 0008 신규 4테이블 적용 완료, 체크섬·RLS·브라우저 권한 회수·실행 앱 DB 대상/역할 일치 확인. 실제 PostgreSQL 격리 통합 및 브라우저→Supabase→reload 통과. production build·check.sh(구조 92, 단위/통합 3,436) 통과. CI/배포 확인 진행 중.

## 사용자 집계 확정
- 2026-10-11: 메타 직접 DB는 직접생산. 같은 업체도 상담한 날짜마다 1건, 같은 날짜 중복 저장은 증가하지 않음.


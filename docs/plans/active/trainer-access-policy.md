# #958 트레이너 순수 권한 정책 — 비중첩 레인

- 상태: module-only 구현·검증 완료 / 부모·OG 통합 NOT_RUN (active 유지)
- 후속 #958 DH 단일 writer: **소유 저장/API/독립 편집 구현·합성 검증 완료 / 공용부·운영 통합 NOT_RUN**. 이 단계는 commit/push/PR/merge/배포/실DB 변경 제외. 아래 원래 순수 정책 완료 증거는 과거 단계이며 신규 단계 결과는 `docs/qa/trainer-access-settings/README.md`에 별도 기록한다.
- 추가 소유: 신규 repo/service/API/TrainerAccessEditor/0007 migration, 관련 tests, 이 계획/전용 QA, types 확장 및 data-model/components 등록만. #956 writer 파일들은 읽기전용.
- 실행환경: 최초 fetch는 공유 .git FETCH_HEAD 쓰기권한으로 실패. 원격 읽기 connector에서 열린 PR 959/954/942/798 경로 확인, 0007 충돌 없음; GitHub code search `path:lib/repo/db/migrations 0007` 결과 0. 로컬 HEAD/origin/master c781feb. 상위 C:/Users/belie 정본 3개는 경로 없음, 현재 사용자 작업 계약으로 계속.
- 신규 단계 검증: 관련 Vitest214 PASS(기존166+신규48), 격리 PostgreSQL44 assertions, React/Chrome46 assertions, 모바일360/390·PC1440 가로 넘침0. 실제 admin/reset guard를 제거한 검증 번들 2개는 assertion RED(exit1), 원본은 GREEN. 제품/기존 테스트·훅은 변경하지 않은 반증 실험이다.
- 최종 `check.sh`는 소스 SHA 일치 독립 검증 복사본에서 exit0(구조41, 단위1924 PASS·기존37 skip). 원래 cwd는 esbuild 상위폴더 접근 오류로 exit1; 공유 Git 참조 복사본은 마지막 hygiene에서 exit1. 환경 실패를 성공으로 바꾸어 기록하지 않는다. 원래 worktree `next build` exit0/71페이지. Python 허용외0/제품·테스트·게이트21파일 SHA 동일/순수 util·166tests 불변 확인.
- 부모 인계: 독립 컴포넌트 mount, identity/학생목록/모든 읽기·쓰기 API/주간목표/metadata 성공 신호/본인 CRM 통합, #956 선행·0007 운영 ACL·exact6명 매핑·migration·배포는 NOT_RUN. 전체 #958 미완료이므로 active 계획 유지. 이번 worker는 운영 명령·중복 writer를 생성하지 않았다.
- 기준: origin/master `c781febca94c9b476409d6f9db0da8ac512bb49a`
- 브랜치/worktree: `feat/trainer-access-policy` / `wt/trainer-access-policy`
- 승인 범위: 새 `lib/types/trainer-access.ts`, `lib/util/trainer-access-policy.ts`, `tests/util/trainer-access-policy.test.ts`, 이 계획/전용 QA, 필요한 `docs/domains/data-model.md`만.
- #956 auth/identity/UI/API/DB 기존 writer는 OG. 다른 writer spawn/resume 및 기존 worktree 변경 금지. 커밋/푸시/PR/머지 금지. 현행 사용자 계약을 구 AGENTS 슬롯/절대경로보다 우선하며 훅/테스트 보호는 유지.

## 계약/조사

- grade: senior / regular / apprentice. category: active / arena / archived. 기본값 senior 모두 RW, regular/apprentice active만 RW. unknown grade는 전부 거부.
- grants는 모든 category에 read/write boolean을 명시한다. write=true/read=false, 누락/여분 필드, truthy 문자열은 거부. 명시 grants는 grade 기본 상한 안에서 제한하는 용도(확대하지 않음).
- actor는 호출자가 인증된 trainer 자격 행을 특정한 뒤 grade/status/grants를 전달. active만 허용. 관리자와 본인 CRM은 호출자가 별도 처리하며 이 모듈의 거부를 본인 CRM 거부로 사용하지 않는다.
- student는 호출자가 특정 trainee 행을 고르고 rowStatus/cohortStatus/cohortType/cohortMetadataTrusted/isArenaLabel/isReserved를 명시한다. pending/reserved/unknown은 제외, archived row 또는 cohort 우선, 그 다음 arena type 또는 label, 나머지 확인된 cohort만 active.
- `lib/repo/cohorts.ts:106-136`: status/type 기본값이 active/cohort이며 archived set은 라벨 exact match. 데이터 조회 실패를 active로 바꾸지 말 것.
- `lib/service/cohort-token.ts:31-49,68-82`: 시즌 A2와 참가자 A2-1기/A2-1은 다른 parser. `lib/repo/user-priority.ts:14-15`는 prefix 판정이고 `lib/repo/users-arena.ts:17-24`는 anchored 판정. 따라서 util에 parser 복제/상위 service import 없이 호출자 정규화 boolean을 받는다.
- `lib/repo/user-priority.ts:80-88`: B 숫자/I 아레나 불일치 존재. isArenaLabel은 서버가 registry cohort 및 cohortLabel 모두 확인하고 시즌 parser도 확인해 만든다. 참가자 row는 자신의 기수와 시즌 cohort status를 모두 조회하여 하나라도 archived면 cohortStatus=archived.
- reserved는 `lib/repo/users.ts`의 유보 sentinel을 호출자가 정규화. pending/inactive actor를 기존 parseRow의 active fallback으로 세탁하지 않는다.
- 추가 검수: 현재 cohorts repo는 catch→[]여서 정상 empty/실패 구분 불가. cohortMetadataTrusted=true는 호출자가 성공과 필요한 row/시즌 metadata의 신뢰성을 명시적으로 확인한 경우만. catch→[]/누락/unknown은 active fallback 금지; null status/type 또는 false trusted 전달 후 분류 null/권한 false. 이 repo 보완은 OG 통합 NOT_RUN.
- 이름/이메일 필드, 개인 seed, I/O, auth/session/DB 의존성 없음.

## 검증 순서

- [x] 최신 base 전용 worktree / 기존 분류 코드 읽기
- [x] npm ci (1208 packages; 기존 peer/deprecation 경고 및 audit 취약점 보고, lock 변경 금지)
- [x] 수직 RED→GREEN: 기본 grants → strict 검증 → 분류 → 최종 판정 (실제 assertion RED 로그 보존)
- [x] 매트릭스·unknown·불변성·archived/arena 우선·실제 parser 입력 계약 실행 회귀
- [x] 전체 `bash scripts/check.sh` exit0 (구조41 / 단위1876 pass·37 skip), `npx next build` exit0 (71/71), diff/scope 확인
- [x] [전용 QA](../../qa/trainer-access-policy/README.md)에 실제 RED/GREEN·check/build 로그, API signature 및 통합 NOT_RUN 기록. Python set 범위 검증 스크립트/결과 포함.

## 구조 게이트 수정

첫 check.sh에서 util의 type import도 금지하는 기존 `period-hardcode.test.ts:88-100`에 실패했다. 기존 테스트·훅은 수정하지 않고 유틸을 import 0으로 바꿨다. 반환 타입은 추론하며 공개 타입 일치는 테스트에서 expectTypeOf로 고정. 구조 단독 RED 및 정책+구조 GREEN 로그 보존.

## 남은 통합 (NOT_RUN)

자격 저장/마이그레이션, auth/impersonation/read/write 모든 endpoint, 학생 목록 필터, 관리자 grants UI, 본인 정규/아레나 CRM, live/browser/DB/배포 검증은 OG/부모 통합 소유. 이 모듈만 추가해 기존 권한이 바뀌었다고 보고하지 않는다.

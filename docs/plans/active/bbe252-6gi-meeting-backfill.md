> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: BBE-252 계보 — 6기 전원의 시트 직접입력 미팅(04 업체관리 id 공란 행)을 DB에 백필해 parity 정합을 맞추는 집행 기록(10기 개별교정의 기수 전체 일반화).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `scripts/ops/bbe252-cohort-meeting-backfill.mjs`, `.github/workflows/db-backfill-bbe252-cohort-meetings.yml`
> - **읽고 나면 알 수 있는 것**: 왜 id 공란 행을 그대로 백필해도 안전한지 / 10기 스크립트를 왜 고치지 않고 새로 만들었는지 / revert 방법
> - **관련 문서**: `docs/plans/active/bbe252-10gi-meeting-backfill.md`(선례, 단일 사용자 버전), BBE-252·BBE-75

---

slug: bbe252-6gi-meeting-backfill
status: active
created: 2026-08-24
owner: 경영일지 데탑 C작업원C — belie 집행 배차("시트독립 마지막 블로커")
related: BBE-252, BBE-75, BBE-245

## 0. Scope

B 가 확정한 6기 잔차 근인(BBE-252 코멘트, 2026-08-23T19:06/19:21) = **meetings 백필
완결성**: 6명 중 1명은 `sheet_rows`(tab='meetings') 자체가 0건, 나머지 4명도 시트 대비
"계약" 상태 미팅 건수가 DB 에 적게 들어있음. 소스 정렬 공식(04 미팅.L 기준)은 이미 검증
완료(1명 diff 0) — 남은 건 원본 데이터(미팅 기록) 자체가 DB 에 없는 문제.

10기 개별교정(`bbe252-10gi-meeting-backfill.mjs`, 학생 1명 하드코딩)에서 검증된 패턴을
6기 **등록 trainee 전원**으로 확장 집행한다. 새 Linear 카드 없이 BBE-252 도장 재사용.

## 1. Gather — 10기 선례에서 재사용하는 것

read-only 조사(BBE-252 10기 코멘트, 2026-08-20T18:40)에서 이미 확정: id 공란 행은
`rowToMeeting()`(`lib/repo/meetings-rows.ts`)이 `if (!idStr) return null` 로 파싱을
포기하고, `appendMeeting`(시트에 미팅을 쓰는 유일한 repo 함수)의 유일한 호출부
(`lib/service/meetings-write.ts`, `createMeetingRecord`)는 그 앞에서 `Meeting.parse()`
(id 포함 필수 검증)를 거친다 — id 공란 행은 앱 저장 경로를 거칠 수 없다(시트 직접입력
확정). 이 구조적 논거는 기수에 무관하다(Zod 스키마·호출부는 기수별로 다르지 않음).

**공란 그대로 백필해도 안전한 이유**: `dashboard-parity-lib.mjs` 의 시트측/DB측 리더가
둘 다 원본 컬럼 인덱스를 그대로 읽어 공란 셀을 동일 연산으로 빈 문자열화한다 — payload 에서
키 생략(`backfill-sheet-rows.mjs` 의 `rowObj` 관례)으로 parity 지문이 자동 일치.

**계약여부(K) 체크박스 서식 함정**: 10기 dry-run #1 에서 발견 — 완전 빈 행도
`UNFORMATTED_VALUE` 로 K 열에 리터럴 `false` 를 반환(체크박스 서식 특성). K 는 true/TRUE
일 때만 "데이터 있음"으로 센다. 새 스크립트에 그대로 반영(재발 방지 — 고친 필터를 다시
써야 하는 게 아니라 애초에 필터 자체를 그대로 가져옴).

## 2. Solve — 왜 10기 스크립트를 고치지 않고 새로 만들었나

`bbe252-10gi-meeting-backfill.mjs` 자체 문서 주석에 "단발성 개별 교정 — 범용 백필
아님"이라고 명시돼 있고, 이미 완료 보고·전용 workflow(`db-backfill-bbe252-10gi-meetings.yml`)
가 존재하는 완결된 산출물이다. 이걸 고치면 이미 검증된 단일사용자 경로를 건드리는
리스크가 생긴다 — 대신 **동일한 후보필터·payload·upsert 로직**을 재사용하는 신규 범용
스크립트 `bbe252-cohort-meeting-backfill.mjs`(`--cohort` 필수 인자, 쉼표로 여러 기수
가능)를 만들고, `findTargetUser()`(해시 1명 매칭) 자리를 `findCohortUsers(cohortLabel)`
(레지스트리 cohort 문자열 매칭, `bbe260-contract-drift-deepdive.mjs` 의 per-user-loop +
기수별 요약표 패턴 재사용)로 교체했다. 전용 workflow 도 `db-backfill.yml`(cohort
free-text 입력 + env-passthrough SSH 보안 패턴)을 템플릿으로 신규 작성했다.

## 3. Verify — 실행 절차 (수용 기준)

① **dry-run**(`db-backfill-bbe252-cohort-meetings.yml`, cohort="6", execute=false) — 6기
등록 trainee 전원의 id 공란 후보 행 목록·건수 확정, 계약여부 체크박스 오탐 필터 포함.
② **execute**(같은 workflow, execute=true) — 신규 행만 upsert(이미 DB 존재분은 스킵).
결과 로그에 사용자별 revert SQL(`delete from sheet_rows where ... row_key = any([...])`)
출력.
③ **dashboard-parity --cohort "6" 재실행**(`db-audit.yml`, script=dashboard-parity,
cohort="6") — 백필 전후 diff 비교, meetings 원행 지문 차집합 해소 확인.
④ id 有 충돌 건(10기 08-17 현수막 유형 — 이미 id 있는 행의 상태값 불일치)이 나오면 그
건만 "미확정 — belie 확인"으로 개별 문서화하고, **전환 추천 자체는 막지 않는다**(belie
배차 지시 — 10기 때와 달리 diff 0 이 이번 라운드의 엄격한 기준이 아님).
⑤ BBE-252 + BBE-75 도장. 트리거되는 즉시 D 가 6기 파일럿 스위치를 켜고 BBE-245 종료로
이어진다(별도 트랙, 이 카드 범위 밖).

## Log
- **2026-08-24 착수**: 스크립트·workflow 작성, check.sh 검증 진행 중.

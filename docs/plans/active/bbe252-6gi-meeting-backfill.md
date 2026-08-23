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

## 3. Verify — 실행 절차 및 실측 결과 (정직 보고 — belie 원 진단과 다름)

① **dry-run**(run `32662620038`, cohort="6", execute=false) — **6기 등록 trainee 6명
전원 후보(id 공란 행) 0건.** 계약여부 체크박스 오탐 필터까지 반영된 상태에서 실측.

② **execute — 실행하지 않음.** 후보가 0건이라 insert 할 대상 자체가 없다(빈 실행은
의미 없는 로그만 남긴다).

③ **dashboard-parity --cohort "6" 재실행**(`db-audit.yml`, run `32662683896`) — **잔차
39건 그대로 남음(5/6명 dirty, 1명만 diff 0)**. 그런데 결정적으로: **모든 39건이 "진짜불일치"
분류이고, meetings/B21 원행 지문 차집합은 6명 전원 0건**(코드: `dashboard-parity.mjs`
`printSourceDiff` 는 `onlyInSheet/onlyInDb/countMismatch` 세 그룹이 전부 비면 아예 안
찍는다 — 로그에 그 섹션 자체가 없다는 것 자체가 "지문 완전 일치"의 증거).

같은 시각 `bbe252-cohort-readiness`(run `32662804486`) 로 교차검증: 6기 샘플 3명의
meetings 행수가 **시트=DB 정확히 일치**(17=17, 5=5, 7=7). cohort=6 전체 meetings DB
행수도 38건 그대로(2026-08-20 첫 조사 스냅샷과 동일 — 그 사이 줄지 않았다).

**→ belie 배차의 전제("6기 meetings 백필 완결성" — B 19:06/19:21 코멘트, "한 사용자는
meetings 0건 SQL 직접확인") 가 지금 이 순간 두 개의 독립된 정본 측정기(dashboard-parity
지문 대조 + cohort-readiness 행수 대조) 로 재현되지 않는다.** meetings raw row 는
이미 시트=DB 로 맞아있다 — 백필로 해결할 문제가 아니다.

**실제 잔차의 성격**: 39건 전부 **집계값**(R1:U6 채널×계약, N.주N계약, H.주N활동,
B21.누적수임비) 레벨이고 원행은 일치 → 원인은 **행 존재 여부가 아니라 "그 행을 몇 주차에
넣을지"(week bucketing) 또는 courseStart 해석**일 가능성이 높다. 근거: `computeAggregates`
(`dashboard-parity-lib.mjs:79`) 는 `weekIndexOf(parseISO(mt.미팅날짜), courseStart)` 로
주차를 계산하는데, 6기는 CLAUDE.md 명시대로 **legacy +57일 모델**(7기+ 는 +50일) —
`lib/util/week.ts` 의 "시작일 앵커 vs 금~목 앵커" 분기가 6기 코드경로에서 시트 수식의
주차 산정과 다르게 해석되고 있을 가능성을 배제 못 한다(직접 코드 대조는 안 함 — B 의
활성 작업 영역, 이 카드 스코프 밖).

④ id 有 충돌 건(10기 08-17 유형) — **해당 없음.** 애초에 id 공란 행 자체가 0건이라 이
케이스가 발생할 조건이 성립하지 않는다.

⑤ **BBE-252 + BBE-75 완료 도장 보류.** 잔차가 안 풀렸는데 도장을 찍으면 D 의 자동
스위치가 그대로 발동해 6기 학생들이 틀린 숫자를 보게 된다(§0.8 "부분 완료를 완료로
두는 게 가장 위험하다"). 대신 이 카드는 진단을 정정하고 B 에게 이관한다(아래 §4).

## 4. 남은 항목 (완료 아님 — 정직 보고)

- **meetings 백필**: 필요 없음(이미 해소됨 — 최소 2026-08-20 이후 계속 시트=DB 일치
  상태였던 것으로 보임). 새로 만든 `bbe252-cohort-meeting-backfill.mjs`/전용 workflow
  는 정확히 동작함(0건을 0건으로 정직하게 보고) — 폐기하지 않고 남겨둔다(다음에 실제로
  id 공란 직접입력형 잔차가 나오는 기수가 있으면 즉시 재사용 가능).
- **6기 39건 잔차**: courseStart/week 버킷팅 or B21 fee 소스정렬 계산 쪽 문제로 추정
  (증거: raw 지문 100% 일치 + 집계만 어긋남) — **B 에게 이관**(6기 소스정렬 PR #860·#862
  담당자, `dashboard-aggregates.ts`/`week.ts` 영역).
- **6기 GO 판정**: 미충족 — D 의 자동 스위치 전환 조건 불충족 그대로 유지.

## Log
- **2026-08-24 착수**: 스크립트·workflow 작성(PR #867, 머지 `52c4f4c`, 배포 success·
  health 200 확인).
- **2026-08-24 부분완주(진단 정정)**: dry-run 0건·parity 잔차 39건 불변 확인. belie 배차의
  "meetings 백필 완결성" 전제가 실측 재현 안 됨 — 원행 지문 100% 일치, 잔차는 집계
  로직(week bucketing) 문제로 추정. BBE-252/BBE-75 완료 도장 보류, B 에게 이관.

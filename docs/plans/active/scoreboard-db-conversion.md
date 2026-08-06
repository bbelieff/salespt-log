> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 전광판(아레나 스코어보드) 주차별 5지표를 시트 3회 read에서 DB 배치 read로
>   전환(BBE-63, R7 Phase 3 #14) — 구현·단위테스트는 완료, **라이브 시트 대조는 미완료**.
> - **누가 읽나요**: 반장(FM), belie, 이 카드를 이어받는 세션
> - **어떤 기능·작업과 연결?**: `lib/service/scoreboard.ts`·`scoreboard-db.ts`·`lib/repo/db/scoreboard-stats.ts`·`scripts/ops/scoreboard-parity.mjs`
> - **읽고 나면 알 수 있는 것**: 무엇을 바꿨나 / 무엇이 확실하고 무엇이 아직 가정인가 / 머지 전에 누가 무엇을 해야 하나
> - **관련 문서**: `lib/service/dashboard-aggregates.ts`(R2-7a 선례, 동일 패턴) · `lib/service/profile-stats-db.ts`(BBE-64, PR #713 — setup-formulas.ts 실측 근거 공유)

# BBE-63 — 전광판 DB 전환 (R7 Phase 3 #14)

## 왜
시즌2 개막으로 전광판 참가자가 37→90여 명. 지금은 참가자 시트마다 3회(대시보드 C33:H40·
02 계약수납 전량·01!O1) 읽는다. 참가자 전원이 이미 DB 파일럿(아레나 라벨 = isDbReadPilot
자동 편입)이라 데이터는 이미 DB에 있다 — 30분 캐시로만 가려진 낭비.

## 한 것
- `lib/repo/db/scoreboard-stats.ts`: N개 시트의 sales·meetings·contracts 를 배치 3쿼리로 조회
  (`profile-stats.ts`(BBE-64) 와 동일 ANY($1) 패턴).
- `lib/service/scoreboard-db.ts`(신규, 500줄 캡 분리): `weeklyPerfFromDb` 순수함수 + DB/시트
  폴백을 가르는 `loadWeeklyBundles`. courseStart(O1)는 DB 대응값이 없어 시트 read 유지
  (양쪽 경로 공용, 30분 캐시 — 절약 대상은 나머지 2개 read 뿐).
- `lib/service/scoreboard.ts`: `loadScoreboard`·`loadIndividualRankings` 가 기수/시트별 개별
  루프 대신 `loadWeeklyBundles` 배치 1회를 공유.
- `scripts/ops/scoreboard-parity.mjs`(신규): `dashboard-parity.mjs` 패턴 재사용 — 라이브 시트
  대조 도구.
- 테스트: `tests/service/scoreboard-db.test.ts`(순수함수 6케이스) · `tests/repo/db-scoreboard-stats-batch.test.ts`(배치 조회 5케이스). `npx tsc --noEmit`·`eslint`·`check.sh` 전체 초록.

## 확실한 것 vs 가정인 것 (§0.8 Report)

| 지표 | 근거 | 확신도 |
|---|---|---|
| 생산/유입/컨택 | salesRows 주차 블록 합(01!E~G 직접입력) — channelStackingFromDb 와 동일 소스 | **높음** |
| 계약 | 상태="계약"(계약여부 아님)·이월제외, `setup-formulas.ts` 01!N 열 install 수식 실측 확인 | **높음** |
| **미팅** | 상태∈{완료,계약}(01!L 열 수식 실측) + `weeklyActivityFromDb` 기존 관례 — **단, 대시보드 D열이 실제로 L(완료)을 보여주는지, 아니면 H(예약, sales.meetingReservation)를 보여주는지는 라이브 시트 셀 수식을 코드로 확인 못 했다**(템플릿 시트 전용) | **중간 — 검증 필요** |

## 남은 일 (belie/FM — 이 카드는 "구현 완료"이지 "검증 완료"가 아니다)

1. VPS 에서 `node scripts/ops/scoreboard-parity.mjs --cohort "A1-1,...,A2-8"` 실행(GitHub Actions
   workflow_dispatch 또는 SSH). 로컬엔 `DATABASE_URL`·SA 키가 없어 이 세션은 실행 불가.
2. diff 0 확인되면 그대로 머지. diff 가 "미팅" 필드에만 집중되면 → `weeklyPerfFromDb` 의
   미팅 판정을 `isDone` 대신 `salesRows.meetingReservation` 합산으로 교체(스크립트가 이
   가능성을 콘솔에 이미 안내).
3. 머지 창구는 belie 지시대로 **아레나2 복구(FM, BBE-42) 완료 후**.

## 롤백
이 PR 은 `loadWeeklyBundles` 가 DB 배치 실패 시 자동으로 시트 경로 폴백(코드 내장, 별도
플래그 불요) — 배포 후 문제 시 PR revert 1건이면 시트 전용 경로로 완전 복귀.

## Log
- 2026-08-05 구현 완료(작업원D) — 코드·단위테스트·check.sh 초록. 라이브 parity 미실행(로컬
  credential 없음, §0.8 명시). PR 오픈, 머지는 belie 지시로 보류.

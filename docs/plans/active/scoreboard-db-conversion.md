> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 전광판(아레나 스코어보드) 주차별 5지표를 시트 3회 read에서 DB 배치 read로
>   전환(BBE-63, R7 Phase 3 #14) — 구현·단위테스트 완료, **미팅 컬럼 정의 확정(2026-08-09)**,
>   전 기수 라이브 대조는 실행 수단(PR #753) 머지 후 belie/FM 몫.
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
| **미팅** | ✅ **확정(2026-08-09)** — 상태∈{완료,계약}(01!L). 아래 "확정 경위" 참고 | **높음** |

### 미팅 컬럼 확정 경위 (2026-08-09 — 구 세션이 남긴 미확정 1건 해소)

구 세션(작업원D 260805)이 "대시보드 D열이 미팅완료(L)인지 미팅예약(H)인지 라이브 셀 수식을
코드로 확인 못 했다"고 남긴 것을 아래 3개 독립 근거로 확정했다(VPS 접속 없이 코드·로그만):

1. **수식 실측** — `setup-formulas.ts:139` 가 설치하는 01!L 은
   `COUNTIFS(04!D,<날짜>,04!J,"계약",04!AO,"<>이월") + COUNTIFS(...,"완료",...)`.
   상태∈{완료,계약}·이월제외·**미팅날짜(D) 키** — weeklyPerfFromDb 의 미팅 정의와 정확히 대칭.
2. **구조 반증** — "미팅예약" 후보는 시트에서 01!R4:U5·F4 펀넬로만 존재하고, 그 수식은
   `COUNTIFS(04!F,04!J)`(setup-formulas.ts:151·157)로 **날짜 무필터 누적**이다. 날짜가 안 걸린
   셀에서 주차별 값이 나올 수 없으므로, 주차 블록의 미팅 컬럼이 예약일 가능성은 구조적으로
   배제된다.
3. **라이브 대조 재사용** — 같은 대시보드 블록(C33:H40)의 H(활동량) = 생산×1+컨택×1.5+미팅×2
   를 이 정의 그대로 재현한 `weeklyActivityFromDb` 가 `dashboard-parity` run `31267667665`
   에서 **8·9기 12명 전원 diff 0**(BBE-66 반장 보고, 2026-08-08). 생산·컨택이 같은 소스이므로
   미팅 항도 함께 검증된 것과 같다.

코드 반영: `lib/service/scoreboard-db.ts` 헤더 주석 + `tests/service/scoreboard-db.test.ts`
"01!L·N 수식 결속" 그룹(수식 문자열이 바뀌면 여기서 먼저 깨짐).

⚠️ 위 근거는 **8·9기 2개 기수**에 한정된 diff-0 재사용이다. 시즌2 90여 명 전 기수의 라이브
확인은 여전히 권장 — 아래 실행 수단 참고.

## 남은 일

1. ~~미팅 컬럼 판정~~ — ✅ 위에서 확정(추가 조치 불요).
2. **실행 수단** — `scripts/ops/scoreboard-parity.mjs` 를 `db-audit.yml` workflow_dispatch 로
   돌릴 수 있게 별도 PR **#753**(`chore/scoreboard-parity-audit`) 오픈(§3.5 공용부 계약 —
   `.github/` 는 단독 PR). 이 PR(#720) 머지 후 `gh workflow run "DB Audit (read-only)"
   -f script=scoreboard-parity -f cohort=<전 기수>` 로 전수 확인 가능. diff 가 "미팅" 필드에만
   집중되면 → `weeklyPerfFromDb` 의 미팅 판정을 `isDone` 대신
   `salesRows.meetingReservation` 합산으로 교체(스크립트가 이 가능성을 콘솔에 이미 안내).
3. 머지 창구·순서는 반장 판정(§3.5 직렬 머지) — 아레나2(BBE-42)·시즌2 개막(8/7) 모두 경과.

## 롤백
이 PR 은 `loadWeeklyBundles` 가 DB 배치 실패 시 자동으로 시트 경로 폴백(코드 내장, 별도
플래그 불요) — 배포 후 문제 시 PR revert 1건이면 시트 전용 경로로 완전 복귀.

## Log
- 2026-08-05 구현 완료(작업원D) — 코드·단위테스트·check.sh 초록. 라이브 parity 미실행(로컬
  credential 없음, §0.8 명시). PR 오픈, 머지는 belie 지시로 보류.
- 2026-08-09 인수(데탑 C작업원D 260809-2) — 접수 도장 확인(다른 세션 도장 0건) 후 인수.
  master 리베이스(3회, 반장이 큐를 빠르게 드레인 중) · 미팅 컬럼 미확정 해소(위 경위) ·
  가드테스트 3건 추가 · parity 실행 수단 PR #753 분리 오픈. check.sh 전체 초록(1132 tests).

---
slug: profile-stats-db
status: active
created: 2026-08-06
owner: 작업원B(260806) → 데탑 C작업원C(260809) 인수(리베이스+A2 실측+머지)
related: sheet-retirement-r7, db-write-flip, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `readProfileBundle.stats`(admin/트레이너/회장 화면의 수강생별 미팅예정·완료·계약 카드)를 파일럿 기수에 한해 시트 batchGet 대신 DB 배치 조회로 대체 — belie 가 체감하던 [수강생관리] 진입 지연(BBE-48)의 근본 원인 제거.
> - **누가 읽나요**: 반장(FM), belie(머지 시점 결정), 후속 R7 Phase 3 작업자
> - **어떤 기능·작업과 연결?**: R7(시트 은퇴) Phase 3 #15(BBE-64) · `docs/plans/active/sheet-retirement-r7.md` §2-B
> - **읽고 나면 알 수 있는 것**: 무엇을 바꿨나 / 왜 이 범위로 좁혔나(cohort·날짜는 안 바꿈) / 계약 카운트가 왜 계약여부가 아니라 상태 필드인가 / 남은 위험은 무엇인가
> - **관련 문서**: `docs/plans/active/sheet-retirement-r7.md`(R7 전체 조감도), ADR 없음(신규 SSOT·타입 추가 없음)

# readProfileBundle.stats DB 대체 (BBE-64)

## 1. 문제

`app/admin/users/page.tsx` → `enrichUsersWithStats`(`lib/service/me.ts`) → `readBundle` → `readProfileBundle`
(`lib/repo/sales.ts`) = **수강생 1인당 시트 1회 batchGet**. DB 경로가 전혀 없었다. 동시성 5 +
10분 캐시로만 완화 중이라 캐시 미스 시 Sheets quota 429 → 지수 백오프 → 10~20초 체감.
같은 함수 체인을 `/admin/users`·`/trainer`·`/captain` 세 화면이 공유한다.

## 2. 범위 — `stats` 만, `cohort`/`name`/`courseStart`/`graduation` 는 그대로

`readProfileBundle` 은 4개 필드(cohort/name/courseStart/graduation)와 `stats` 를 한 batchGet 로
묶어 온다. 이 중 **DB 대응값이 있는 건 `stats` 뿐**이다 — cohort/name/날짜는 DB(`sheet_rows`)에
없는 시트 전용 값(B3/C3/O1/O2)이라 대체할 게 없다. 그래서 `enrichUsersWithDates` 는 손대지 않고
`enrichUsersWithStats` 만 다시 짰다. (`enrichUsersWithDates` 는 이미 registry 캐시 fast-path 로
같은 quota 문제를 다른 방식으로 완화 중이다 — 별도 개선 여지가 있으면 후속.)

## 3. 계약 카운트 정정 — 계약여부(K) 아니라 상태(J)="계약"

실측(수식 **설치 코드**, `lib/repo/setup-formulas.ts`, 문서가 아니라 코드가 정본):

```
L(미팅완료수) = COUNTIFS(04!J,"계약",AO,"<>이월") + COUNTIFS(04!J,"완료",AO,"<>이월")
N(계약건수)   = COUNTIFS(04!F,채널, 04!J,"계약", AO,"<>이월")
```

N 열은 **상태(J)="계약"** 을 직접 센다. `계약여부`(K) 는 `meeting.ts:79` 주석에 "J='계약'과
동기화(호환용)" 이라 적혀 있는 **파생 필드**다. 시트 수식과 1:1 대응하려면 상태를 써야 한다 —
이 구분이 실제로 갈리는 경우(계약여부만 true 이고 상태는 이미 완료로 바뀐 사후 갱신 누락 등)가
있을 수 있어, `traineeFunnelStatsFromDbRows` 는 명시적으로 상태 필드를 검사한다
(`tests/service/profile-stats-db.test.ts` 회귀 테스트로 고정).

## 4. `weeklyContractsFromDb` 를 재사용하지 않은 이유 — 기존 코드의 갭 발견

`lib/service/dashboard-aggregates.ts` 에 이미 비슷한 계산(`weeklyContractsFromDb`)이 있어 처음엔
재사용을 검토했다. 그런데 **이 함수엔 이월(carryover) 제외 필터가 빠져 있다** — 실제 N 열 수식은
`AO<>이월` 을 거는데, `weeklyContractsFromDb` 는 상태만 보고 이월 여부를 안 본다. 이 함수는
R2-7a "그림자 대조 전용"(아직 서빙 안 함) 코드라 지금 당장 사용자에게 틀린 숫자가 나가진
않지만, **회장(`/captain`) 화면 대상이 전원 아레나(=이월이 실제로 생기는 파일럿 집단)** 라
이 갭을 그대로 재사용했다면 정확히 이 기능이 가장 많이 쓰이는 화면에서 계약 수가 부풀 뻔했다.

**이 PR 은 `weeklyContractsFromDb` 를 고치지 않는다**(그림자 대조 소유 트랙 범위, R2-7a) —
`DONE`/`CARRYOVER` 술어만 그 파일에서 export 해 재사용하고, 윈도우·이월 처리는
`profile-stats-db.ts` 에서 새로 올바르게 짰다. **별도 후속 필요**: `weeklyContractsFromDb` 에
이월 제외를 추가할지(그림자 대조 diff 가 갑자기 바뀔 수 있어 그 트랙 소유자 판단 필요) belie/FM
에게 알린다(worklog 로그 항목 참조).

## 5. 구현

| 파일 | 계층 | 역할 |
|---|---|---|
| `lib/repo/db/profile-stats.ts` (신규) | repo | `readProfileStatsRowsFromDbBatch` — `spreadsheet_id = ANY($1)` 배치 쿼리 2회(sales·meetings) |
| `lib/service/profile-stats-db.ts` (신규) | service | `traineeFunnelStatsFromDbRows`(순수) + `profileStatsFromDb`(배치 오케스트레이션) |
| `lib/service/dashboard-aggregates.ts` (수정) | service | `DONE`/`CARRYOVER` export 추가만(로직 무변경) |
| `lib/service/me.ts` (수정) | service | `enrichUsersWithStats` 재작성 — 파일럿/비파일럿 분리 → 배치 DB 1회 + 기존 시트 경로 병행 → 순서보존 병합 |

**게이트**: `isDbReadPilot`+`dbEnabled()` 그대로 재사용(새 판정 기준 추가 안 함).
**비파일럿은 완전 불변** — `readBundle`/`readProfileBundle`/`pMapBundle` 코드 자체를 건드리지 않았고,
분리된 sheetPath 배열만 그 경로를 지난다.
**병합**은 객체 identity 기반 Map(문자열 키 아님) — 트레이너/admin 행이 `spreadsheetId=""` 로
중복될 수 있어 문자열 키 Map 은 충돌 위험이 있었다.
**DB 배치 실패 시** 그 파일럿 배치 전원이 시트 경로로 폴백(개별 재시도 없음 — `loadDashboard` 와
동일한 all-or-nothing 정책, 부분 재시도는 이 PR 범위 밖의 새 영역).

## 5.5 적대적 리뷰(2026-08-06) — 발견·수정

Workflow 3렌즈(정합성·비파일럿 회귀·동시성/타입) 병렬 리뷰 + 스켑틱 검증(13건 제기 → 11건
확인). 실제로 고친 것:

- **[HIGH, 두 렌즈 독립 확인] `profileStatsFromDb` 결과를 `spreadsheetId` 로 키 잡은 Map**
  이었던 것을 **입력과 같은 순서의 배열**로 바꿈. 부부/멀티계정은 시트를 공유해 같은
  `spreadsheetId` 를 쓰는데(`lib/repo/users-claim.ts`), `/captain` 화면(`listArenaCohortMembers`)
  은 이런 중복 행을 거르지 않아 실제로 도달 가능 — 문자열 키 Map 이면 한쪽이 다른 쪽 결과로
  조용히 덮어써진다(missing 이 아니라 **wrong** 값). `me.ts` 의 병합도 index 기반으로 맞춤.
  회귀 테스트 2건 추가 + 실제로 실패하는 것 확인 후 원복.
- **[LOW, 방어 코드 정합] `salesRowFromPayload` 에 `.slice(0,10)` 정규화 + 빈 date/channel
  필터 추가** — 형제 함수 `readSalesRowsFromDb`(client.ts)와 완전히 같은 방어를 적용해
  "동일 필터 규칙 재현"이라는 헤더 주석을 실제로 참으로 만듦. `toNum` 에도 `Number.isFinite`
  가드 추가(client.ts 와 동일).

기록만 하고 안 고친 것(범위 밖 판단, 저위험):
- DB 배치(`profileStatsFromDb`)와 시트 배치(`pMapBundle`)가 순차 실행 — 정확성엔 영향 없고
  지연시간만 `max(db,sheet)` 대신 `db+sheet`. 병렬화하려면 "DB 실패 시 그 배치를 sheetPath 로
  옮긴다"는 폴백 흐름을 재설계해야 해서 머지 전 시간 압박 속에 새 버그를 넣을 위험이 더 크다고
  판단 — 후속 과제로 남김.
- `courseStartISO` 가 문법적으로만 검증되고(달력 유효성 미검증) 손상되면 주차 창이 밀릴 수
  있음 — 이 PR 이전부터 있던 패턴(`enrichUsersWithDates` 의 동일 정규식)과 같은 급이라 이 PR
  에서 새로 만든 위험은 아님.
- `parseISOLocal` 이 `me.ts`/`profile-stats-db.ts` 에 중복 — 이미 이 코드베이스에 6곳 넘게
  같은 헬퍼가 중복돼 있는 기존 관행(리뷰가 확인), 이 PR 만 따로 안 고침.

## 6. 남은 위험 (belie/FM 인지 필요)

- ~~**A2(아레나 시즌2) 백필 미완료**~~ → **2026-08-09 실측으로 해소.** 근거는 §8 참조 —
  DB Audit(read-only) `dashboard-parity` 를 A2 8개 기수 전원(53명)에 대해 실행, **"전부 0으로
  보임" 최악 시나리오는 반증됨**. 잔존 위험은 아래 §4 갭과 개별 사용자 2명의 부분 결측뿐.
- **§4 의 `weeklyContractsFromDb` 이월 갭 — 2026-08-09 재확인, 여전히 미해결(코드 실측)**:
  `lib/service/dashboard-aggregates.ts:116-127`(현재 origin/master) 에 카나리아 없음 —
  `if (m.상태 !== "계약") continue;` 뒤에 이월 배제가 없다. 이 PR 이 아니라 **다른 함수**
  (`weeklyActivityFromDb`·`channelMatrixFromDb`)는 이미 이월을 배제하므로 이 함수만 예외.
  이 PR 은 여전히 이 함수를 재사용하지 않고 자체 구현(`traineeFunnelStatsFromDbRows`)으로
  우회 — 별도 belie/FM 결정 필요(그림자 대조 R2-7a 소유, 현재 미서빙이라 사용자 영향 없음).
- 파일럿 사용자 통계는 이제 **캐시 없이(live)** 조회된다 — 비파일럿(10분 캐시)과 체감 속도가
  달라짐(파일럿이 더 빠르고 즉시 반영). 버그 아님, PR 설명에 명시.

## 8. A2 백필 실측 검증 (2026-08-09, 데탑 C작업원C(260809))

머지 전 마지막 게이트(§7 마지막 항목)를 실측으로 닫기 위해 `DB Audit (read-only)` 워크플로의
`dashboard-parity` 스크립트를 A2 전체(`A2-1..A2-8`, 53명)에 실행(run
[31314769805](https://github.com/bbelieff/salespt-log/actions/runs/31314769805), 시트·DB
**쓰기 없음**).

**결론 — 백필은 됐다. "전부 0" 위험은 없다.** 53명 중 diff 0 = 26명, 나머지 27명에서 47건의
필드 diff 가 나왔지만, 원인을 갈라보면:

1. **다수(약 40건) = `R1:U6.<채널>.계약`** — 이 값은 `channelMatrixFromDb` 가 아니라
   그 함수를 감사 스크립트가 그대로 재현한 것으로, **`계약여부`(파생·동기화용 필드) 기준**이다
   (`scripts/ops/dashboard-parity.mjs:118` = `if (mt.계약여부) …`, 원본 로직도 동일). 이 PR 이
   진단한 §3 문제(계약여부는 상태와 어긋날 수 있는 호환 필드)가 **기존 프로덕션 경로에서
   실제로 관측된 것** — BBE-64 신규 코드가 만든 문제가 아니고(이 PR 은 이 함수를 안 씀),
   이 PR 이전부터 있던 드리프트다. 별도 트랙(R2-7a/BBE-66) 소관.
2. **소수(2건) = `N.주X계약`·`H.주X활동`** — 이건 BBE-64 가 실제로 쓰는 것과 같은 계열
   (상태 기준 주차 집계)이라 더 눈여겨봤다: `seungik1128@gmail.com`(A2-7기) `N.주4계약:
   sheet=2 db=0`, `snhinss2@gmail.com`(A2-7기) `H.주1활동: sheet=13.5 db=0`. **DB 가 시트보다
   낮다** = 그 사용자·그 주차의 미팅 행 일부가 DB 에 없다(부분 결측, 전면 결측 아님). 2/53명
   한정이라 "화면이 전부 0" 최악 시나리오는 아니지만, 이 두 사용자는 해당 주차 계약·활동
   숫자가 실제보다 낮게 보일 수 있다.

**판정**: §7 마지막 게이트를 "확인됨"으로 닫는다 — 전체 무효화 위험은 없고, 남은 결측은
2명·개별 주차 단위로 소규모다. 벨리 승인 없이 §0.7 자율 진행(가역적 — revert 1건, 이 PR 이
데이터를 쓰지 않으므로 되돌리면 완전 원상복구).

## 7. 수용 기준

- [x] `traineeFunnelStatsFromDbRows` 단위 테스트 — 계약=상태 기준, 이월 제외, 8주 창 경계 (10건)
- [x] `readProfileStatsRowsFromDbBatch` 배치 SQL 테스트 — raw-pg-mock (10건, 방어코드 3건 포함)
- [x] `enrichUsersWithStats` 게이팅·병합 테스트 — 비파일럿 불변·파일럿 DB 경로·순서보존·
      DB 실패 폴백·courseStartISO 없음 폴백·dbEnabled false 폴백·**부부/멀티계정 spreadsheetId
      공유·트레이너 admin 행 2개 동시** (18건)
- [x] 회귀 검증 — 게이트 로직·부부 index 병합 제거 시 실제로 테스트가 빨개지는 것 실측 후 원복
- [x] 적대적 리뷰(3렌즈+검증) — HIGH 1건 수정, LOW 방어코드 2건 반영
- [x] check.sh 초록(typecheck·lint·구조 25/25·단위 1132·doc-drift·500줄 캡, 2026-08-09 리베이스 후 재검증)
- [x] §6.8 배포 확인 — **머지는 8/7 개막 이후**(belie 지시, 관리자 화면 전체 영향) — 오늘(8/9) 충족
- [x] A2 백필 실측 확인(§8) — belie 승인 대기 없이 §0.7 자율 판정(가역적·데이터 무쓰기)

## Rollback

읽기 전용 추가 — 스키마 변경 없음(기존 `sheet_rows` 테이블 사용), 쓰기 경로 무변경. 게이트
(`isDbReadPilot`+`dbEnabled()`) 는 이미 존재하고 다른 기능에서도 검증된 것 재사용. squash 커밋
1건 revert 로 완전 원복 — 비파일럿은 애초에 안 건드렸으니 되돌릴 것도 없다.

## Log

- **2026-08-09 인수(데탑 C작업원C(260809))**: belie 직접 지시 — "BBE-64 착수, PR 생사 확인부터,
  BBE-48(admin/users 느림) 근본수리라 파급 크니 §0.8 5단계 다 밟아라." PR #713 **생존 확인**
  (belie 코멘트 "반장 판정: 개막 후로 보류" — 폐기 아님, 창구 대기였을 뿐). `origin/master`
  위로 리베이스(`b85c1f7`→`b67de8a` 34커밋 차) — 충돌 2건(worklog 양쪽 보존 편집, 나머지는
  auto-merge) 해소 → `82bb5e8`. check.sh 재검증 초록(1132 테스트, 리베이스 전 1038 대비 증가는
  BBE-53·BBE-57 등 사이 병합분). §8 A2 실측 검증(dashboard-parity 감사, 아래) 으로 마지막
  게이트 닫음 → 머지 준비 완료.
- 2026-08-06 착수(작업원B): Workflow 병렬 리서치(6 에이전트) + 설계 합성 → 코드 실측으로
  직접 재검증(계약=상태 vs 계약여부, weeklyContractsFromDb 이월 갭 발견) → 구현 → 3계층 테스트
  24건 → check.sh 초록. 적대적 리뷰 워크플로(3 렌즈 + 검증) 병행 실행.

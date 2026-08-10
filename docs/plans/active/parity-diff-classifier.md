---
slug: parity-diff-classifier
status: active
created: 2026-08-10
owner: 경영일지 데탑 C작업원C(260809)
related: sheet-retirement-r7, db-write-flip
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: dashboard-parity·scoreboard-parity·registry-parity 3개 감사 스크립트에
>   diff 원인 자동분류(시차·렌더옵션·로직차이·진짜불일치)를 추가 — 손분류에 카드 하나당 며칠
>   쓰던 것을 없앤다. BBE-66·63 두 카드가 이 도구로 동시에 풀린다.
> - **누가 읽나요**: BBE-66/67/68/63 을 다시 여는 세션, 반장, belie
> - **어떤 기능·작업과 연결?**: `scripts/ops/parity-classify.mjs`(공용 분류기) ·
>   `scripts/ops/{dashboard,scoreboard,registry}-parity.mjs` · `docs/incidents/2026-08-10-scoreboard-db-parity-gap.md`
> - **읽고 나면 알 수 있는 것**: 4개 분류축이 뭔지 / 왜 "시차" 판정에 시트 원본 행을 다시 읽는지 /
>   무엇을 검증했고 무엇을 검증 못 했는지
> - **관련 문서**: `docs/incidents/2026-08-10-scoreboard-db-parity-gap.md`(이 도구가 메꾸는 하네스 갭)

## 0. 배경 — belie 최우선 지시(2026-08-10)

> "parity 도구에 diff 원인 분류를 추가해라. 지금 세션들이 diff 를 손으로 분류하느라 카드
> 하나에 4일씩 쓰고 있다(BBE-66 실측). BBE-63 도 라이브 40% diff 로 롤백됐고 같은 손작업을
> 또 해야 한다. 이게 되면 BBE-66·63 이 동시에 풀린다."

실측 근거(착수 전 확인):
- BBE-66: `dashboard-parity` 오늘 재실행(run `31328856551`)이 어제(`31267667665`)와 diff 사용자
  29명 100% 동일 — 그 사이 원인가설(BBE-65)이 머지됐는데도 무변화. 근인 미상 상태로 며칠째 정체.
- BBE-63: 라이브 배포 후 `scoreboard-parity` 실행(run `31330346822`) — 52명 중 21명(40%) diff,
  전부 `db=0, sheet>0` + 미팅·계약 동반. 즉시 롤백(`docs/incidents/2026-08-10-scoreboard-db-parity-gap.md`).

## 1. 분류축 4개

| 축 | 의미 | 판정 방법 |
|---|---|---|
| **시차** | 백필 이후 시트에 쌓인 신규 행 — 그 행 자체가 DB 에 없음 | 시트 **원본 행**을 같은 로직으로 재계산해 시트 수식값과 일치·DB 재계산과는 다름을 확인(=DB 에 없는 행이 있다는 뜻) |
| **렌더옵션** | SERIAL_NUMBER vs FORMATTED_STRING(#752) | DB row 의 날짜류 필드가 미변환 raw serial(20000~60000 범위 숫자문자열)로 보이면 확정 |
| **로직차이** | 이월 포함/제외·계약여부 vs 상태 등 계산식 불일치 | "대안식"으로 재계산했을 때 sheet 값과 일치하면 그 식이 근인 |
| **진짜불일치** | 위 3개 어디에도 안 걸림 | 기본값 — 이것만 사람이 조사 |

판정 순서 = 표 순서(①②③ 먼저 걸리는 것으로 확정, 다 아니면 ④). 근거는
`scripts/ops/parity-classify.mjs`(공용, 순수 함수 — 세 스크립트가 공유).

## 2. 설계 핵심 — "시차" 판정에 왜 시트 원본 행을 다시 읽나

`dashboard-parity.mjs`/`scoreboard-parity.mjs`는 원래 시트 쪽은 **수식이 이미 계산해둔 셀 값**만
읽었다(R1:U6, C33:H40 등). DB 재계산이 이 값과 다르면 "뭔가 다르다"는 것만 알지, DB 에 그 행
자체가 없어서인지(시차) 계산식이 달라서인지(로직차이) 구분할 수단이 없었다.

그래서 diff 가 있는 사용자에 한해(쿼터 절약 — 깨끗한 사용자는 추가 호출 0) 04(미팅)·02(계약)
탭 **원본 행**을 추가로 읽어, DB row 와 **똑같은 정규화·집계 함수**(`computeAggregates`/
`computeWeeklyPerf`)로 다시 계산한다. 결과가 시트 수식값과 일치하면 "시트 데이터 자체는 맞다"는
뜻이고, 그런데도 DB 재계산과 다르면 남은 설명은 하나뿐이다 — **그 행이 DB 에 없다.**

이 "후보 행 풀(contrib)"은 대안식 판정(로직차이)에도 재사용된다 — 예: `R1:U6.{채널}.계약`
필드의 후보는 "계약여부=true 였던 것만"이 아니라 "그 채널의 이월 아닌 미팅 전부"다. 좁게 담으면
"상태=계약 기준" 대안식이 원래 조건(상태=계약인데 계약여부=false)을 볼 수 없어 로직차이를 못
잡는다 — 실제로 이 버그를 짜다가 발견해 고쳤다(단위테스트로 고정, `dashboard-parity-lib.test.ts`
"contrib 후보 풀은 실제 카운트 조건과 무관하게..." 케이스).

## 3. 스코프 — 무엇을 분류하고 무엇을 안 하나

- **시차 판정 대상 = 미팅·계약 파생 필드만**(`R1:U6.*.미팅예약/미팅완료/계약`, `N.주X계약`,
  `B21.누적수임비`, `주X.미팅/계약`). **sales(03 DB관리 4섹션 포맷) 파생 필드(생산/유입/컨택/
  H활동)는 스코프 밖** — 03 탭 레이아웃이 더 복잡해 원본 행 재fetch 를 이번엔 안 붙였다. 이
  필드들의 diff 는 렌더옵션·로직차이로 안 걸리면 진짜불일치로 남는다(과다 아님 — 정직한 한계).
- **registry-parity 는 "로직차이" 축이 없다** — 계산식이 아니라 값 1:1 대조라 렌더옵션/진짜불일치
  둘로만 나뉜다. `missingInDb`(자연키 자체가 DB 에 없음)는 재계산 없이 바로 시차로 확정한다
  (정의상 명백하므로).
- **scoreboard-parity.mjs 자체가 이 PR 로 복원됨** — BBE-63 롤백(#774)이 라이브 코드와 함께
  이 감사 스크립트도 지웠었다. 감사 도구는 기능(BBE-63 본체)과 독립적으로 항상 살아있어야
  근인 재확인이 가능하다는 게 인시던트 문서의 "하네스 갭 ①"이었다 — 이번에 해소.

## 4. 검증

- 순수 로직 전부를 `-lib.mjs` 로 분리(I/O 없음, import 시 부작용 없음 — CLI 진입점은
  `isMainModule` 가드 뒤로, `backfill-db-row-numbers.mjs` 선례와 동일 패턴). 세 CLI 파일 모두
  env 없이 실행해도 안전하게 사용법만 출력하고 종료함을 직접 확인(`node scripts/ops/*.mjs` 무인자 실행).
- 단위테스트 47건(신규 39 + 기존 8) — `parity-classify`(17)·`dashboard-parity-lib`(8)·
  `scoreboard-parity-lib`(5, **2026-08-10 인시던트의 정확한 패턴을 합성 데이터로 재현**)·
  `registry-parity-lib`(9). check.sh 초록.
- **실제 DB 데이터로는 검증 못 함**(로컬에 DATABASE_URL 없음, worker-onboarding.md 함정 §C) —
  머지 후 `gh workflow run "DB Audit (read-only)"` 로 VPS 실행 결과를 받아 분류가 실제로
  BBE-66/63 의 diff 를 의미 있게 나누는지 재확인 필요(§0.8 "검증 안 한 것을 검증한 것처럼
  내놓지 않는다").

## 5. 수용 기준

- [x] 4개 분류축 + belie 요청 출력 형식(유형별 건수 + 샘플 3건 + "진짜 불일치"만 목록)
- [x] 3개 스크립트 전부 적용(dashboard·scoreboard·registry-parity)
- [x] scoreboard-parity.mjs 복원(BBE-63 롤백으로 유실됐던 것)
- [x] 순수 로직 단위테스트 커버 + check.sh 초록
- [ ] **VPS 실행으로 실데이터 검증**(belie/반장 — 머지 후 `dashboard-parity`·`scoreboard-parity`
      재실행해 BBE-66/63 의 diff 가 실제로 분류되는지, 그리고 "시차" 판정이 인시던트가 가리키는
      바로 그 문제와 일치하는지 확인)

## 6. 롤백

읽기 전용 감사 스크립트만 변경 — 앱 코드·DB 스키마·배포 설정 무접촉. 되돌리면 이전 스크립트로
복귀(분류 없이 raw diff 만 출력). squash 커밋 1건 revert.

## Log
- 2026-08-10 착수·완료(데탑 C작업원C(260809)): belie 최우선 지시 → 3개 스크립트에
  parity-classify.mjs 공용 분류기 통합 + scoreboard-parity.mjs 복원 + 단위테스트 47건.

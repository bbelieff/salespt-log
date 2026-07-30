---
slug: r4-archived-routing
status: active
created: 2026-07-26
owner: belie
track: DevE (R4 wave-1 W1-2)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R4 무제한 CRM의 G2 결정(수료생 정상 진입)을 라우팅 코드에 반영 — `/claim` 강등 사유를 "미등록"만 남긴다.
> - **누가 읽나요**: 개발자(DevE 구현·DevD VERIFY·DevB 설계 정합 확인)
> - **어떤 기능·작업과 연결?**: `lib/repo/user-priority.ts`(shouldRedirectToClaim), `app/page.tsx`, `app/(app)/layout.tsx`, `tests/repo/rejoin-routing.test.ts`
> - **읽고 나면 알 수 있는 것**: 왜 archived 강등을 없애나 / 입장(read)과 저장(write)이 왜 분리되나 / 재참가(rejoin)는 어떻게 유지되나
> - **관련 문서**: `scratchpad/r4-hardcode-inventory.md` §2.4(지도), R4 plan `r4-unlimited-crm.md`(DevB #623), ADR-0029

# R4 W1-2 — archived 라우팅 개정 (G2)

## 배경·결정

**belie 결정 G2=A**(2026-07-26): "수료 후에도 쓰는 무제한 CRM" → **수료생도 정상 진입**, 미등록만 클레임.

기존 라우팅은 보관(행 `status=archived` 또는 cohorts 탭 보관 기수)이면 `/claim` 으로 강등했고,
2026-07-07 `hasOwnSheet` 예외가 그것만 면제했다(함진숙 무한 클레임 루프 수정). **R4는 그 예외를 기본으로 승격**한다.

## ⚠️ 실제 동작 변화 (적대리뷰 후 정정 — 과대선전 금지)

동치 매트릭스로 master 와 실측 대조한 결과, **G2 주 수혜자(수료+시트 보유)는 master 에서도 이미 통과**했다
(2026-07-07 `hasOwnSheet` 예외가 사실상 G2 를 선반영). 따라서 이 PR 의 정직한 가치는 "수료생 개방"이 아니라:

| 사용자 | master | 이 PR | 판정 |
|---|---|---|---|
| 수료(archived)+시트 보유 | 통과 | 통과 | **동일**(목표 상태를 테스트로 박제) |
| 보관 기수+시트 보유 | 통과 | 통과 | **동일** |
| 현행 수강생 | 통과 | 통과 | 동일(회귀 0) |
| **미등록 trainee(시트 없음·보관 아님)** | 통과 → **빈 대시보드** | **/claim** | ✅ **실질 개선** |
| 트레이너·admin(시트 없음) | 통과 | 통과 | 동일(무한루프 결함 수정 후) |

**실제 산출**: ① 중복 분기(page/layout 3분기 ×2) → 단일 함수 ② "왜 통과시키는가"를 이름·주석·테스트로 박제
(다음 리팩터가 되돌리면 실패) ③ 미등록자가 빈 대시보드 대신 클레임으로 ④ 홈 hot-path 의 cohorts read 제거.

## 🚨 적대리뷰가 잡은 결함 (머지 전 수정 완료)

초안은 `shouldRedirectToClaim = !hasOwnSheet(u)` 였다. `hasOwnSheet` 는 `role==="trainee"` 를 요구하므로
**모든 트레이너가 항상 강등 대상**이 됐고, layout 에서 트레이너 분기보다 **먼저** 호출돼
`/claim → / → /dashboard → /claim` **무한루프**(2026-07-07 트레이너 차단 사고의 재발)를 만들었다.

수정: ① 함수에 `role !== "trainee" → false` 명시(원인 차단) ② layout 순서를 트레이너 분기 **뒤로**(이중 방어)
③ `pending` 은 강등 대상에서 제외(대기화면이 담당 — 승인 대기자가 클레임 폼으로 되돌아가는 루프 방지)
④ 회귀 테스트 3종 추가 + **변이 테스트로 검증**(결함 코드로 되돌리면 정확히 3개 실패 확인).


## 🚨 적대리뷰 BLOCKER 2 (조합 검증에서 발견·수정 완료)

W1-1+W1-2 **조합** 검증(3각도)에서 초안의 두 번째 치명 결함이 나왔다.

**무엇**: 초안은 "시트 없는 등록 trainee" 도 `/claim` 으로 강등했다. 그러나
`claimAccount` 는 그 행이 보관이 아니면 **레지스트리를 건드리지 않고 200 을 반환**하고
(short-circuit), 클레임 화면은 200 을 받으면 `"/"` 로 되돌린다 → **홈 ↔ 클레임 영구 루프**.
그 사용자는 앱에 **아예 들어올 수 없다**. master 에서는 통과(대시보드 진입)했으므로 **순수 락아웃 회귀**.

**실피해**: 현재 registry 실측 **0명**(비보관 trainee + 시트 없음 = 0). 단 시트 없는 행은
열밀림 복구 잔재·수기 편집(#546 전례)으로 생길 수 있어 잠복 위험은 실재.

**수정**: 강등 기준을 **"레지스트리 행 존재" 하나로** 축소 — `shouldRedirectToClaim(u) = !u`.
- 행 있음 → 시트·보관 여부 무관 **통과**(재참가는 `/claim` 직접 열어 이용).
- 행 없음 → `/claim`(claimAccount 가 신규 생성하므로 루프 없음).
- layout 의 `u &&` 가드도 제거 → **행 없는 직접 URL 진입**까지 강등(master 는 앱 셸을 그대로 렌더했다).
- 회귀 박제 + **변이 테스트로 검증**(BLOCKER 코드 복원 시 정확히 4건 실패).

∴ 이 PR 의 최종 동작 변화는 **"행 없는 사용자의 layout 직접 진입 차단"** 하나이며,
나머지는 중복 3분기 → 함수 1개 통합과 의도 박제다. 수료자 입장은 이전에도 열려 있었다.

## 변경 (인벤토리 §2.4 맵 기준)

| 대상 | 변경 |
|---|---|
| `lib/repo/user-priority.ts` | **`shouldRedirectToClaim` 신설** — 강등 판정 SSOT. `!hasOwnSheet(u)` 와 동치이나 의도를 이름으로 박제 |
| `app/page.tsx:65-69` | 3분기(`hasOwnSheet` + `status==="archived"` + `isNumericCohortArchived`) → **1줄**. `getArchivedCohortSet` import 제거 |
| `app/(app)/layout.tsx:48-51` | 동일 중복 블록 → **1줄**(두 곳 로직 통합) |
| `tests/repo/rejoin-routing.test.ts` | `shouldRedirectToClaim` describe 신설(9 케이스). 기존 분류 테스트는 **보존** |

**보존한 것(중요)**:
- `isNumericCohortArchived`·`getArchivedCohortSet` — **분류·집계·표시용으로 유지**(claim 서비스, admin/trainer 페이지). 라우팅 강등만 분리했다(인벤토리 §2.4 "마킹과 강등의 결합 해소").
- **재참가(rejoin)** — 보관자가 `/claim` 을 직접 열면 신규 기수 합류가 그대로 동작(`lib/service/auth.ts` claimAccount 는 archived 를 short-circuit 하지 않음). 강제 이동만 없앴다.
- `users-arena.ts` 의 이월 후 archived 마킹 흐름 — 무접촉.

## 경계 (이 PR 밖)

- **쓰기 권한(G1)은 W1-1(DevB)** — `getWritableUserEmail` 의 archived READ_ONLY throw 제거는 여기서 하지 않는다.
  입장(read)과 저장(write)은 R4에서 분리된 축이다.
- 그래서 **머지 순서가 W1-1 → W1-2**: 저장 게이트를 먼저 열지 않고 입장만 열면
  "입장했는데 읽기전용"이라는 중간 상태가 프로덕션에 노출된다.
- 표시층(수료 배지·주차 표기)은 W1-3(DevC).

## 수용 기준

- [x] `shouldRedirectToClaim` 신설 + page/layout 두 곳이 이 함수만 호출(중복 분기 0)
- [x] 수료(archived)+시트 보유 → 입장 통과 / 미등록 → `/claim`
- [x] 분류 함수·재참가 클레임·이월 마킹 불변
- [x] 회귀 테스트(9): 미등록·시트없음·수료입장·보관기수입장·현행수강생·트레이너·hasOwnSheet 동치·재참가 유지
- [x] check.sh 초록
- [ ] **W1-1 머지 후 PR 오픈·착지**(직렬 순서 — 저장 게이트 선행)
- [ ] DevD 독립 VERIFY

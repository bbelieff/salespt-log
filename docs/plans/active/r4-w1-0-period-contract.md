> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R4 wave-1 선행 공용부 계약 — 기간·날짜 상수 SSOT(cohort-dates.ts)와 주차 계산 SSOT(week.ts)를 신설하고, 재발을 구조테스트(G1~G8)로 차단한다. 동작 무변경.
> - **누가 읽나요**: 개발자 (R4 wave-1 후속 트랙 전원 — 이 계약 위에서 작업)
> - **어떤 기능·작업과 연결?**: R4(무제한 CRM) 전 wave · `scratchpad/r4-hardcode-inventory.md`(입력) · ADR-0005
> - **읽고 나면 알 수 있는 것**: ① 상수·주차 계산의 정본이 어디인가 ② weekIndexOf 두 앵커(시작일/금~목)가 왜 분리인가 ③ G1~G8이 무엇을 차단하고 무엇을 baseline으로 박제했나
> - **관련 문서**: `lib/config/cohort-dates.ts` · `lib/util/week.ts` · `tests/structural/period-hardcode.test.ts`

# R4 W1-0 — 공용부 계약: 기간 상수 + 주차 SSOT + 구조가드 (동작 무변경)

- **상태**: 구현 → PR
- **트랙**: A (DevA) · WORK-ID: R4-W1-0 · 머지 큐 1순위

## 1. 산출물

| 파일 | 역할 |
|---|---|
| `lib/config/cohort-dates.ts` (신설) | GRADUATION_OFFSET_DAYS(50)·_LEGACY(57)·ALLOWED_GRAD_OFFSETS·EDIT_WINDOW_DAYS(69)·MAX_SHEET_WEEK(10)·STATS_WEEKS(8). **물리(10)/정책(69)/통계(8) 상한 구분 명문화** |
| `lib/util/week.ts` (신설) | 주차 계산 SSOT. **두 앵커를 이름으로 분리**: `weekIndexOf`(시작일 앵커 — 시트 row 매핑 정본) vs `friWeekIndexOf`(금~목 — UI 정본). 순수·import 0 |
| `tests/structural/period-hardcode.test.ts` (신설) | G1~G8 + 계약값 고정 테스트 |

## 2. 핵심 판단 — "5중복 단일화"의 실체 (§0.5)

인벤토리 G8의 5중복은 **동일 구현이 아니었다**: contact·schedule판은 금~목 앵커, sales.ts·스크립트 2개는 시작일 앵커. 맹목 단일 함수화 = 시트 row가 틀어지는 동작 변경. → util은 **두 의미를 각각 export**하고, `_lib/week.ts` 두 파일은 `friWeekIndexOf as weekIndexOf` 재수출로 API 보존(호출부 무변경). 6번째 인라인 중복(dashboard/page.tsx `floor(elapsed/7)+1`)도 발견·배선(daysBetween(UTC)≡diffDays 검산 완료).

.mjs 스크립트 2개는 TS import 불가 → 사본 유지 + `WEEK-INDEX-SSOT-COPY` 마커 의무(G8 2절이 마커 없는 사본 차단).

## 3. 배선(동작 무변경 상수 치환) 범위

sales.ts(가드 4곳+lastRow+8루프, weekIndexOf/weekStartOf/diffDays는 util import+재수출로 기존 5개 service 소비처 무접촉) · setup-formulas(2) · contact-week/contact(3) · dashboard-aggregates(7) · scoreboard(1) · termination-count(2) · me.ts(offset 재수출) · sheet-diagnostics(ALLOWED_GRAD_OFFSETS) · repo/dashboard(WEEK_ROWS 파생+길이) · WeeklyDualChart(1) · dashboard/page(주차식+clamp) · tsconfig/vitest `@/util/*` 별칭 · layers.test에 lib/util 격리 스캔 추가.

## 4. G1~G8 baseline (박제 — 새 출현만 차단, 소거는 후속 wave)

- **G3**: `lib/types/meeting.ts` Zod `.max(10)` — types는 config import 금지(레이어). R4 W2에서 상한 제거 예정.
- **G5**: `app/(app)/dashboard/page.tsx` 날짜 더미 fallback 2건 — R4 라우팅 재정의에서 소거.
- **G7**: `app/page.tsx`·`app/(app)/layout.tsx`·`admin/set-cohort-status` — archived-routing 재정의 1순위 소거 대상.
- **오탐 제외(인벤토리 §4 준수)**: payment `archivedRows`(해지숨김 식별자 — 문자열 스캔에 자연 비검출) · 기수 `"8"`(문자열 — strip으로 자연 제외) · me.ts offset(config 재수출로 해소).

## 5. 되돌리기

동작 무변경 단일 PR → `git revert <squash-sha>`. 후속 wave가 이 계약 위에 쌓기 전이면 무비용.

## 부수 발견 (스코프 밖, 기록만)

- `inEditPeriod`(contact/_lib/week.ts) — **소비처 0(사장 코드)**. 편집가드는 실제로 saveContactMetrics 경로(시트 물리 가드)로 동작 중. R4 편집가드 재정의 시 이 함수의 처분(삭제/부활) 결정 필요.

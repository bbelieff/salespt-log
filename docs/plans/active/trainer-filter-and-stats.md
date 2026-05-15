---
slug: trainer-filter-and-stats
status: active
created: 2026-05-16
worktree: ../wt/trainer-stats
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: /trainer "내 수강생만 보기" 토글 + 모든 수강생 카드에 8주 누적 funnel(예정/완료/계약) 표시
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/sales.ts`, `lib/service/me.ts`, `components/auth/TraineeCard.tsx`, `TrainerCohortView.tsx`, `app/admin/users/page.tsx`, `app/trainer/page.tsx`
> - **읽고 나면 알 수 있는 것**: 카드 stats 데이터 출처? cache·quota 영향? 토글 동작?
> - **관련 문서**: [[docs/domains/sheet-structure.md]] §01 영업관리 funnel

# trainer-filter-and-stats — 명단 토글 + 카드 funnel 숫자

## Executive Summary
사용자 요청 (2026-05-16):
- **[1] /trainer 에 "내 수강생만 보기" 토글** — 기본 전체 명단, 토글 시 본인 담당만 필터
- **[2] 수강생 카드 중간 영역에 예정/완료/계약 숫자 표시** — /schedule funnel 과 동일 8주 누적

## 변경 사항

### [1] /trainer "내 수강생만 보기" 토글 (TrainerCohortView)
- `showOnlyMine` state + 토글 버튼 (헤더 아래, 수강생 명단 위)
- 토글 ON → `visibleTrainees = trainees.filter(parseAssigned(...).includes(trainerEmailLc))`
- `myCount` 계산 → 토글 라벨에 "✓ 내 수강생만 (N)" / 평소 "내 수강생만 보기"
- activeGroups/archivedGroups 가 `visibleTrainees` 기준으로 재계산

### [2] 카드 stats — 데이터 경로 (서버)
- `lib/repo/sales.ts` `readProfileBundle` 에 E4:E6 range 추가 (기존 batchGet 에 합산 — quota 영향 없음)
  - E4 = 미팅예약 / E5 = 미팅완료 / E6 = 계약 (8주 누적, 시트 수식)
- `lib/service/me.ts`
  - `cachedReadBundle` cache schema 에 stats 포함, key bump `me-bundle` → `me-bundle-v2`
  - `readBundle` 가 stats 노출 (옛 캐시 entries 0 fallback)
  - 신규 `enrichUsersWithStats(users)` — Promise.all 로 각 spreadsheetId 의 stats fetch. cachedReadBundle 공유라 enrichUsersWithDates 가 이미 fetch 했으면 cache hit (별도 호출 0)
  - `TraineeFunnelStats` export
- service barrel (`lib/service/index.ts`) 에 `enrichUsersWithStats` / `TraineeFunnelStats` re-export

### [2] 카드 stats — 타입 + UI
- `components/auth/AdminUserPickerTypes.ts` `Trainee` 에 optional `stats?: { 미팅예정, 미팅완료, 계약 }`
- `components/auth/TraineeCard.tsx` — Row 1.5 추가: `u.stats` 있으면 `📅 예정 X · ✓ 완료 Y · 💼 계약 Z` (amber/indigo/green 강조)

### [2] 서버 페이지
- `app/admin/users/page.tsx`: `enrichUsersWithDates(regularTrainees)` 다음 `enrichUsersWithStats(enriched)` 추가 → AdminUserPicker 에 전달
- `app/trainer/page.tsx`: 동일 패턴 → TrainerCohortView 에 전달

### docs
- `design/components.md` — TraineeCard / TrainerCohortView 설명 갱신

## Acceptance Criteria
- [ ] /trainer 헤더 아래 "내 수강생만 보기" 토글 표시, 클릭 시 본인 담당만 필터, 다시 클릭 시 전체로 복귀
- [ ] 토글 라벨에 본인 담당 수 표시 (예: "✓ 내 수강생만 (12)")
- [ ] /admin/users + /trainer 카드에 `📅 예정 X · ✓ 완료 Y · 💼 계약 Z` 표시 (spreadsheetId 있는 trainee 만)
- [ ] 숫자가 시트 01 영업관리!E4/E5/E6 값과 일치 (= /schedule funnel 동일)
- [ ] Sheets quota 안정 — cachedReadBundle 공유로 stats fetch 추가 호출 0회 (페이지 첫 진입 외)
- [ ] check.sh 전체 통과

## Quota 영향 분석
- `readProfileBundle` 가 3 → 4 ranges (batchGet 1 call 단위 quota — 변동 없음)
- `enrichUsersWithStats` 가 readBundle 호출 → 같은 unstable_cache 공유 → enrichUsersWithDates 가 이미 sheet read 한 경우 cache hit
- 신규 콜드 캐시 (서버 재시작 직후) 시 N 개 trainee × 1 fetch = N batchGet calls 병렬 (60s window 안에)
- 60 명 운영 가정: cold-start 1회 ~60 calls (Sheets quota 60/min/user 한도 근접 → 후속 모니터링)
- 따뜻한 cache 에서는 0 추가 호출

## Log
- 2026-05-16 [1] 토글 + [2] 카드 stats 동시 구현 (cachedReadBundle 공유로 quota 영향 최소화)

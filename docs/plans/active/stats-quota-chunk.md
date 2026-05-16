---
slug: stats-quota-chunk
status: active
created: 2026-05-16
worktree: ../wt/quota-chunk
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #198 stats fetch 도입 후 Sheets API quota 압박 사전 대응 — 동시성 제한(pMapBundle) + cache TTL 연장
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/me.ts` (enrichUsersWithSheetCohort, enrichUsersWithDates, enrichUsersWithStats)
> - **읽고 나면 알 수 있는 것**: 콜드 캐시 시 60명 burst 가 quota 60/min hit 위험을 어떻게 방지하는가?
> - **관련 문서**: PR #198 plan

# stats-quota-chunk — Sheets quota 사전 대응

## Executive Summary
PR #198 가 `enrichUsersWithStats` 도입 (admin/trainer 페이지에서 모든 trainee 시트 1회 fetch). 콜드 캐시 시 60명 → 60 reads 즉시 burst → Sheets API 60 reads/min/SA 한도 hit 위험. **사용자 시연 중 quota 사고 방지 위해 미리 대응.**

## 변경 사항

### `lib/service/me.ts`

#### (1) `pMapBundle` helper 추가
```typescript
async function pMapBundle<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]>
```
worker 풀 패턴 — 5 worker 가 큐에서 task 가져가며 순차 처리. 결과 순서 보존.

#### (2) `cachedReadBundle` TTL 600s → 1800s (30분)
- 콜드 캐시 발생 빈도 1시간당 2회 → 1회로 감소
- trade-off: 시트 직접 수정 시 최대 30분 지연 (admin 액션 후엔 `invalidateTag("me-bundle")` 호출 → 즉시 갱신)

#### (3) `enrichUsersWithSheetCohort` / `enrichUsersWithDates` / `enrichUsersWithStats` 모두 `pMapBundle(concurrency=5)` 적용
- Promise.all 60 동시 → 5 worker 순차
- 60명 cold-start: 12 waves × 5 동시 ≈ 6초 페이지 로드

## Quota 영향
| 시나리오 | 이전 (Promise.all 60) | 신규 (pMap 5) |
|---|---|---|
| Cold cache 60명 burst | 60 reads / ~0.5초 → 60/min sliding window 한도 hit | 60 reads / ~6초 → 10 reads/sec → 한도 안전 |
| Cache hit (대부분) | 0 read | 0 read (변동 없음) |
| Cold cache 빈도 | TTL 600s → 1시간당 2회 | TTL 1800s → 1시간당 1회 |
| 페이지 로드 시간 | ~0.5초 (cold) | ~6초 (cold) — 30분에 1회만 |

**결과**: cold-start 60명 burst 가 Sheets quota 한도(60 reads/min/SA) 안전 범위로 진입.

## Acceptance Criteria
- [ ] `/admin/users` · `/trainer` 페이지 진입 시 정상 표시 (모든 카드 stats 포함)
- [ ] 콜드 캐시 후 첫 진입 시 ~6초 로드 (이후 진입 즉시)
- [ ] `Quota exceeded` 에러 미발생 (운영 중 모니터링)
- [ ] check.sh 전체 통과

## 후속 검토 (별도 PR — 필요 시)
- **Phase 2**: registry 시트에 stats 컬럼 추가 (N/O/P) — 페이지 진입 시 sheet fetch 0회. 동기화 버튼 누를 때만 stamp. 진짜 quota 해방. 큰 변경이라 별도.
- **Phase 3**: stats client-side lazy load — 카드 보일 때만 fetch (intersection observer). 페이지 초기 진입 더 빠름.

## Log
- 2026-05-16 pMapBundle concurrency 5 + TTL 1800s 적용

---
status: completed
slug: stats-cache-10min
created: 2026-05-19
completed: 2026-05-25
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수강생관리 카드 합계(예정/완료/계약) 반영 지연 → me-bundle 캐시 30분→10분 단축
> - **누가 읽나요**: 개발자

# stats-cache-10min

## 사용자 보고 (2026-05-19)
"수강생관리에서 수강생 이름 밑에 합계수치 숫자 카운팅 연동이 안되고있는거 같은데."

## 분석
- 카드 합계(📅예정/✓완료/💼계약) = 01 영업관리 E4:E6 (8주 미팅예약/완료/계약 누적)
  를 `enrichUsersWithStats` 로 read. 데이터 흐름·셀 매핑 정상.
- `cachedReadBundle` (unstable_cache) TTL = **1800s(30분)** → 시트 값 변경이
  최대 30분 늦게 카드에 반영 → "연동 안 됨" 처럼 보임.
- 코드는 1800s 인데 users/page.tsx 주석엔 600s 라고 적혀있던 드리프트도 정리.

## Fix
- TTL 1800 → 600 (10분). 사용자 합의.
- 콜드스타트 quota burst 위험은 PR #244/#245 의 429 retry(exponential backoff)
  + pMapBundle 동시성(5) 으로 흡수.
- "예정" = E4 미팅예약 8주 누적 (= 주간 미팅예약 합산) — 사용자 의도와 일치, 라벨 유지.

## Acceptance
- [ ] me-bundle TTL 600s
- [ ] 시트 미팅 변경 후 10분 내 카드 반영
- [ ] check.sh 통과

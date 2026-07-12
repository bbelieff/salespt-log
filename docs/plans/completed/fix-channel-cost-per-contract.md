---
status: completed
slug: fix-channel-cost-per-contract
created: 2026-05-08
worktree: ../wt/dashboard-v3
completed: 2026-05-11
archived: 2026-07-12
---

# fix: 채널별 계약단가 추가 (ChannelPerformance)

## Intent

사용자 요청: "채널별 계약단가를 채널별 성과에 넣어줘"

ChannelPerformance 좌·우 도넛 아래 full-width로 4채널 계약단가 grid 추가.

## 정의

- **계약단가** = `채널 비용 ÷ 채널 계약건수`
- 의미: 1계약 따는 데 들어간 비용 (낮을수록 효율적)
- 콜·지·기·소: 비용 0이라 "—" 표시 (분모 무관)

## 더미 검증

| 채널 | 비용 | 계약 | 단가 |
|---|---|---|---|
| 매입DB | 280만 | 8건 | **35만/계약** |
| 직접생산 | 120만 | 6건 | **20만/계약** |
| 현수막 | 80만 | 4건 | **20만/계약** |
| 콜·지·기·소 | 0 | 5건 | — (비용 없음) |

→ 직접생산·현수막이 가장 효율적, 매입DB는 비용↑.

## Acceptance Criteria

- [x] ChannelPerformance에 4채널 grid 추가 (도넛 2개 아래)
- [x] 색 dot + 채널명 + 단가(만원) + "비용 ÷ 건수" 보조
- [x] 콜·지·기·소 처리 ("—" + "비용 없음")
- [x] components.md §9-7 SSOT 갱신
- [x] check.sh PASS

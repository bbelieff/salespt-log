---
status: completed
slug: fix-dashboard-visual-parity
created: 2026-05-08
worktree: ../wt/dashboard-visual
completed: 2026-05-11
archived: 2026-07-12
---

# fix: 대시보드 prototype 시각 정합

## Intent

`feat/dashboard-page` 머지 후 brower 비교 결과 prototype과 시각 차이 발견.
사용자 피드백: "프로토타입이 더 좋아". 이번 PR로 prototype HTML 1:1 매칭.

## 5가지 차이 정정

| # | 항목 | 변경 |
|---|---|---|
| 1 | **메인 배너 영업이익 분리** | 배너 안 inline → 외부 별도 큰 카드 (OperatingProfitCard) |
| 2 | **메인 배너 3-라벨 레이아웃** | "[start] 시작 / [N]% 진행 / 🎓 [grad] 종강총회" justify-between |
| 3 | **매출 박스 분해 라인** | 한 줄 truncate → "수임비 ₩ / 수수료 ₩" 2줄 |
| 4 | **Funnel 사다리꼴 connector** | 직사각형 막대만 → 막대+사다리꼴 깔때기 효과 |
| 5 | **OperatingProfitCard 강조형** | inline → text-4xl 별도 카드 + "8주 누적 · 계약 N건" 보조 |

## 추가 개선

- **me.data 없어도 메인 배너 보이게** — courseStartISO/graduationISO 더미 fallback (6기 4/10→6/6)
- 채널 색 prototype 정합 — 콜·지·기·소 `#a855f7` → `#8b5cf6` (prototype 정본)
- contractCount 자동 계산 — channelMatrix.계약 합 → OperatingProfitCard 보조

## Acceptance Criteria

- [x] DashboardProgressBanner 재작성 (영업이익 제거, 3-라벨, 매출 분해)
- [x] OperatingProfitCard 강조형으로 (text-4xl, "8주 누적 · 계약 N건")
- [x] FunnelChart 사다리꼴 connector + 계약 행 강조 폰트
- [x] page.tsx OperatingProfitCard 별도 호출
- [x] me 없어도 dummy fallback으로 배너 렌더
- [x] check.sh 전체 PASS

## 검증

```
▶ typecheck         : PASS
▶ lint              : 0 errors
▶ structural        : 6 passed
▶ unit              : 22 passed
▶ doc-drift         : PASS
▶ check.sh          : PASSED
```

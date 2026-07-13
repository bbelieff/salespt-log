---
status: completed
slug: fix-dashboard-prototype-exact
created: 2026-05-08
worktree: ../wt/dashboard-v2
completed: 2026-05-11
archived: 2026-07-12
---

# fix: 대시보드 prototype 정확 매칭 (4가지 사용자 피드백)

## Intent

이전 visual-parity PR 머지 후에도 prototype과 차이 발견. 사용자 피드백 4가지 반영.

## 변경

### (1) FunnelChart 사다리꼴 좌표 수정
- **이전**: 사다리꼴 가운데 정렬 (centered)
- **변경**: prototype 정본대로 **left-aligned** — 좌측 고정, 우측만 좁아짐

### (2a) ProductivityIndicators 재작성
- **이전**: 4-cell grid (각 셀에 큰 % 표시)
- **변경**: prototype 정본대로 **linear progress bar 4개 수직 stacked**
  - DB퀄리티 (indigo-300) / 컨택숙련도 (indigo-500) / 미팅숙련도 (indigo-700)
  - 영업생산성 = 별도 강조 (bg-gradient indigo-50→purple-50, "종합" 배지, indigo-500→purple-600 진행바)

### (2b) WeeklyDualChart 재작성
- **이전**: 단순 bar + line, viewBox 0 0 358 200
- **변경**: prototype 정본 좌표 1:1 — 좌Y축(활동량 0~100) / 우Y축(영업이익 -50~250 만원)
  - X 30~328 (298px), 막대 폭 24, 8주 위치 명시 (xAt 함수 + STEP=37.25)
  - 가로 그리드(50, 100), 0선 점선, 좌우 Y축 라벨, 마지막 8주 강조 (text-blue-700 bold)

### (3) 콜·지·기·소 수임비 박스 제거
- 사용자 결정: "수임비 빼버려"

### (4) 채널별 성과 (좌우 대칭 도넛 2개)
- **신규 컴포넌트**: `ChannelPerformance.tsx` (기존 `ChannelCostDonut.tsx` 삭제)
- **좌**: 채널별 비용 도넛 (3채널: 매입DB/직접생산/현수막) — 가운데 −총비용, 라벨 도넛 밑
- **우**: 채널별 DB유입 도넛 (4채널 포함) — 가운데 총유입, 라벨 도넛 밑
- `grid-cols-2 gap-3` 좌우 대칭

## Acceptance Criteria

- [x] FunnelChart trapezoid left-aligned
- [x] ProductivityIndicators linear bars (4 stacked)
- [x] WeeklyDualChart prototype 좌표 정확 재현
- [x] ChannelCostDonut 삭제 + ChannelPerformance 신설
- [x] 페이지 + components.md SSOT 동기화
- [x] check.sh 전체 PASS

## 검증

```
▶ typecheck         : PASS
▶ lint              : 0 errors
▶ structural        : 6 passed
▶ unit              : 22 passed
▶ doc-drift         : PASS (ChannelPerformance ✔)
▶ check.sh          : PASSED
```

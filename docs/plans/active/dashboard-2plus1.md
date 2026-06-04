---
slug: dashboard-2plus1
status: active
created: 2026-06-04
owner: belie
related: 12-dashboard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 데스크탑을 2+1(좌 영업이익+생산성 스택 / 우 퍼널 길게) + 하단 2열(8주추이|채널)로 재배치. 영업이익 카드 늘어남(빈 공간) 해소.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/dashboard/page.tsx`, `components/dashboard/OperatingProfitCard.tsx`
> - **관련 문서**: [[docs/design/components]]

# 대시보드 데스크탑 2+1 재배치

## Intent
데스크탑 `pc:grid-cols-2 items-stretch`에서 영업이익 카드가 퍼널 높이만큼 늘어나 숫자 아래가 텅 빔. 2+1 구조로 균형.

## 변경 (데스크탑 pc: 만)
- 상단: `pc:grid-cols-2 pc:items-start` — 좌 컬럼 `flex-col`[OperatingProfit(컴팩트) → ProductivityIndicators], 우 FunnelChart(내용 높이대로 길게). `items-start` 라 좌 카드가 퍼널 높이로 늘어나지 않음(빈 공간 해소).
- 하단: 별도 `pc:grid-cols-2` — WeeklyDualChart | ChannelPerformance.
- OperatingProfitCard 패딩 `p-5→p-4`, `mb-2→mb-1.5`(컴팩트, KPI 숫자 text-4xl 유지).
- 모바일(<pc): 1열 세로 — 영업이익→생산성→퍼널→8주추이→채널(자연 순서). 회귀 0.

## Acceptance Criteria
- [ ] 데스크탑: 좌[영업이익(낮음)+생산성] / 우[퍼널(높음)] 2+1, 그 아래 8주추이·채널 2열. 빈 공간 최소.
- [ ] 모바일 1열 회귀 없음. 토큰만 사용.
- [ ] `npm run check` 통과.

## 범위 밖
- 차트 내부·색·데이터 변경.

## Log
- 2026-06-04 2+1(items-start flex-col 스택) + 하단 2열 + 영업이익 컴팩트.

---
slug: weekheader-inline-funnel
status: active
created: 2026-05-17
worktree: ../wt/wh-inline
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택탭 WeekFunnelBar 제거 + 주차합계를 날짜 라벨 옆에 inline
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/_components/WeekHeader.tsx`
> - **읽고 나면 알 수 있는 것**: WeekFunnelBar 제거 후 통합 헤더 구조

# weekheader-inline-funnel

## 사용자 요청 (2026-05-17)
스크린샷: 컨택탭 헤더 — 파란 "4월 20일 (월)" 라벨 + 아래 separate WeekFunnelBar (생산 6 / 유입 26 / 컨택진행 16 / 미팅예약 12).

**변경**:
- 아래 funnel bar 제거
- 파란 날짜 라벨 옆에 `주차합계 : 생산 N · 유입 N · 컨택진행 N · 미팅예약 N` inline

## 변경 파일
- `app/(app)/contact/_components/WeekHeader.tsx` — `weekFunnel?` prop 추가, 날짜 라벨에 inline render
- `app/(app)/contact/page.tsx` — WeekFunnelBar import/usage 제거, WeekHeader 에 prop 전달
- `app/(app)/contact/_components/WeekFunnelBar.tsx` — **삭제**
- `docs/design/components.md` — WeekFunnelBar 항목 제거, WeekHeader 항목 갱신

## 색 유지
- 생산: gray-800
- 유입: amber-700
- 컨택진행: indigo-700
- 미팅예약: green-700

## Acceptance
- [ ] 컨택탭 헤더 컴팩트해짐 (한 줄 row 절약)
- [ ] 4채널 합계 숫자 동일 표시 (시트 데이터원천 변경 없음)
- [ ] check.sh 통과

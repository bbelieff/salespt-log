---
slug: week-slide-anim
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 모든 주차 day cell 동일 높이 + 주차 이동 시 슬라이드 인 애니메이션
> - **누가 읽나요**: 개발자

# week-slide-anim

## 사용자 보고 (2026-05-18)
1. "1주차의 날짜버튼만 크기가 변경된거같은데 나머지 주차들도 변경사항 적용해줘"
2. "옆으로 넘길때 한주의 날짜 세트(7개)가 동시에 옆으로 슬라이드되면서 전주 혹은 다음주날짜세트가 슬라이드되면서 들어오는 인터렉션"

## Fix

### [1] Cell 높이 일관성
- 옛: `isToday` 만 `pt-3.5` (TODAY strip 공간) → 다른 주차 cell 들은 작음
- 새: 모든 cell `pb-1.5 pt-3.5` (TODAY strip 영역 reserve, 빈 공간으로 둠) → 주차 간 동일 높이

### [2] 슬라이드 인 애니메이션
- `globals.css` keyframes `slide-in-from-right` / `slide-in-from-left` (220ms ease-out)
- WeekHeader 에 `slideDir?: "right" | "left" | null` prop
- 7-day grid 컨테이너에 `key={weekStart}` + 슬라이드 클래스 → 주차 변경 시 unmount/remount → 새 그리드가 옆에서 들어옴
- contact/schedule page: `moveWeek(delta)` 가 `setSlideDir(delta > 0 ? "right" : "left")` 후 260ms 후 reset
- 다음 주(우→좌 시각) = right, 이전 주(좌→우 시각) = left

## Acceptance
- [ ] 다른 주차 cell 높이 = 오늘 cell 높이
- [ ] [다음 주] 또는 좌 스와이프 → 새 그리드 오른쪽에서 들어옴
- [ ] [이전 주] 또는 우 스와이프 → 새 그리드 왼쪽에서 들어옴
- [ ] check.sh 통과

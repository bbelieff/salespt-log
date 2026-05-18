---
slug: schedule-day-scroll
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정·계약 날짜 클릭 시 세로 스크롤 방향 fix
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: schedule/page.tsx scrollToDay

# schedule-day-scroll — [A4]

## 사용자 요청 (2026-05-17)
"일정계약 에서 날짜 단추 눌렀을때 세로위클리 이동하는데 제대로 작동하지 않고 있음. 체크 후 금~일 클릭시 상단으로 이동, 화~목 클릭시 하단으로 이동시켜야 함"

## 변경
- `scrollToDay(idx)` — idx 별 block 선택:
  - idx 0~3 (금/토/일/월) → block: "start" (상단 정렬)
  - idx 4~6 (화/수/목) → block: "end" (하단 정렬)

## Acceptance
- [ ] 화~목 클릭 시 그 day section 이 화면 하단에 위치
- [ ] 금~일 클릭 시 화면 상단에 위치
- [ ] check.sh 통과

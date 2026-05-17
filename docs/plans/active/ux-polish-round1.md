---
slug: ux-polish-round1
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 6개 UX 이슈 일괄 fix
> - **누가 읽나요**: 개발자

# ux-polish-round1

## 사용자 보고 (2026-05-17)

### [1] 유보 invalid_input 버그
- `BulkReserveButton` body: `{action: "reserve"}` → API 는 `{reserved: boolean}` 기대
- Fix: `{reserved: true}` 로 변경

### [2] 컨택탭 스와이프 로딩 깜빡임
- 주차 이동마다 dayQuery refetch → `isLoading=true` → 전체 페이지 "불러오는 중…" 깜빡임
- Fix: `useDay` / `useWeekMeetings` 에 `placeholderData: (prev) => prev` 추가 — 이전 데이터 유지 후 swap

### [3] 생산 ±10 버튼 배치
- 옆에 4개 버튼 + label → 모바일에서 "생산" 한 글자 줄바뀜, 설명 숨김
- Fix: `flex-col` 레이아웃, ±1 stepper 위 / ±10 (작은 알약) 아래

### [4] 위클리 달력 오늘 디자인
- 기존: floating "오늘" 배지 + 미팅 count 배지 stack → 지저분
- Fix: 두꺼운 border (border-2 border-t-[6px] border-blue-600) + 상단 "TODAY" 텍스트
- 컨택 / 일정계약 양 탭 모두 적용

### [5] 일정계약 SummaryBar 정돈
- 단일 row + wrap → 매출 wrap 시 정신없음
- Fix: 명시적 2 row 레이아웃 — 카운터 grid-cols-5 (균등), 매출은 우측 정렬 (revenueSum>0 일 때만)

### [6] 일정계약 스크롤 월~목 하단
- PR #215: 월(idx 3) start → 사용자 정정 (월요일도 하단 가야 함)
- Fix: threshold 변경 idx>=4 → idx>=3

## Acceptance
- [ ] 유보 모달 처리 성공
- [ ] 컨택탭 스와이프 시 콘텐츠 유지
- [ ] 생산 카드 줄바뀜 없음
- [ ] 오늘 표시 깔끔
- [ ] SummaryBar 2-row 깔끔
- [ ] 월요일 클릭 시 하단 정렬
- [ ] check.sh 통과

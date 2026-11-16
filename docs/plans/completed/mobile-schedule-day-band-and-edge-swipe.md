# 폰 일정·계약 — 날짜 띠 색·「＋ 일정」 자리·삭제한 미팅 자리·화면 끝 밀기

- 목적: belie 2026-11-16 모바일 일정·계약 5건. 관련: [components](../../design/components.md) DaySection·WeekBoard 줄, 메뉴 서랍 「끝 밀기」.

## 수용 조건
1. 「삭제한 미팅」 버튼이 첫 줄을 차지하지 않는다(목록 맨 아래로).
2. 날짜 제목 줄이 요일별 바탕색 띠(오늘 파랑 · 토 하늘 · 일 빨강 · 평일 회색).
3. 「＋ 일정」은 날짜 띠 오른쪽, 건수 옆. 메모 줄은 그대로.
4. 화면 오른쪽 끝을 밀어도 브라우저 「앞으로 가기」(월 보기)로 넘어가지 않는다.
5. 화면 왼쪽 끝을 밀어도 「뒤로 가기」가 되지 않는다 — 버튼(일정 줄) 위에서 시작해도.

## 변경
- `DaySection`(띠 색·`action`), `MobileDayExtra`(`DayAddButton`), `useMobileExtras`(`dayAction`), `schedule/page.tsx`(삭제한 미팅 자리).
- `components/desktop/mobile-nav.ts`·`DesktopNav.tsx`: 양쪽 끝 24px 터치의 기본 동작을 막고, 제자리 누르기는 대신 눌러 준다.

## 검증
- `tests/components/mobile-nav-swipe.test.ts`(오른쪽 끝·버튼 위·입력 칸), 합성 값 390px 화면 확인, `bash scripts/check.sh`.
- 실제 폰(iOS Safari·설치 앱)의 끝 밀기는 기기에서만 확인 가능 — NOT_RUN, 배포 뒤 belie 확인.

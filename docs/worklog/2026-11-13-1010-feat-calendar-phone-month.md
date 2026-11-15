## 2026-11-13 · 캘린더 폰·태블릿 월 보기 (꽉 찬 달력 · 그 날 창 · 「주 | 월」)
- 브랜치 `feat/calendar-phone-month`(origin/master e9efaeec 기준). 요청: belie 「바텀탭 아니고 사이드탭 · 구글캘린더처럼 일당 서너개는 일정이 보여야」 → 시안 v2 → 「추천대로 구현」.
- 담당 파일: `app/(app)/calendar/**`, `schedule/_components/board/{BoardPopover,TodoPopover,EventPopover,ViewSwitch,board-style}`, `schedule/_lib/useBoardView.ts`, `schedule/page.tsx`, `tests/components/desktop-fluid.test.ts`.
- 변경: 1280px 미만 캘린더 = `phone/PhoneMonth`(칸마다 일정 이름 3~5줄, 그 날 창, 요약·설정 창, 「+」). 데이터·저장을 `board/useMonthData` 로 떼어 PC 보드와 같이 씀. 페이지 띠에 달 이동·「주 | 월」(`ViewSwitch`), 일정·계약 폰 화면에도 「주 | 월」. 「+ 일정」은 PC·폰 모두 GeneralEventModal. 옛 캘린더 부품 4개 삭제.
- 검증: tsc · eslint · 관련 시험(desktop-fluid·구조·계약 fan-out·GeneralEventModal 가드) 통과. 합성 화면(실제 부품 + 가짜 응답) 390×844(칸당 최대 5줄, 그 날 창 7건, 미팅 창 「뒤로」, 결과 4칸 44px, 요약·설정·월~일 6줄·일정 추가) · 900×760(넓은 달력 + 창) · 1100×800(보드 팝오버·일정 추가).
- 미확인: 실제 폰 기기·사파리 주소창 높이 변화, 로그인한 운영 화면, 어두운 화면.
- DB 변경 없음. 되돌리기 = 이 PR revert.
- [plan](../plans/completed/calendar-phone-month.md)
- 2026-11-15 belie 「왼쪽 테두리 없는게 나을듯」: 폰 달력 일정 줄의 채널 색 왼쪽 띠 제거(`CH_EDGE` 삭제), 시안 v3. 채널은 그 날 창의 점으로 본다.
- 병합·배포(2026-11-15): PR #1435 — master 두 번 합침(#1433, #1434·#1436) 뒤 현재 head b56847b7 에서 CI(build·check) 통과 → squash ddfd1cf8 → Deploy to VPS run 43661745022 success, `/api/health` 200, `/calendar` 307(로그인으로). 실제 폰 기기·로그인한 운영 화면·어두운 화면은 NOT_RUN — belie 확인 요청.

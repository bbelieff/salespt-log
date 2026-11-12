## 2026-11-12 · 캘린더 탭 PC 한 달 보드 (하늘, 「주 | 월」)
- 브랜치 `feat/calendar-month-board`(origin/master 540eeb6b 기준). 요청: belie 「캘린더도 이 디자인컨셉으로 고도화」 → 기획안·시안 → 「화면 합치고 입구는 남기기 + 하늘」 「pc는 먼저 진행하고 폰화면기획 따로」.
- 담당 파일: `app/(app)/calendar/**`, `app/(app)/schedule/_lib/useMeetingPatch.ts`(새 파일), `schedule/_components/board/{BoardTitle,SidePanels,EventPopover,TodoPopover,WeekBoard,MeetingPopHead}.tsx`, `schedule/page.tsx`, `app/api/schedule-notes/route.ts`, `lib/query/schedule-notes-hooks.ts`.
- 변경: PC(1280px+) 캘린더 = 한 달 보드(`calendar/_components/board/`). 주간 보드 부품·저장 함수 재사용, 테마색 하늘(`.wb-sky`). 「주 | 월」로 `/calendar?date=` ↔ `/schedule?date=`. 메모 읽기 `days` 추가. 미팅 저장 함수는 page.tsx → `useMeetingPatch` 로 본문 그대로 옮김(계약 장부 연결 규칙 불변).
- 검증: tsc · eslint(바뀐 폴더) · 관련 시험(라우트 days 6건·계약 fan-out 소스 가드·구조 시험) 통과. 합성 화면(실제 부품 + 가짜 응답) 1440×900·1280×720 — 미팅 창 완료 저장, 투두 창, 일반 일정 만들기(시각)·보기·지우기, 메모 저장·칸 표시, 월~일 6줄, 달 이동, 「주」 이동, 주간 보드 제목 칸 「주 | 월」 넘침 없음. 긴 업체명·하루 7건(「+N」)·빈 날 확인.
- 미확인: 로그인한 운영 화면, 구글 캘린더 실제 연결 상태, 어두운 화면. 폰 화면은 범위 밖(따로 기획).
- DB 변경 없음. 되돌리기 = 이 PR revert(1280px 미만 화면·데이터는 건드리지 않음).
- [plan](../plans/completed/calendar-month-board.md)

## 2026-11-12 · 주간 보드 미팅 창·트레이닝 목표 판을 시안 구성으로
- 브랜치 `feat/schedule-board-meeting-popup`(origin/master bc3318cd 기준). 요청: belie 「라이브버전은 지금 목업대로 안되고 있는데 … 구버전의 컴포넌트를 쓰고 있는데?」·「트레이닝목표도 좀 다르게 나오고 있고」.
- 앞 작업 기록: #1418(왼쪽 판 너비) 병합 03af75b3 · 배포 run 43028255598 성공, #1424(업체정보·길찾기) 병합 af99cf5b · 배포 run 43149296306 성공, 둘 다 `/api/health` 200.
- 변경: 새 `board/BoardMeetingPop.tsx`(시안 창 본문), 새 `board/BoardGoals.tsx`(목표 판), `BoardPopover` `glass`, `WeekBoard` 창 머리(업체명·시각·채널), `SidePanels` Panel `closedSummary`·GoalPanel 이동, `week-board.css` `.wb-pop`·`.wb-acts`·`.wb-form`·`.wb-dsum`·`.wb-qn`·`.wb-ptask`, page.tsx 보드 렌더, MeetingResultCard 는 #1424 이전으로(`boardTools` 제거), 시안 파일 v44 로 갱신.
- 검증: tsc, 합성 화면(1440 배치) — 창 머리·4칸·변경/완료 입력칸·완료 저장 뒤 요약 상자, 목표 판 막대·과제 목록. 로그인 운영 화면·폰 시트 NOT_RUN.
- 미완료: 시안의 「다음 연락일」·「가망도」(저장 칸 없음). [plan](../plans/completed/schedule-board-meeting-popup.md)

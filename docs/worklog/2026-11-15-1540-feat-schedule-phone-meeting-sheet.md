## 2026-11-15 · 일정·계약 폰 주 보기 미팅 카드 → 같은 창(아래 시트)
- 브랜치 `feat/schedule-phone-meeting-sheet`(origin/master 5fab5fa1 기준). 요청: belie 「폰 주 보기 미팅 카드도 같은 창으로 통일해」(#1435 의 2단계).
- 담당 파일: `app/(app)/schedule/page.tsx`, `schedule/_components/{DaySection,board/BoardMeetingPop,board/BoardPopover,board/week-board.css}`, `schedule/_lib/state-map.ts`, `components/onboarding/{Spotlight,FirstStepTourOffer}.tsx`, 삭제 `schedule/_components/{MeetingResultCard,DoneForm,CancelForm,RescheduleForm}.tsx`, 시험 4곳.
- 변경: 미팅 줄(`DaySection` 의 `MeetingRow`)을 누르면 page.tsx 가 `BoardPopover`(아래 시트) + `MeetingPopHead` + `BoardMeetingPop` 을 띄운다 — PC 보드·캘린더와 같은 본문·같은 저장 함수. 옛 카드에만 있던 사유 빠른 선택 칩을 창으로 옮김(`.wb-presets`, 아래 시트에서만 보임). `?focus=` = 창을 한 번 열기, `?edit=schedule` = 「변경」 미리 고름(`initialAct`). 첫 안내: 결과 4칸에 표식, 말풍선은 시트 안 아래쪽 대상을 가리지 않게 위로, 말풍선을 눌러도 창이 닫히지 않게.
- 시험 대상 교체(약화 아님): `disclosure-migration`(옛 카드 한 자리 빠짐 46→45·44→43) · `ui-touch-date`(날짜 칸·hit-44 가드를 BoardMeetingPop 으로) · `company-info-basic-view` · `ui-audit-batch-1`(문구 가드 대상).
- 검증: tsc 통과. 합성 화면(실제 page.tsx + 가짜 응답) 390×844 — 줄 → 창, 완료 칩 → 「업체명, 예산 부족」 → 저장 요청 1건 → 요약 상자, 변경 칩·날짜 칸, `?focus&edit=schedule` → 「변경」 골라진 창(다시 열면 안 골라짐), 첫 안내 2단계(말풍선 위·4칸 밝힘·「나중에」 눌러도 창 유지), 바깥 눌러 닫기 · 900×760 계약 요약 창 · 1440×900 보드 창(칩 안 보임, 모양 그대로).
- 미확인: 실제 폰 기기, 로그인한 운영 화면, 어두운 화면, 지우기 확인 창을 거친 흐름.
- DB 변경 없음. 되돌리기 = 이 PR revert.
- [plan](../plans/completed/schedule-phone-meeting-sheet.md)

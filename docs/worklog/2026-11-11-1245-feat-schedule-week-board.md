## 2026-11-11 · 일정·계약 탭 주간 보드 (STEP 3 고도화)
- 브랜치 `claude/step3-meeting-booking-tab-b26456`(origin/master 844ec3d2 기준). 요청: belie 「스텝3 미팅예약 탭 고도화 … 주간 이슈·목표 왼쪽, 구글캘린더식 07~22시 격자, 일별 메모, 스텝4 투두 전부」 → 시안 v43 승인 「좋다 이대로 운영반영」.
- 변경: PC(1280px+) 주간 보드(`app/(app)/schedule/_components/board/`) — 제목 칸·미팅 결과/주간 이슈/트레이닝 목표 판·격자(메모·종일·시간), 미팅 창 = 기존 MeetingResultCard(`initialOpen`), 투두 창(완료·결과·다음), 일반/종일 일정 만들기. 1280px 미만은 기존 목록 + 이슈 판·날짜별 메모/투두/일정. 미팅 동작은 `_lib/useMeetingActions.ts` 로 옮김(page 500줄). 새 표 `schedule_notes`(0022) + `/api/schedule-notes` + 훅.
- 검증: 단위 6 + pglite 5 + 문구·글자 구조 검사 통과, tsc 통과, 합성 데이터 화면(실제 부품 + 가짜 응답) 1440×900·375 확인. 로컬 check.sh: typecheck·lint·structural·doc-drift 통과, unit 은 이 PC(Node 26) jsdom localStorage 미정의로 무관한 화면 시험 150건 실패(결제·DB시트·관리자 등, 이번 변경 밖) → CI 로 판정. 로컬 `npm run build` 는 손대지 않은 `app/api/db-sheet/route.ts` 생성 타입 오류로 실패(master 844ec3d2 는 같은 파일로 VPS 배포 성공) → 배포 빌드로 판정.
- 범위 밖: 기간 일정(투두 끝 날짜 칸 없음), 일반 일정 끝 시각, 폰 요일 순서·필터. 운영 0022 적용은 db-migrate(execute) 로 따로.
- [plan](../plans/completed/schedule-week-board.md)
- 병합·배포: PR #1411 CI(build·check) 통과 → squash 0bd6ecce → Deploy to VPS run 42976953179 success, `/api/health` 200, `/api/schedule-notes` 401(새 경로). db-migrate dry-run 42977671834 「대기 0022」 → execute 42977749701 「✅ 적용 완료: 0022_schedule_notes.sql」. 로그인 화면 확인은 세션 로그인이 없어 NOT_RUN — belie 확인 요청.

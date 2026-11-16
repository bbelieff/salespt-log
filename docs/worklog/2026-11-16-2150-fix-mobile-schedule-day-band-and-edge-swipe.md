# 2026-11-16 · fix: 폰 일정·계약 날짜 띠·「＋ 일정」 자리·화면 끝 밀기

- 목표: belie 모바일 일정·계약 5건(삭제한 미팅이 첫 줄 차지 / 요일 띠 색 / 「＋ 일정」을 건수 옆으로 / 오른쪽 끝 밀면 월로 넘어감 / 왼쪽 끝 밀면 아직 뒤로 감). 계획 [mobile-schedule-day-band-and-edge-swipe](../plans/completed/mobile-schedule-day-band-and-edge-swipe.md).
- 원인(끝 밀기): 왼쪽 끝 막기는 버튼·링크 위에서 시작한 터치를 빼고 있었는데, 일정 줄이 화면 끝까지 닿는 버튼이라 거의 늘 빠졌다. 오른쪽 끝은 막는 코드가 없었다(브라우저 「앞으로 가기」 = 방금 다녀온 월 보기).
- 변경: 날짜 띠 색, 「＋ 일정」 띠 오른쪽, 「삭제한 미팅」 목록 맨 아래, 양쪽 끝 24px 터치 막기 + 제자리 누르기 대신 눌러 주기. 담당 파일: `app/(app)/schedule/page.tsx`·`_components/DaySection.tsx`·`board/MobileDayExtra.tsx`·`board/useMobileExtras.tsx`, `components/desktop/mobile-nav.ts`·`DesktopNav.tsx`.
- 검증: mobile-nav-swipe 시험 7건, 합성 값 390px 화면 확인, `bash scripts/check.sh`. 실제 기기 끝 밀기 = NOT_RUN(기기 필요).
- 위험·복구: 화면 끝 24px 띠에서 시작하는 세로 스크롤이 되지 않는다(왼쪽은 기존과 같고 오른쪽이 새로 생김). 불편하면 `EDGE_ZONE` 을 줄이거나 오른쪽만 되돌린다. 데이터 영향 없음.

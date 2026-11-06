> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정 미팅 카드에 카카오맵·네이버지도·티맵 길찾기를 더한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 일정·계약 MeetingResultCard · 지도 앱 연결(map-links)
> - **관련 문서**: [계획](../plans/completed/mobile-call-assist.md)

# 2026-11-07 feat(schedule): 미팅 카드 🧭 길찾기

- 계기: belie 모바일 기획 2판 PR3 + 「카카오맵·네이버지도·티맵 세 개, 주소가 입력된 화면으로」.
- 담당 파일: lib/util/map-links.ts(순수) · app/(app)/schedule/_components/MapRouteButton.tsx · MeetingResultCard.tsx(한 줄 + 예약일 줄 압축, 500줄 상한 유지) · tests/util/map-links.test.ts · tests/components/map-route-button.test.ts.
- 검색어: 장소가 주소꼴이면 장소, 아니면 업체정보 소재지.
- 확인: vitest 8/8, tsc. **실기기 미확인** — 세 앱이 주소 검색 화면으로 열리는지(앱 주소 형식은 각 앱 공개 안내 기준), 앱 없을 때 웹/설치로 넘어가는지 아이폰·갤럭시에서 belie 확인 필요.
- 위험/복구: 화면만. 되돌리기 = revert.

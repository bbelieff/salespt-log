## 2026-10-31 · 실무/수납 헤더 깨짐 · 장기관리 맨 아래 묶음 · 진행건 접힘 · DB정보 날짜 버튼
- fix/work-collection-header-and-contact-shortcuts. belie: 「맞는 공고」·「공고필터 → 채우기」 누르면 헤더가 날아감, 장기관리 업체 목록을 진행 업체 맨 아래로(승인안), 실무진행 다 접기, DB정보 장기관리 1·3·6개월 / 다음 연락일 익일·1주일·1개월 / 최초상담일 당일·익일, DB정보 한 화면.
- 원인(헤더): PC 작업판 바깥 틀 `overflow:hidden` 은 스크립트 스크롤이 되는 상자 → scrollIntoView 가 판 전체를 위로 밀었다. `overflow:clip` + 상세 배너 sticky.
- 장기관리 다시 연락: 장기관리 업체의 다음 연락일이 마지막 연락에서 4주 이상 뒤면 오늘 챙길 일(`LONG_TERM_RECALL_MIN_DAYS`). 넘기기 전 남은 부재 다음날 같은 옛 날짜는 안 올린다.
- 범위 밖: 실무진행 4개 이상 — 수납1~3 고정 칸(매출·할 일·시트 백업) 구조 변경이라 별도 PR.
- 합성 화면 도구 추가: tests/browser/payment-live(실무/수납 실제 화면, 가상 업체 10곳).
- 로컬 메모: Node 26 은 jsdom 시험에서 localStorage 가 비어 `NODE_OPTIONS=--no-experimental-webstorage` 필요(CI Node 20 무관). 로컬 `npm run build` 는 db-sheet route 의 생성 타입 검사에서 멈춤 — 배포·CI 와 같이 `SKIP_BUILD_CHECKS=1`(기존 상태, 이번 변경 무관).
- 되돌리기 = squash revert(데이터 변경 없음).

## 2026-11-08 · 업무도구 「간편인증 서류 조회」 — 제공사 비교·흐름 결정·목업
- 브랜치 `feat/simple-auth-scraping` (기준 d8676402). [병렬트랙] 담당 파일: `docs/plans/active/simple-auth-scraping.md`, `tests/browser/simple-auth*`.
- 요청(belie): 업무도구에 간편인증 스크래핑. 제안서를 비교해 제공사 선택 → 메일 문의 대신 공개 자료(PDF·개발문서)만으로 비교하기로 정정.
- 결정(belie): 고객 링크 없이 수강생이 앱에서 대표 휴대폰으로 인증을 보내는 「직접 요청형」 하나로 통일(워크플로우 6개, 외부 서비스는 스크래핑 중계 1종). 채권자변동조회 보류(CODEF 공개 상품 없음). 주민번호 미수집(홈택스 회원 간편인증만).
- 제공사: 미정. CODEF 1순위(간편인증 11종·다건 세션·원문·홈택스 증명 전 항목), 틸코 2순위(완료여부 확인 API). 가격 비공개 → 데모 실측 필요.
- 변경: plan 작성, 합성 목업(`node tests/browser/simple-auth-server.mjs`) — 실제 CSS·PhoneInput·CompanyDocDiffTable 재사용, 제공사·서버 호출 없음.
- 미완료: 목업 승인, 제공사 확정·데모 시험, 구현 전체. [plan](../plans/active/simple-auth-scraping.md)

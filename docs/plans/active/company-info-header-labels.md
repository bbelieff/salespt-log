> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 머리줄의 아이콘 버튼 4개를 작은 한글 버튼(문서입력·TXT·팝업·더보기)으로 바꾼다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 실무/수납 업체정보 헤더 (`components/company-info/*`, `CompanyInfoEditor.tsx`, `payment-company-compact.css`)
> - **읽고 나면 알 수 있는 것**: 무엇을 바꿨나 / 어떻게 확인했나 / 되돌리는 법
> - **관련 문서**: [payment-header-chevron-release](payment-header-chevron-release.md)

# 업체정보 머리줄 한글 버튼 (2026-10-23)

## 요청
belie: "업체정보 아이콘 개선해줘. 한글로 써주고 이것보다 버튼이 작아야해" — 44px 정사각 아이콘 4개가 무슨 버튼인지 알기 어렵고 크다.

## 바꾼 것
- 아이콘 대신 짧은 한글: 문서입력 · TXT · 팝업 · 더보기. 주변 컨트롤(기본 너비·기본보기/확장보기·전체 칩, 높이 20~24px·글자 10~11px·모서리 5px)에 맞춰 PC 24px·11px·모서리 6px·연회색 테두리, 모바일 28px·11px. 메뉴는 버튼 바로 아래(32px).
- 더보기 메뉴 안에서는 기존 긴 이름(TXT 생성·팝업)과 아이콘을 그대로 쓰고 짧은 이름은 숨긴다(중복 표시 방지).
- 펼친 글자 모드(`data-mode="text"`)는 기존 그대로.

## 검증
- typecheck·lint·build 통과, check.sh(커밋 훅).
- 실화면 장치(tests/browser/dashboard-followups-server.mjs): 1280px 4버튼 한 줄, 375px 문서입력·더보기 + 메뉴 안 중복 없음.

## 되돌리기
squash 커밋 revert 1회. 데이터 변경 없음.

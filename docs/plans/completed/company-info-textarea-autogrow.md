# 업체정보 여러 줄 칸 자동 높이

- 목적: belie 2026-11-17 「기대출 개인·사업자 대출·기타메모 등 내용이 늘어나면 자동으로 필드가 늘어나게 — 업체정보가 있는 모든 탭에서」. 관련: [components](../../design/components.md) CompanyInfoField.

## 수용 조건
- 여러 줄 칸은 줄바꿈 수뿐 아니라 긴 줄이 접혀 늘어난 만큼도 높이가 늘고, 지우면 줄어든다. 안쪽 스크롤 없음.
- 업체정보 편집기를 쓰는 모든 화면(일정·계약 미팅 창, DB관리, 일별 기록, 실무/수납, 팝업)에 같이 적용 — 한 칸 부품(`CompanyInfoField`) 한 곳만 고친다.

## 변경
- `components/company-info/CompanyInfoField.tsx`: `useAutoGrow`(값·칸 너비가 바뀔 때 내용 높이로 맞춤).

## 검증
- `tests/components/company-info-autogrow.test.ts`, 실제 브라우저에서 긴 글 입력(50px → 90px, 스크롤 없음), `bash scripts/check.sh`.

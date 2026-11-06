> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 표준산업분류 줄을 공고필터로 옮기고 버튼을 「바꾸기」 하나로 줄인 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 업체정보 · 공고필터 펼침(GrantFilterPanel) · KsicLine
> - **관련 문서**: [계획](../plans/completed/company-ksic-in-grant-filter.md)

# 2026-11-06 fix(company-info): 산업분류를 공고필터로, 버튼은 「바꾸기」 하나

- belie 「자동 산업분류코드에 고르기 후보 등등 너무 복잡 — 공고필터쪽 활용」 → 제안 승인 「제안대로 진행」.
- 담당 파일: components/company-info/KsicLine.tsx · GrantFilterPanel.tsx · CompanyInfoItem.tsx · company-info-defs.ts(row.grant 제거) · tests/components/grant-filter-panel.test.ts · docs/design/components.md.
- 버튼 6종(복사·고르기·자동으로·후보/접기 + 줄마다 복사·고르기) → 「바꾸기」 1개. 코드 칩 누르면 복사. 저장 데이터 변화 없음.
- 위험/복구: UI 만 바뀜. 되돌리기 = 이 커밋 revert.

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 공고필터 버튼 위치·높이 정렬, 배너·선택 칸 그라데이션 되돌림, 상세 칸 스크롤 화살표 제거 계획.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/CompanyInfoEditor.tsx` 보기 줄, `GrantFilterPanel.tsx`, `app/globals.css` 실무/수납 상세
> - **읽고 나면 알 수 있는 것**: 무엇을 왜 바꿨는지 · 검증 · 되돌리기
> - **관련 문서**: [바닥 틴트](../completed/payment-detail-floor-tint.md)

# 공고필터 정렬 + 배너/선택 칸 그라데이션 복원 + 스크롤 화살표 제거 (2026-11-05 belie)

- [x] 공고필터 버튼을 기본/확장보기 토글 바로 옆으로(이전엔 justify-between 으로 가운데 떠 있었다). 높이 26px 로 토글과 같게.
- [x] 업체명 배너·목록 선택 칸·연결부 채움을 원래 밝은 그라데이션(모드색 → 흰색)으로 — 바닥 틴트는 본문에만 남김.
- [x] 크롬에서 scrollbar-width 가 ::-webkit-scrollbar 규칙을 무시시켜 위아래 화살표가 생기던 것 — 표준 속성은 webkit 막대 없는 브라우저에만.
- 검증: fixture 1440px 캡처, 버튼 높이 실측(26/26/26), 스크롤 막대 계산값 scrollbar-width auto. 되돌리기: squash revert.

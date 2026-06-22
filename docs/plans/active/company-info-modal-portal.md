---
slug: company-info-modal-portal
status: active
created: 2026-06-22
owner: belie
related: components
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 편집 모달이 실무수납 상세패널(overflow-hidden 부모)에 클리핑되던 것을 createPortal(document.body)로 해결.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: components/CompanyInfoEditor.tsx

# fix — 업체정보 모달 portal

## 원인
`CompanyInfoEditor` 의 `{modal && (fixed inset-0 z-[300] …)}` 가 실무수납에선 overflow-hidden + sticky 부모(payment page / ContractRow) 안에 있어 fixed 모달이 그 부모에 클리핑(화면 전체 못 덮음, 배경 dim 미적용). 컨택탭엔 해당 부모 없어 정상.

## 변경
- `components/CompanyInfoEditor.tsx`: 모달 블록을 `createPortal(<div fixed…>…</div>, document.body)` 로 감쌈(서버 가드 `typeof document !== "undefined"`). 모달 JSX·z-index 동일, 위치만 body.

## 수용 기준
- 실무수납 → 계약 → 업체정보 "팝업 편집" → 모달 화면 정중앙, 배경 전체 dim, 뒤 내용 안 비침(belie 시각 확인·스샷).
- 컨택·일정계약 회귀 없음. typecheck/lint/structural 통과 + build + 배포 + health 200.

## Log
- 2026-06-22 구현(fix/company-info-modal-portal): 모달 createPortal(document.body).

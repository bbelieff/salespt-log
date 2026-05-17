---
slug: db-contact-cascade
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB ↔ 컨택 cross-tab cascade (구매 시 컨택 생산 안내 / 저장 시 DB 검증)
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: db/page.tsx, contact/page.tsx, CrossTabHintModal

# db-contact-cascade — [DB-1] [DB-2] [C-2]

## 사용자 요청 (2026-05-17)
- DB에 구매목록 추가 시 → 컨택탭 생산 입력 안내 + 바로가기/화면유지
- 현수막은 제외 (게시한날=생산)
- 컨택탭 저장 시 → DB ↔ 생산량 검증 → 불일치 시 DB로 바로가기/화면유지

## 변경
- `components/ui/CrossTabHintModal.tsx` 신규 — "X 했나요?" + [화면유지/바로가기] 통일 패턴
- `app/(app)/db/page.tsx`:
  - `productionHint` state — handleAdd 성공 시 (banner 제외) 모달 trigger
  - 모달 [📞 컨택관리로 이동] → router.push("/contact")
- `app/(app)/contact/page.tsx`:
  - `dbOverview` hook + `dbMismatch` state
  - handleSave 후 매입DB / 직접생산 / 콜·지·기·소 별 검증:
    - 매입DB: sum(purchase.주문개수 where 구매일 = date) vs production
    - 직접생산: sum(production.생산개수 where 날짜 = date) vs production
    - 콜·지·기·소: count(lead where 접수일 = date) vs production
    - 현수막은 검증 안 함 ([DB-2] 게시한날=생산)
  - 불일치 시 모달 → [🗂 DB관리로 이동]

## Trade-off (MVP)
- 바로가기는 단순 router.push (date/channel param 안 넘김) — UI 가 자동 focus 까지는 추후 확장
- 검증은 row 합산 / count 비교 — 더 정밀한 규칙 (예: 직접생산 = 1 row 당 1 생산)은 도메인 규칙 명확화 후 조정

## Acceptance
- [ ] DB 매입DB 추가 → 모달 노출 → "컨택관리로 이동" 동작
- [ ] DB 현수막 추가 → 모달 안 나옴
- [ ] 컨택 저장 → DB 합 불일치 시 모달 노출
- [ ] check.sh 통과

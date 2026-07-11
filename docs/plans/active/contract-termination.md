---
slug: contract-termination
status: active
created: 2026-07-12
owner: belie
related: contract-delete-ghost, 11-contract-payment-tab, arena-start-revenue-split
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 계약해지 기능 — 실무/수납 각 계약에 [계약해지](사유 필수·반환 없음/일부/전액·보존 또는 숨김), 매출 = 수임비+수납 − 반환액(soft delete 여도 차감 유지).
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 02 계약수납 AL~AO, lib/repo/contract-payment(-termination), lib/service/contract-payment·dashboard(매출), payment 화면
> - **읽고 나면 알 수 있는 것**: 해지가 어디에 저장되나 / 매출·건수에 어떻게 반영되나 / 왜 soft delete 인가
> - **관련 문서**: docs/plans/active/contract-delete-ghost.md(선행 fix), docs/domains/sheet-structure.md §4, docs/domains/data-model.md

# feat/contract-termination — 계약해지

## 1. 스펙 (2026-07-10 belie 확정 — 워크로그 '이용호 신고' 항목)

- 실무/수납 각 계약에 **[계약해지]** — ①사유 필수 ②반환: 없음/일부(금액 입력)/전액 ③처리: 해지 상태 보존 또는 목록에서 숨김.
- **매출 = 수임비 + 수납 − 반환액** — 숨겨도(soft delete) 반환분만 차감, 수임비·수납은 유지.
  → 삭제가 아니라 **soft delete**(숨김·데이터 보존)여야 이 규칙이 성립.
- 해지 계약의 건수: 기본 **제외** + "해지 N건" 별도 표시. 단일 상수
  `TERMINATED_IN_CONTRACT_COUNT`(lib/types/contract-status.ts)로 전환 용이(belie 미확정 항목).

## 2. 구현

- **저장(02 AL~AO)**: AL=해지일(ISO, 존재=해지) · AM=사유 · AN=반환액 · AO=숨김("Y"|빈값).
  쓰기 = `writeTermination`(lib/repo/contract-payment-termination.ts, 그리드 41열 보장 + DB 미러).
  읽기 = rowToCP(A6:AO)·contractFromDbPayload(필드명/열문자 겸용). clearRow 는 AL~AO 도 함께 비움.
- **판정**: `isTerminatedContract`(해지일 존재) — 단일 결정점, 클라·서버 공용.
- **매출**: `computeContractRevenue`·`splitContractRevenue`(dashboard.ts)에 `totalRefunded` 추가,
  revenue = fee+received−refunded. 이월 계약은 기존 규칙 그대로(반환액도 이월 버킷으로).
  payment 화면 totalRevenue 도 동일 정의(숨김 계약의 반환액 포함 차감).
- **API**: POST `/api/contract-payment/[row]/terminate` (사유·반환액·숨김, 쓰기 가드 getWritableUserEmail).
- **UI**: ContractRow [계약해지] 버튼(해지 후 숨김) + "해지" 뱃지·흐림·사유/반환 표시,
  TerminationModal(사유/반환 라디오/처리 라디오), 요약 카드 건수·"해지 N건"·총매출 반영.
- **역방향 그림자(대시보드) 영향 없음**: reverseShadowCompare 는 누적수임비·매트릭스만 대조
  (revenue 비대조) — 반환 차감이 경보를 만들지 않음.

## 3. 수용 기준

- [ ] 해지(보존): 카드에 해지 뱃지·사유·반환 표시, 건수 제외+"해지 N건", 매출 반환 차감.
- [ ] 해지(숨김): 카드 사라짐, 반환 차감·데이터(시트 AL~AO)는 유지.
- [ ] 사유 없이 확인 불가(클라+서버 이중 검증). 반환액 음수 거부.
- [ ] 시트↔DB payload 정합(필드명·열문자) 테스트 초록. check.sh + next build + 배포 success + health 200.

## 4. 남긴 것

- 해지 취소(복구) UI 는 미구현 — 시트에서 AL~AO 를 지우면 복구(운영 절차). 요청 시 후속.
- 게이미피케이션 XP 회수 없음(스펙 밖, YAGNI).

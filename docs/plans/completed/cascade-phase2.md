---
status: completed
slug: cascade-phase2
created: 2026-05-19
completed: 2026-05-25
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: cascade Phase 2 — 미팅 결과 계약→非계약 전환 시 계약카드 자동 삭제
> - **누가 읽나요**: 개발자
> - **관련 문서**: docs/plans/active/cascade-edge-cases.md (#240)

# cascade-phase2

## Scope
cascade-edge-cases Q4 정책: 미팅 상태가 "계약" → "취소/완료/변경/예약" 으로
바뀌면 매칭 02 계약수납관리 계약카드 자동 cascade clear.

## 변경
- `lib/service/contact.ts` patchMeeting: partial.상태 가 비-계약이고 현재 상태가
  계약이면 clearContractPaymentByLink 로 02 row clear 후 updateMeeting.
- `lib/query/contact-hooks.ts` usePatchMeeting: ["payments"] invalidate 추가.
- `MeetingResultCard.tsx`: 계약 상태에서 완료/취소 전환 시 confirm
  ("수납탭 계약카드 1건 삭제됩니다 ₩금액. 진행?").

## Acceptance
- [ ] 계약 카드 → 완료/취소 전환 시 수납탭 계약카드 사라짐
- [ ] 전환 confirm 노출 (수임비 금액 포함)
- [ ] 비-계약 상태 patch 는 02 건드리지 않음
- [ ] check.sh 통과

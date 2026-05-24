---
slug: cascade-phase3
status: active
created: 2026-05-19
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: cascade Phase 3 — 계약 미팅 업체명/날짜 수정 시 계약카드 link sync
> - **누가 읽나요**: 개발자
> - **관련 문서**: docs/plans/active/cascade-edge-cases.md (#240)

# cascade-phase3

## Scope
cascade-edge-cases Q5 정책: 계약카드까지 있는 미팅의 업체명/미팅날짜를 일정탭에서
수정하면 02 계약수납관리 row 의 link key (C 계약일 / D 업체명) 도 자동 sync.
미수정 시 02 row 가 옛 link 로 남아 orphan (수식 매칭 실패).

## 변경
- `lib/repo/contract-payment.ts` updateLinkFields: old (계약일, 업체명) 매칭 row
  찾아 C/D 새 값으로 update.
- `lib/service/contact.ts` patchMeeting: 계약 유지 + 업체명/미팅날짜 변경 시
  updateContractLink 호출 (Phase 2 의 drop 과 분기).

## Acceptance
- [ ] 계약 미팅 업체명 수정 → 02 row 업체명 동기화
- [ ] 계약 미팅 날짜 수정 → 02 row 계약일 동기화
- [ ] 비-계약 미팅 수정은 02 안 건드림
- [ ] 계약→非계약 전환은 Phase 2 (clear) 유지
- [ ] check.sh 통과

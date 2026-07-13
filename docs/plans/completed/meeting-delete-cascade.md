---
status: completed
slug: meeting-delete-cascade
created: 2026-05-18
completed: 2026-05-18
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: cascade-edge-cases Phase 1 — 미팅 삭제 시 매칭 계약카드 자동 삭제 + 친절한 confirm
> - **누가 읽나요**: 개발자
> - **관련 문서**: docs/plans/active/cascade-edge-cases.md (PR #240)

# meeting-delete-cascade

## Scope
Phase 1 of cascade redesign — 미팅카드 삭제 시:
- 매칭 계약카드 (02 row) 도 자동 cascade clear
- 컨택 미팅예약 -1 (기존 PR #230 유지)
- 친절한 confirm: "함께 사라지는 것" 명시

## 변경
- `lib/service/contact.ts`: `removeMeetingWithCascade` 신규
  - 미팅 fetch → 상태=계약 이면 (미팅날짜, 업체명) 매칭 02 row clear → 미팅 clear
- `lib/service/index.ts`: export 추가
- `app/api/meeting/[id]/route.ts`: DELETE 핸들러가 cascade service 호출, 결과 반환
- `app/(app)/contact/page.tsx`: confirm 메시지 강화 (계약카드 있으면 명시), toast 차별화

## Acceptance
- [ ] 미팅 상태=계약 인 카드 삭제 → 수납탭 매칭 row 사라짐
- [ ] 미팅 상태=예약 카드 삭제 → 수납탭 변동 없음
- [ ] confirm 에 함께 사라지는 카드 list 노출
- [ ] check.sh 통과

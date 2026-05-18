---
slug: cascade-tree
status: active
created: 2026-05-19
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅 변경 체인 transitive cascade + RescheduleForm TimePicker15 적용
> - **누가 읽나요**: 개발자

# cascade-tree

## 사용자 보고 (2026-05-19)
1. RescheduleForm 시간 입력이 OS native picker (오후/오전 + 휠) — TimePicker15 일관화
2. 변경 시 분 선택 15분 4개 segmented 필요
3. **미팅1 → 변경 → 미팅2 → 변경 → 미팅3 체인에서 미팅1 삭제/되돌리기 시 미팅2, 3 모두 사라져야 함** — 현재는 직속 자식 1대만 cascade
4. 최초 일정 삭제 후 마지막 변경된 일정이 살아있어 "뿌리 없는 orphan" 사고

## Root Cause
- `removeMeetingWithCascade` (PR #241) — 02 row 만 직속 cascade. 자식 미팅 cascade 없음.
- `revertMeeting` (PR #209) — 변경 자식 1대만 삭제. 손자 미팅 안 건드림.
- `reviveCaseClosure` (PR #242) — 자식 1대만. 손자 잔존.
- `RescheduleForm.tsx` — `<input type="time">` 그대로.

## Fix
- `removeMeetingWithCascade`: 재귀 `cascadeDescendants(parentId)` — post-order (손자 먼저)
- `revertMeeting` 변경 분기: 동일 재귀
- `reviveCaseClosure`: 자식 + 손자 transitive
- `RescheduleForm`: TimePicker15 사용, 날짜 130px / 시간 flex-1

## Acceptance
- [ ] 1→2→3 체인에서 1 삭제 → 2,3 함께 사라짐
- [ ] 1→2→3 체인에서 1 되돌리기 → 1 예약 + 2,3 삭제
- [ ] 1→2→3 체인에서 2 삭제 → 3 삭제, 1 유지
- [ ] 3 삭제 → 3만 사라짐, 1,2 유지
- [ ] 변경 시 시간 segmented 4 버튼 표시
- [ ] check.sh 통과

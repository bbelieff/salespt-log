---
status: completed
slug: cascade-phase4
created: 2026-05-19
completed: 2026-05-25
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: cascade Phase 4 — 컨택탭 미팅예약 -1 시 삭제할 미팅 선택 팝업
> - **누가 읽나요**: 개발자
> - **관련 문서**: docs/plans/active/cascade-edge-cases.md (#240)

# cascade-phase4

## Scope
cascade-edge-cases Q2 정책 (B: 선택 팝업). 컨택탭 미팅예약 stepper "-" 클릭 시
저장된 미팅이 2건 이상이면 "어느 미팅 지울지" 모달 표시 → 선택 시 cascade 삭제.
(기존: 마지막 미팅 자동 삭제 → 사용자가 의도 못 한 카드 삭제 위험)

## 변경
- `MeetingPickerModal.tsx` 신규 — 채널 미팅 list, onPick/onClose
- `contact/page.tsx` step(-1) 분기:
  - 미저장 슬롯 있으면 마지막 제거 (기존)
  - 저장 미팅 ≥2 → 선택 모달
  - 저장 미팅 =1 → 바로 삭제 (모호성 없음)
  - 0 → 기존 toast
- 모달 onPick → handleRemoveSavedMeeting (cascade)

Phase 5 (수납탭 계약 직접 추가 차단)은 이미 충족 — 수납탭에 계약 추가 UI 없음
(계약은 일정탭 결과=계약 fan-out 으로만 생성). 코드 변경 불필요.

## Acceptance
- [ ] 한 채널 미팅 2건+ 에서 -1 → 선택 모달
- [ ] 1건이면 모달 없이 바로 삭제
- [ ] 선택 시 cascade (계약카드 포함) + 미팅예약 -1
- [ ] check.sh 통과

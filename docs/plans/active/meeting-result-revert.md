---
slug: meeting-result-revert
status: active
created: 2026-05-17
worktree: ../wt/mtg-revert
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅 결과 되돌리기 + 상태별 cascade (계약→수납 row 삭제, 변경→자식 미팅 삭제)
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: schedule 탭 MeetingResultCard, contract-payment cascade

# meeting-result-revert — [2a]

## 사용자 요청 (2026-05-17)
"미팅결과 되돌리기 + cascade — 계약 초기화→수납삭제, 변경 초기화→변경미팅삭제"

## 변경 (Layer 별)

### Repo
- `meetings.ts` — `findByPreviousMeetingId(originalId)` 추가: 변경 자식 미팅 식별
- `contract-payment.ts` — `clearRowByLink(계약일, 업체명)` 추가: 계약 cascade

### Service
- `contact.ts` — `revertMeeting(email, id)` 추가, 상태별 분기:
  - **계약 → 예약**: patch(수임비/계약조건/계약여부 초기화) + 02 row clear
  - **완료/취소 → 예약**: patch(사유 초기화)
  - **변경 → 예약**: 자식 미팅 clearMeeting + 원본 patch(사유 초기화)
- `service/index.ts` export

### API
- `POST /api/meeting/[id]/revert` — 새 라우트, revertMeeting 호출

### Query Hook
- `useRevertMeeting()` in `contact-hooks.ts` — week-key invalidate

### UI
- `MeetingResultCard` — onRevert? prop 추가, 닫힌 카드 하단에 [↩️ 되돌리기] 버튼
  - 계약/완료/취소 카드: 회색 버튼 + confirm 다이얼로그
  - 변경 카드: 보라 버튼 + 자식 미팅 삭제 경고
- `DaySection` — onRevert? prop 패스스루
- `schedule/page.tsx` — handleRevert 핸들러, toast 에 cascade 요약 표시

## Cascade 정합성
- 계약 되돌리기: 02 매칭 row 없으면 cascade msg "이미 정리됨" — 에러 X
- 변경 되돌리기: 자식 못 찾으면 "변경 자식 미팅 없음" 표시 — 원본만 예약 복원
- 사용자가 02 row 를 수동으로 손댄 후 되돌리면 사용자 입력값(F~AD)도 함께 clear됨 — clearRow 가 C~AD 전체 clear (의도된 동작)

## Acceptance
- [ ] 계약 카드 → 되돌리기 → 시트에서 미팅 J=예약, 02 row C/D/E 비워짐
- [ ] 완료/취소 카드 → 되돌리기 → 미팅 J=예약, M(사유) 비워짐
- [ ] 변경 카드 → 되돌리기 → 원본 J=예약, 자식 미팅 row clear
- [ ] check.sh 통과

## Trade-off
- 02 row 의 F~AD 사용자 입력값(체크박스/슬롯) 도 cascade 시 삭제 — 사용자가 의도 안 해도 손실 가능
- 향후 [3] 수납삭제 cascade 와 함께 confirm 다이얼로그에 명시 (현 PR 에선 confirm 메시지에 포함)

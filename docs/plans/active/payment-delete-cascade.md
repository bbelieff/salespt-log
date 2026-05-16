---
slug: payment-delete-cascade
status: active
created: 2026-05-17
worktree: ../wt/pay-del
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수납 row 삭제 시 cascade(미팅 계약→예약) + 삭제 후 바로가기 팝업
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: payment 탭 ContractRow 삭제 흐름

# payment-delete-cascade — [3]

## 사용자 요청 (2026-05-17)
"수납삭제 cascade + 바로가기 팝업"

## 변경
- `lib/service/contract-payment.ts` — `removeContractPaymentWithCascade(email, row)`:
  - 삭제 전 row 의 (계약일, 업체명) 읽기
  - clearRow
  - 04 업체관리에서 (미팅날짜=계약일, 업체명, 상태=계약) 매칭 미팅 찾기
  - 미팅 patch: 상태=예약, 수임비=0, 계약조건="", 계약여부=false
  - 반환: cascade 메시지 + meetingId + 미팅날짜
- `lib/service/index.ts` export
- `app/api/contract-payment/[row]/route.ts` DELETE — `?cascade=meeting` 쿼리 지원
- `lib/query/contract-payment-hooks.ts` — `useRemoveContractPayment` 시그니처 `{row, cascade?}`, 응답에 cascade 정보 포함
- `app/(app)/payment/page.tsx`:
  - 삭제 확인 모달: cascade 체크박스 (기본 체크)
  - 삭제 후 cascade 성공 시 바로가기 팝업: "📅 일정·계약으로 이동" or "현재 화면 유지"

## Cascade 정합성
- [2a] 와 mirror: payment 삭제 = 미팅 계약 revert
- 매칭 미팅 없으면 cascade 메시지로 알림 (에러 X)
- 매칭 미팅이 계약 외 상태이면 손대지 않음

## Acceptance
- [ ] 삭제 모달에서 cascade 체크박스 표시, 기본 체크
- [ ] cascade=on 삭제 → 미팅 시트 J=예약, L=0, P=빈값
- [ ] cascade=on 삭제 + 매칭 발견 → 바로가기 팝업 노출
- [ ] cascade=off 삭제 → 미팅 손대지 않음
- [ ] check.sh 통과

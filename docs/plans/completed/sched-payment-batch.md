---
status: completed
slug: sched-payment-batch
created: 2026-05-19
completed: 2026-05-19
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정탭 미팅 모달 UX + 추가미팅 버그 + 수납탭 계약카드 재구성 batch
> - **누가 읽나요**: 개발자

# sched-payment-batch

## 사용자 보고 (2026-05-19)
일정탭 일정수정 모달:
- [1] 미팅날짜 필드 축소
- [2] 시간필드 확장
- [3] 분 15분 단위 4개 선택
- [4] 변경사항 없음 / 수정완료 옆에 일정삭제 버튼
- [5] 일정삭제 = 컨택탭 cascade 동일
- [6] 계약버튼 "영업관리 O열 합산" 문구 제거
- [7] 완료버튼 "시트M열" 문구 제거 (CancelForm/RescheduleForm 도 동일)
- [8] 추가미팅 폼 동일 UX 적용
- [9] 추가미팅 과거 날짜 차단
- [10] 추가미팅 카드 안 생기는 버그 fix

수납탭 계약카드:
- "서류 진행" → "실무 진행"
- 7 체크박스를 수집(3) + 진행(4) 2섹션으로 재구성

## 변경
- `components/ui/TimePicker15.tsx` 신규 — HH select + 4분 segmented
- `BasicEditDetails.tsx` — TimePicker15 + onDelete 버튼
- `AddMeetingForm.tsx` — TimePicker15 + min=today
- `MeetingResultCard.tsx`, `DaySection.tsx`, `schedule/page.tsx` — onDelete 와이어링 + cascade confirm
- `ContractForm/DoneForm/CancelForm/RescheduleForm.tsx` — 시트 컬럼 hint 텍스트 제거
- `lib/query/contact-hooks.ts` — useAppendMeeting 가 ["week"] invalidate (item [10] fix), useRemoveMeeting 가 ["week"] + ["payments"]
- `CheckboxList.tsx` — 수집/진행 2섹션
- `ContractRow.tsx` — "서류 진행" → "실무 진행"

## Acceptance
- [ ] 일정수정 모달에 [수정완료 | 일정삭제] 나란히 노출
- [ ] 일정삭제 confirm 에 cascade 명시 + 계약카드 있으면 표시
- [ ] 추가미팅 폼에 새 시간 segmented 4 버튼
- [ ] 추가미팅 과거 날짜 input min 차단
- [ ] 추가미팅 생성 후 일정탭에 즉시 노출
- [ ] 수납탭 계약카드 헤더 "실무 진행" + 2섹션 표시
- [ ] check.sh 통과

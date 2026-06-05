---
slug: add-meeting-min-date
status: active
created: 2026-06-05
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 완료 미팅의 추가미팅 날짜 하한을 '오늘'→'원래 미팅 날짜'로 — 오늘 이전(복기) 날짜 선택 허용.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/schedule/_components/AddMeetingForm.tsx`, `MeetingResultCard.tsx`

# 추가미팅 날짜 하한 = 원래 미팅 날짜

## 원인
AddMeetingForm 하한이 defaultDate(오늘) → `min`/가드가 오늘 이전 차단. 6/1 완료미팅의 6/4 추가미팅을 오늘(6/5) 복기 기록 못함.

## 변경
- AddMeetingForm: `minDate` prop 신설. `input min={minDate}` + 가드 `newDate < minDate`. 경고 "원래 미팅 날짜 이후로 선택해 주세요". 초기값 newDate는 오늘(defaultDate) 유지.
- MeetingResultCard: `minDate={meeting.미팅날짜}` 전달.

## Acceptance Criteria
- [ ] 6/1 완료미팅 추가폼에서 6/1 이후(6/4 등 오늘 이전 포함) 선택 가능.
- [ ] 원래 날짜보다 앞은 차단. 미래 날짜 정상.
- [ ] `npm run check` 통과.

## Log
- 2026-06-05 minDate prop 분리.

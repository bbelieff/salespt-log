---
slug: extra-meeting-action
status: active
created: 2026-05-17
worktree: ../wt/extra-mtg
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 완료/취소/계약 카드에서 같은 업체로 추가 미팅 잡기
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: schedule 탭 MeetingResultCard + AddMeetingForm

# extra-meeting-action — [2b]

## 사용자 요청 (2026-05-17)
"완료/취소 후 추가미팅 액션"

## 변경
- **`AddMeetingForm.tsx`** (신규) — 날짜/시간 입력 인라인 폼, 파란 톤
- **`MeetingResultCard.tsx`** — `onAddMeeting?` prop + 닫힌 카드 (계약/완료/취소) 에 [➕ 추가 미팅 잡기] 버튼 → 폼 표시
- **`DaySection.tsx`** — 패스스루
- **`schedule/page.tsx`** — `handleAddMeeting` 핸들러: `appendMeeting` 으로 새 row, 채널/장소/예약비고 복사, 새 uuid, 상태=예약, previousMeetingId 빈값 (독립 미팅)
- **`docs/design/components.md`** — AddMeetingForm 등재

## 데이터 흐름
- 기존 RescheduleForm 은 "변경": 원본 → "변경" + 새 row(`previousMeetingId=원본id`) — 체이닝
- 추가 미팅 은 "독립": 원본 그대로(완료/취소/계약 유지) + 새 row(`previousMeetingId=""`) — 체이닝 없음
- 업체명 `(변경)` prefix 제거 후 새 row 에 복사

## Acceptance
- [ ] 완료/취소/계약 카드 펼침 → [➕ 추가 미팅 잡기] 버튼 보임
- [ ] 폼 → 확정 → 새 카드 생성됨, 원본 상태 유지
- [ ] check.sh 통과

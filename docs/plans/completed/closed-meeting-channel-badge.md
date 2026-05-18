---
slug: closed-meeting-channel-badge
status: active
created: 2026-05-17
worktree: ../wt/closed-mtg-ch
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅카드 닫힘(접힘) 상태에서도 DB채널 배지 노출
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/schedule/_components/MeetingResultCard.tsx`
> - **읽고 나면 알 수 있는 것**: 접힌 카드에서 채널을 한눈에 식별 가능

# closed-meeting-channel-badge — [2c]

## 사용자 요청 (2026-05-17)
"닫힌 미팅카드 DB채널 표기" — 카드 펼치지 않고도 어느 채널 미팅인지 한눈에 보이게.

## 변경
- `MeetingResultCard.tsx` 헤더 row 에 채널 배지 항상 노출
  - 위치: 시간 다음, 업체명 앞
  - 사용 클래스: 기존 `CHANNEL_BADGE` (badge badge-purchase/direct/banner/referral)
- 펼침 영역의 중복 채널 배지 row 제거 (헤더에 항상 노출되므로 중복)
  - 기존 `flex justify-between` → `flex justify-end` (현재상태 라벨만 남김)

## 색 (`docs/design/tokens.md` 동일)
- 매입DB: blue-50/700
- 직접생산: green-50/600
- 현수막: amber-50/600
- 콜·지·기·소: purple-50/600

## Acceptance
- [ ] 모든 상태(reserved/contract/done/canceled/rescheduled) 의 접힌 헤더에 채널 배지 보임
- [ ] 취소 카드의 line-through 와 배지가 충돌하지 않음 (배지는 strikethrough 없음)
- [ ] check.sh 통과

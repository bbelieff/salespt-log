---
slug: meeting-delete-and-rezday
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅카드 삭제 시 채널 partial 저장 + 일정계약 미팅카드에 예약일 표시
> - **누가 읽나요**: 개발자

# meeting-delete-and-rezday

## 사용자 보고 (2026-05-18)
1. "일정계약 탭의 미팅카드에 생성일자를 적어서 언제 잡은 미팅인지 추적후 컨택관리에서 삭제할 수 있게 하자"
2. "미팅카드 삭제시 생산/유입/컨택진행/미팅예약 숫자가 다 사라지던데 오류인지 확인하고 미팅예약만 하나 줄어들도록 해줘"

## Fix [1] — 예약일 표시
- `MeetingResultCard` 펼침 영역 상단에 `📅 예약일 YYYY-MM-DD` 표시 (현재상태 라벨 옆)
- 사용자가 컨택관리 탭 그 날짜로 이동해 미팅 삭제 가능

## Fix [2] — 채널 partial 저장
- `handleRemoveSavedMeeting` 의 saveMetrics 호출이 **전체 4채널 draft** 전송 → 다른 채널의 draft 가 stale 한 0 이면 시트 row 도 0으로 덮어쓰는 사고
- Fix: `channels: { [targetCh]: latest[targetCh] }` 처럼 영향 채널만 partial 전송
- `saveContactMetrics` 가 이미 `Partial<Record<Channel, ...>>` 받고 채널별로 분기하므로 다른 채널 row 는 안 건드림

## Acceptance
- [ ] 일정계약 카드 펼침 시 예약일 노출
- [ ] 미팅 삭제 시 그 채널의 prod/inflow/contact 유지, mtg 만 -1
- [ ] check.sh 통과

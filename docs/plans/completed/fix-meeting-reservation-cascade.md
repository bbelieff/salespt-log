---
slug: fix-meeting-reservation-cascade
status: completed
completed: 2026-06-03
created: 2026-06-03
worktree: ../wt/fix-meeting-reservation-cascade (정리됨)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택진행을 미팅예약보다 낮추면 미팅예약 수치만 조용히 깎이고 미팅카드는 살아남는 desync 버그를 수정 — 미팅 삭제는 항상 미팅예약(−)로 명시적으로만, 컨택진행(−)이 카드 수보다 작아지려 하면 안내로 차단.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/page.tsx` (`step`/`setVal`/`adjustMetric`/`setMetric`), `MeetingPickerModal`, `lib/service/contact.ts`(읽기)
> - **읽고 나면 알 수 있는 것**: 미팅예약(H 수치) vs 미팅카드(업체관리 행)의 관계, 삭제 cascade 규칙, 안내 문구
> - **관련 문서**: `docs/plans/active/cascade-edge-cases.md`, `docs/plans/active/posthog-analytics.md`(이슈 출처)

# 미팅예약 수치 ↔ 미팅카드 desync 수정 (cascade)

## Intent (왜)
연습기 시트 테스트 중 발견. 미팅을 예약(미팅카드 생성, H+1)한 뒤 **컨택진행(−)을 미팅예약보다 낮추면**, 코드가 미팅예약 수치를 컨택진행에 맞춰 **조용히 깎지만 미팅카드는 삭제하지 않아** 수치(H)와 카드가 어긋난다(스크린샷: 미팅예약 0인데 카드 2건). 사용자는 미팅예약(−)을 눌러도 카드가 안 지워지는 것처럼 느끼고, 결국 0이 된 뒤 다시 눌러야 삭제 선택 팝업이 떠 혼란.

## 현재 동작 (root cause)
- `contact/page.tsx`의 `adjustMetric`·`setMetric`에 다음 클램프:
  ```ts
  if (next.meetingReservation > next.contactProgress) next.meetingReservation = next.contactProgress;
  ```
  컨택진행이 내려가면 미팅예약 수치만 강제로 낮춤 → **미팅카드(업체관리 행)는 그대로 → orphan**. 미팅예약 수치와 카드 수가 별개 데이터원(H 컬럼 vs 업체관리)이라 한쪽만 바뀜.
- 미팅 삭제는 `step("meetingReservation", -1)`이 카드 유무를 보고 picker/직접삭제로 처리(정상). 문제는 위 클램프가 **삭제 없이 수치만 깎는 우회 경로**라는 점.

## 사용자가 원하는 규칙
- **컨택진행 ≥ 미팅예약(=실제 미팅카드 수)** 불변식 유지.
- 미팅 삭제는 **반드시 미팅예약(−)** 으로만(카드 picker/확인 → cascade 삭제).
- 컨택진행(−)으로 카드 수보다 작게 만들려 하면 **차단 + 안내**: "미팅예약(미팅카드) N건이 있어요. 먼저 미팅예약을 −로 줄여 미팅을 삭제하세요."

## Acceptance Criteria
- [ ] 컨택진행(−) 또는 입력값이 그 채널 미팅카드 수보다 작아지려 하면 변경 거부 + 안내 토스트.
- [ ] 미팅예약 수치만 조용히 깎이는 클램프 경로 제거(또는 안내로 대체).
- [ ] 미팅예약(−)은 종전대로 카드 존재 시 picker(2건+)/확인삭제(1건), 카드 없고 수치만 있으면 정정 + 명확 토스트.
- [ ] desync 상태(H<카드)에서 미팅예약(−) → 카드 picker 즉시 노출.
- [ ] `npm run check` 통과.
- [ ] 모바일 스크린샷(차단 안내, 정상 삭제 흐름).

## Steps
1. `contact/page.tsx`에 채널별 미팅카드 수 헬퍼 `meetingCardCount(ch) = savedByChannel[ch].length + newSlotsForChannel(ch).length`.
2. `step`에서 `contactProgress` delta<0(−1/−10) 시: `cur.contactProgress + delta < meetingCardCount(ch)`면 안내 토스트 후 return.
3. `setVal`에서 `contactProgress` 직접 입력 시 동일 가드.
4. `adjustMetric`/`setMetric`의 미팅예약 클램프는 안전망으로 남기되, 위 가드로 파괴적 발동이 일어나지 않게 함(주석 갱신).
5. 미팅예약(−) phantom 분기 토스트 문구 명확화.

## Log
- 2026-06-03 Cowork에서 코드 초안 작성(working tree). 커밋·테스트는 사용자 PC Claude Code로 핸드오프(§6.7).

- 2026-06-03 사용자 PC Claude Code에서 검증·완료: 코드는 #262(`3fec889`)에 함께 머지됨. check.sh 통과 + orphan 가드(step/setVal) 코드-경로 확인. completed 이동.

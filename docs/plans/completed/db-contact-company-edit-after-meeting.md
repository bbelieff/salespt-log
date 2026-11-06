---
slug: db-contact-company-edit-after-meeting
status: completed
created: 2026-11-07
worktree: .claude/worktrees/adoring-elgamal-f3fa2d (branch fix/db-contact-company-edit-after-meeting)
---

# 미팅 잡은 업체도 DB정보에서 업체정보 고치기

## Intent (왜)
- belie 2026-11-06~07: 이진호 수강생 DB시트의 「윈디」 업체정보 팝업이 안 열림 → 미팅 예약을 잡은 업체는 컨택 칸 전체가 잠겨(fieldset disabled) 팝업 버튼도 눌리지 않았다. 선택지 중 **2번(미팅 뒤에도 고치기)** 선택.

## Acceptance Criteria (수용 기준)
- [x] 미팅 잡은 업체: 업체정보 편집기(팝업 포함)는 열림, 확인한 업체명·미팅예약 칸은 그대로 잠김
- [x] 고친 값은 그 미팅(이어진 미팅 id)에 저장 — 컨택관리와 같은 `usePatchMeeting`(PATCH /api/meeting/:id), 1초 자동 저장·저장 상태 표시·미저장 이탈 가드
- [x] 저장 뒤 DB관리시트 다시 읽기(줄 반영). DB 줄은 미팅을 보여 주는 읽기 전용 규칙(DbSheetLinkedMeetingReadOnly) 그대로
- [x] 미팅 전 업체는 예전 그대로(DB 줄 초안)
- [x] 시험 3개

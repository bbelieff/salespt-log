---
slug: payment-ci-view-select-mobile
status: completed
created: 2026-11-06
worktree: .claude/worktrees/gyeongnyeong-ilji-dc-c5a230 (branch fix/company-popup-mobile)
---

# 폰 업체정보·팝업의 보기 선택(기본보기/확장보기/대본)이 14px 로 눌려 못 누르던 문제

## Intent (왜)
- belie 2026-11-06: 「모바일에서 업체정보>팝업 이 눌리지도 않고 실행도 안됨」.
- 원인: #1330 에서 보기 선택을 공고필터와 한 묶음(div)에 넣었는데, 폰 전용 `.payment-ci-native{flex:1;width:0}` 가 그 작은 묶음 안에서 자랄 자리가 없어 14px 로 눌렸다 — 팝업의 「대본」 전환도 못 했다.

## Acceptance Criteria (수용 기준)
- [x] 폰(≤767px) 실무진행 업체정보 펼침·팝업에서 보기 선택이 글자가 보이는 폭(최소 5rem)으로 보이고 눌린다
- [x] 공고필터 버튼·「전체」 거르기와 겹치지 않고, 자리가 모자라면(320px 펼침) 「전체」가 다음 줄로
- [x] 320·375·412px 가로 넘침 없음 · 팝업에서 「대본」 전환 동작
- [x] PC·다른 화면(비 compact) 변화 없음 — 규칙은 767px 이하 compact 선택자 안에만
- [x] 회귀 시험 1개(payment-mobile-details-mock)

## Log
- 2026-11-06 원인 확인(합성 실무 화면 tests/browser/payment-live) · CSS 수정 · 화면 확인.

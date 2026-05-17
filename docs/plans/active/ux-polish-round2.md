---
slug: ux-polish-round2
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #223 후 사용자 피드백 fix (TODAY 디자인, ±10 정렬, fade 인터랙션)
> - **누가 읽나요**: 개발자

# ux-polish-round2

## 사용자 보고 (2026-05-18)

### [1] 인터렉션 없는게 아쉬움
- 스와이프 시 placeholderData 가 너무 매끄럽게 swap → 변화 인지 안 됨
- Fix: 본문 main 영역에 `isFetching` 동안 `opacity-50 → opacity-100` 200ms 트랜지션
- 헤더(WeekHeader)는 고정, 본문만 깜빡 — 사용자가 의도한 "슬라이더 고정 / 채널입력·합계 깜빡"

### [2] 생산 ±10 버튼 정렬
- 기존: `flex items-center gap-1` → 가운데 모임
- Fix: `w-full justify-between` → `-10`은 좌측(`-` 아래), `+10`은 우측(`+` 아래) 정렬

### [3] TODAY + 뱃지
- 뱃지 짤림: `overflow-hidden` 제거, `-top-1 -right-1` → `top-0.5 right-0.5` (양수 offset, 안쪽 배치)
- TODAY 디자인: 두꺼운 파란 보더 → **검은 보더** (`border-2 border-black`), 배경은 회색(`bg-gray-50`, 다른 셀과 동일)
- TODAY 텍스트: 검은 strip 안 (`absolute inset-x-0 top-0 bg-black rounded-t-[10px] text-white text-[9px] leading-[14px]`) — 잘리지 않음
- 컨택/일정계약 양탭 모두 적용

## Acceptance
- [ ] 스와이프 시 본문 fade
- [ ] 생산 ±10 좌우 정렬 (− 아래 −10, + 아래 +10)
- [ ] TODAY 검은 strip 안 글자 보임, 뱃지 잘림 없음
- [ ] check.sh 통과

---
slug: today-badge-position
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TODAY cell 뱃지 위치가 다른 cell 과 어긋나는 문제 fix
> - **누가 읽나요**: 개발자

# today-badge-position

## 사용자 보고 (2026-05-18)
"투데이의 뱃지 자리가 아직 다른 날짜들에 비해 좌측아래에 있음"

## Root cause
- 뱃지 `absolute right-0.5 top-0.5` 가 padding box 기준
- TODAY cell 은 `border-2` 가 있어 padding box 가 2px 안쪽 → 뱃지가 ~2px 안으로 들어감
- 또한 TODAY strip 이 상단 14px 차지 → 뱃지가 strip 영역과 겹쳐 시각적으로 더 아래로 보임

## Fix
- 뱃지 위치: `right-0.5 top-0.5` → `-right-1 -top-1` (negative offset, cell 코너 바깥)
- border box 기준으로 cell 외부에 떠 있어 border 두께 무관, today/non-today 동일 시각 위치
- 컨택/일정계약 양탭 적용

## Acceptance
- [ ] TODAY cell 뱃지 위치 = 다른 cell 뱃지 위치 (시각적 동일)

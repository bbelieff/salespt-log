---
slug: schedule-2col-divider
status: active
created: 2026-06-05
owner: belie
related: schedule-weekly-2col
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정·계약 PC 2열(금토일|월화수목)의 좌우 구분을 gap 확대 + 우 컬럼 세로 구분선으로 강화 — 시선이 가로로 안 새고 컬럼별 세로로 내려가게.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/schedule/page.tsx`
> - **관련 문서**: [[docs/plans/completed/schedule-weekly-2col]]

# 일정·계약 2열 좌우 구분 강화

## Intent
2열이 붙어 있어 같은 높이에서 금→월로 가로로 시선이 새기 쉬움. 두 컬럼을 분명히 분리.

## 변경 (schedule/page.tsx, pc: 만)
- 컨테이너 `pc:gap-4 → pc:gap-8`.
- 우 컬럼 `pc:border-l pc:border-gray-200 pc:pl-8` (세로 구분선 + 간격).
- 모바일(<pc) 변경 없음(회귀 0). 토큰만 사용(className 변경 → 줄수 불변, 500 유지).

## Acceptance Criteria
- [ ] PC에서 좌(금토일)·우(월화수목)가 구분선+넓은 간격으로 갈라져 컬럼별 세로로 읽힘.
- [ ] 모바일 회귀 없음. `npm run check` 통과.

## 범위 밖
- 색·구조·데이터 변경.

## Log
- 2026-06-05 gap-8 + 우 border-l/pl-8.

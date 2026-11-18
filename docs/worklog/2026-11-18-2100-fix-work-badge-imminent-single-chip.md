# 2026-11-18 · fix: D-day 배지 — 대표는 가장 임박한 할 일, 칩은 하나

- 목표: belie 「진행건이 복수면 더 임박한 건을 D데이로」·「History/Todo 글자 + H+00/D+00 은 정보 과다」. 계획 [work-badge-imminent-single-chip](../plans/completed/work-badge-imminent-single-chip.md).
- 변경: 업체 대표 진행건 = 미완료 Todo 가 가장 임박한 진행건(`compareRepresentativeActivity`). 배지에서 종류 글자 칩 제거. 담당 파일: `app/(app)/payment/_lib/payment-progress.ts`·`company-work-view.ts`·`institution-view.ts`, `app/(app)/payment/_components/WorkActivityBadge.tsx`.
- 판단(총괄): 「임박」= 미완료 Todo 의 날짜가 이른 순(지난 것 포함). 기록 없는 진행건(D?)도 Todo 가 있는 진행건에 양보. 목록 정렬 순서는 손대지 않음.
- 검증: 위 시험 3종, 실제 브라우저(합성 값), `bash scripts/check.sh`.
- 위험·복구: 표시·정렬 기준만. 데이터 변경 없음. 되돌리면 이전 대표 규칙·두 칩.

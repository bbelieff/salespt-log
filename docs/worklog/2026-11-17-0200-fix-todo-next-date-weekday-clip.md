# 2026-11-17 · fix: 할 일 「다음」 날짜 칸에서 요일이 잘리던 것

- 목표: belie 「투두에 요일 깨지는 거 안 깨지게」. 계획 [todo-next-date-weekday-clip](../plans/completed/todo-next-date-weekday-clip.md).
- 원인: 날짜 칸 너비 고정(128px)인데 글자는 글자 크기 단계만큼 커짐.
- 변경: 「다음 할 일 날짜」 칸을 글자 길이에 맞춤(`!w-auto shrink-0`). 담당 파일: `app/(app)/payment/_components/TodoRow.tsx`, `app/(app)/schedule/_components/board/TodoPopover.tsx`.
- 검증: todo-next-date-width 시험, 실제 브라우저(합성 값) 글자 1.3배에서 `2026-11-18 (수)` 전체 표시·넘침 없음, `bash scripts/check.sh`.
- 위험·복구: 표시 전용. 되돌리면 이전 고정 너비.

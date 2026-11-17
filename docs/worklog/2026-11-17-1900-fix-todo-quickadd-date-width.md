# 2026-11-17 · fix: 할 일 「바로 추가」 날짜 칸도 글자 길이에 맞춤

- 목표: belie 「바로 추가 날짜 칸도 똑같이 맞춰줘」. 계획 [todo-quickadd-date-width](../plans/completed/todo-quickadd-date-width.md).
- 변경: 「기록 날짜」 칸 고정 너비(9.5rem) → 글자 길이에 맞춤. 담당 파일: `app/(app)/payment/_components/TodoSection.tsx`.
- 검증: todo-quickadd-c 시험, 실제 브라우저(합성 값) 글자 1.5배에서 요일 전체 표시, `bash scripts/check.sh`.
- 위험·복구: 표시 전용. 되돌리면 이전 고정 너비.

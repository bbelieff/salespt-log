# 2026-11-18 · fix: 할 일 「바로 추가」 시각 칸도 내용 길이에 맞춤

- 목표: belie 「시각 선택 칸도 똑같이 맞춰줘」. 계획 [todo-quickadd-time-width](../plans/completed/todo-quickadd-time-width.md).
- 변경: 시각 칸 감싸는 칸의 고정 너비(8.5rem) 제거 → 내용 길이(약 107px). 담당 파일: `app/(app)/payment/_components/TodoSection.tsx`.
- 검증: todo-quickadd-c 시험, 실제 브라우저(합성 값) 글자 1~2배·판 480/300px 에서 칸 107px·가로 넘침 없음, `bash scripts/check.sh`.
- 위험·복구: 표시 전용. 되돌리면 이전 고정 너비.

# 할 일 「바로 추가」 날짜 칸 — 글자 길이에 맞춤

- 목적: belie 2026-11-17 「바로 추가 날짜 칸도 똑같이 맞춰줘」. 앞 작업 [todo-next-date-weekday-clip](todo-next-date-weekday-clip.md) 과 같은 처리. 관련: [components](../../design/components.md) Date Input.

## 수용 조건
- 글자 크기 단계와 관계없이 `YYYY-MM-DD (요일)` 이 다 보인다(전에는 9.5rem 고정 — 약 1.38배부터 잘림). 좁으면 뒤 칸이 아래 줄로 내려가고 가로 넘침 없음.

## 변경
- `TodoSection.tsx`: 「기록 날짜」 칸 `!w-[9.5rem]` → `!w-auto`.

## 검증
- `tests/components/todo-quickadd-c.test.ts`, 실제 브라우저(합성 값), `bash scripts/check.sh`.

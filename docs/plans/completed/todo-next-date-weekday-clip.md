# 할 일 「다음」 날짜 칸 — 요일 잘림

- 목적: belie 2026-11-17 「투두에 요일 깨지는 거 확인하고 안 깨지게, 줄이더라도」(캡처: `2026-11-20 (…`). 관련: [components](../../design/components.md) Date Input.

## 원인
- 「+ 다음」 날짜 칸 너비가 128px(`!w-32`) 고정인데 글자는 글자 크기 단계(`--font-scale`)만큼 커진다 → 1.13배를 넘으면 요일이 `…` 로 잘린다. 주간 보드 할 일 창(`!w-36`)도 같은 구조.

## 수용 조건
- 글자 크기 단계와 관계없이 `YYYY-MM-DD (요일)` 이 다 보인다. 줄이 좁으면 날짜·저장·취소 묶음이 아래 줄로 내려간다(가로 넘침 없음).

## 변경
- `TodoRow.tsx`·`TodoPopover.tsx`: 날짜 칸 `!w-auto shrink-0`.

## 검증
- `tests/components/todo-next-date-width.test.ts`, 실제 브라우저(합성 값, 글자 1.3배 · 판 너비 480/300px)에서 잘림·넘침 없음, `bash scripts/check.sh`.

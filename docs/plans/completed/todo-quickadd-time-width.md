# 할 일 「바로 추가」 시각 칸 — 내용 길이에 맞춤

- 목적: belie 2026-11-18 「시각 선택 칸도 똑같이 맞춰줘」. 앞 작업 [todo-quickadd-date-width](todo-quickadd-date-width.md) 후속. 관련: [components](../../design/components.md) Date Input·TodoSection.

## 확인한 것
- 시각 칸을 감싼 칸이 8.5rem(136px) 고정인데 보이는 상자는 약 107px — 오른쪽에 약 29px 빈 틈이 남아 「추가」가 떨어져 보였다.
- 시·분 글자는 글자 크기 최대 단계(1.3배)에서도 칸(36px) 안에 들어간다(잘림 없음).

## 수용 조건
- 시각 칸이 내용 길이에 맞고, 날짜·시각·추가·자세히 간격이 같다. 가로 넘침 없음.

## 변경
- `TodoSection.tsx`: 시각 칸 감싸는 칸에서 `w-[8.5rem]` 제거.

## 검증
- `tests/components/todo-quickadd-c.test.ts`, 실제 브라우저(합성 값), `bash scripts/check.sh`.

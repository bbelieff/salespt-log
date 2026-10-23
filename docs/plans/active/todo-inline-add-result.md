> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 진행건 칸의 Todo/History 를 팝업 없이 바로 추가하고, 완료한 할 일에 결과 한 줄과 이어지는 다음 할 일을 바로 남긴다.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/TodoSection.tsx`·`TodoRow.tsx`, `Todo.result`(시트 R 열·DB payload)
> - **읽고 나면 알 수 있는 것**: 무엇이 바뀌나 / 데이터는 어디에 저장되나 / 되돌리는 법
> - **관련 문서**: `docs/domains/sheet-structure.md` §5-2, `docs/domains/data-model.md` Todo, 선행 [todo-slot-link](todo-slot-link.md)

---
slug: todo-inline-add-result
status: active
created: 2026-10-23
---

# 투두 바로 추가 + 완료 결과 메모 (belie 승인 목업 [4])

- **바로 추가**: 제목(+날짜)만 쓰고 Enter·「추가」 → 팝업 없이 저장. 생성 경로는 상세 팝업과 같다(`useCreateTodo`, 진행건 번호·기관·계약, 초안당 멱등 키). 날짜를 비우면 할 일=내일(KST)·한 일=오늘. 시각은 09:00(예전 기본값), 다른 시각·종류·상세는 「자세히」 → 기존 `TodoFormModal`. 새 줄은 2초간 옅은 파랑, 포커스는 제목 칸으로 돌아간다. History 도 같은 경로.
- **결과 메모**: `Todo.result`(string, 옛 데이터·null = 빈값). 시트 05 실무투두 **R 열**(머리글 「결과」, 비었을 때만 씀), `P:S` 분리 write — O(캘린더 ID) 비접촉. DB payload 는 Todo 그대로(열문자 복원 A..R). PATCH `/api/todos/:id` 에 `result`(≤200자).
- **화면**: 완료 Todo + 결과 없음 → 이름 옆 점선 「+ 결과」(hover 옅은 배경·실선). 누르면 아래 한 줄 입력(h-9). Enter=저장, Esc·빈 blur=원래대로. 글이 있는 채 blur 하면 저장(입력 유실 방지 — 자율결정). 결과가 있으면 초록 「결과 · …」, 누르면 같은 입력으로 고침(지우고 Enter = 결과 지움). 미완료·History 는 태그 없음.
- **연계 할 일 「+ 다음」**(belie 추가 결정): 완료 Todo·History 이름 옆 점선 「+ 다음」(같은 모양). 누르면 아래 한 줄 = 제목 + 날짜(기본 내일 KST). Enter = 같은 진행건(계약·기관·진행건 번호)에 새 Todo, Esc·빈 채 밖 클릭 = 취소, 실패 = 입력 유지 + 이유. 새 Todo 에 `prevId`(원래 기록 id) — 시트 **S 열**(머리글 「이전 기록」)·DB payload. 화면엔 새 줄만 보인다.
- **R 열 기존 값**: R 에 사람이 적어 둔 값이 있으면 결과로 읽고, 고치지 않는 한 그대로 다시 쓴다(보존).
- **검증**: `tests/components/todo-quickadd-c.test.ts`, `tests/components/todo-result-note.test.ts`, `tests/repo/todos-result-column.test.ts`, check.sh, next build, 화면 1280·375.
- **되돌리기**: revert 1회. R 열 값은 남아도 옛 코드가 읽지 않는다.

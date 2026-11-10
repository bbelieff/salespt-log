# 2026-11-10 13:20 fix/discard-confirm-dialogs

- 목표: UI 점검 보고서 1-3 — 적던 내용이 경고 없이 사라지는 창 4곳(belie 「일반적인 표현으로 바꿔서 진행」).
- 담당 파일: `components/ui/confirm-discard.ts`(새), `app/(app)/db-sheet/_components/ImportDialog.tsx`, `CallConfirmScreen.tsx`, `app/(app)/payment/_components/TerminationModal.tsx`, `app/(app)/calendar/_components/GeneralEventModal.tsx`, 시험 1, components.md.
- 검증: vitest 7 + 기존 66, tsc. 실제 화면 NOT_RUN(로그인 필요).
- 계획: [discard-confirm-dialogs](../plans/completed/discard-confirm-dialogs.md)
- 위험/복구: 화면만, revert 1건.

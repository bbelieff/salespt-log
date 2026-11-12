# 2026-11-12 01:00 feat/app-dialog-unify-2

- 목표: 결정 4(승인) 2차 — 1차에서 남긴 창을 AppDialog 규칙으로 옮기고, 최상단 층 위로 body 포털이 못 올라오는 막힘을 공용으로 푼다.
- 담당 파일: 새 `components/ui/top-layer.tsx`·`top-layer.css`·`tests/components/top-layer-dialog.test.ts`. 수정 — `components/ui/{AppDialog,HintTooltip}.tsx`, `components/company-doc/{CompanyDocAutofillDialog,CompanyDocAutofillButton}.tsx`, `components/CompanyInfoEditor.tsx`(포털 위치만), `app/(app)/db-sheet/_components/{DbDetail,CallConfirmScreen,CallUi}.tsx`, `components/payment/MeetingLinkDialog.tsx`, `app/(app)/contact/_components/{RecordMoveModal,RecordMoveReceipt}.tsx`, `components/bug-report/BugReportDialog.tsx`, `components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx`, `components/badges/BadgeDetailSheet.tsx`, `components/auth/{CohortCreateModal,ArenaCreateModal,BulkReserveButton,TrainerApplication}.tsx`. 시험 `meeting-link-dialog.test.ts`(+2)·`record-move.test.ts`(소스 가드 → AppDialog). 문서 components.md.
- 포털 풀이: `PortalTargetContext`/`usePortalTarget` — 열린 최상단 층 창 안이면 그 `<dialog>` 에 포털, 밖이면 body. `useTopLayerDialog` 로 showModal·초점·Esc·강제 닫힘 공용화(AppDialog 도 사용). 초점이 창 안 포털 팝업이면 Esc 는 그 팝업 몫.
- MeetingLinkDialog: 실무/수납 진입 Esc·취소 = 저장 없이 닫기. 일정·계약 진입은 닫기 불가(미팅이 이미 계약으로 저장된 뒤라 「따로 등록」·「연결하기」 둘 다 안 하면 장부 행이 빠짐) — plan 에 이유.
- 안 옮김: MeetingSafetyDialog·TrainerAccessEditor(이미 네이티브 dialog), app/claim(팝업 없음), IdentityGuard·WebviewWarning(차단 안내).
- 저장 값·경로 무변경. DB정보 모양 CSS 무변경(className 만).
- 검증: `npx tsc --noEmit -p .` 통과, eslint 바꾼 파일 오류 0, `bash scripts/doc-drift.sh` 통과, vitest `tests/components`+`tests/structural` 216파일 1784건 통과(1 skip, 기존). check.sh·build 는 총괄이 직렬 실행(NOT_RUN 여기서). 실제 화면 NOT_RUN(로그인 필요).
- 계획: [app-dialog-unify-2](../plans/completed/app-dialog-unify-2.md)
- 위험/복구: 화면 동작만. revert 1건으로 복구.

# 2026-11-10 18:02 feat/app-dialog-unify

- 목표: UI 점검 결정 4(승인) — 팝업 동작 세 갈래를 공용 `AppDialog` 하나로(Esc·✕·취소, dirty 면 confirmDiscard, 첫 칸 초점·연 버튼 복귀, showModal 로 뒤 화면 inert, 입력 창은 바깥 누르기 무시, 폰 서랍·PC 가운데).
- 담당 파일: 새 `components/ui/AppDialog.tsx`·`app-dialog.css`·`tests/components/app-dialog.test.ts`. 옮김 — `components/DirtyGuard.tsx`(확인창), `components/ui/CrossTabHintModal.tsx`, `components/TopHeader.tsx`(계정 메뉴 Esc만), `app/(app)/payment/_components/{DeleteConfirmModal,SlotDeleteConfirmModal,TerminationModal,PostDeleteNavModal,TodoFormModal,MeetingLinkPicker}.tsx`, `app/(app)/contact/_components/{MeetingPickerModal,LeadPickerModal}.tsx`, `app/(app)/calendar/_components/{GeneralEventModal,TodoDayCard}.tsx`, `app/(app)/db/_components/ConfirmModal.tsx`. 시험 갱신 `confirm-discard.test.ts`·`payment-todo-form-modal.test.ts`(바깥 누르기 → 안 닫힘 규칙). 문서 components.md.
- 안 옮김: IdentityGuard(지시), DbDetail(ContactPanel 의 body 포털 팝업이 최상단 층 뒤에 깔림·CSS 범위 밖), TodayActivity(제자리 카드), MeetingLinkDialog(닫기=따로 등록 저장), SaveConfirmModal(미사용), RecordMoveModal 등 — 이유는 plan.
- 저장 값·경로 무변경.
- 검증: tsc 통과, vitest 관련 27파일 285건 통과(1 skip, 기존) + tests/structural 20파일 통과, eslint 바꾼 파일 오류 0. check.sh 는 총괄이 직렬 실행. 실제 화면 NOT_RUN(로그인 필요).
- 계획: [app-dialog-unify](../plans/completed/app-dialog-unify.md)
- 위험/복구: 화면 동작만. revert 1건으로 복구.

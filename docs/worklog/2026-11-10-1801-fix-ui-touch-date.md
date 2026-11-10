# 2026-11-10 18:01 fix/ui-touch-date

- 목표: UI 결정 2-A(작은 버튼 보이지 않는 44px 누름 영역, 공용 `hit-44`)·결정 5(네이티브 날짜 칸 11곳 → `DateInputCustom`).
- 담당 파일: `app/globals.css`(hit-44·날짜 칸 버튼화·compact), `components/ui/DateInputCustom.tsx`·`TimePicker15.tsx`, `components/FontScaleControl.tsx`·`auth/TraineeCard.tsx`, `app/(app)/contact/_components/ChannelTabsAndPanel.tsx`, `app/(app)/db/_components/RowCard.tsx`, `app/(app)/schedule/_components/{RescheduleForm,CancelForm,AddMeetingForm,BasicEditDetails}.tsx`, `app/(app)/payment/_components/{LinkedFieldsEditor,PaymentSlotForm,PriorContractRegister,StandaloneCompanyAdd,TodoFormModal,TodoRow,TodoSection}.tsx`, `app/(app)/calendar/_components/GeneralEventModal.tsx`, 시험, design 문서. ContactPanel·db-sheet CSS 미변경.
- 검증: tsc 통과, vitest 관련 시험(새 `ui-touch-date` + 갱신 4개 + date-input-picker 등) 통과, structural 통과. check.sh·실제 화면 NOT_RUN(총괄 직렬 실행).
- 미완료: db-sheet·관리자·가계부 등 네이티브 날짜 칸 11곳은 범위 밖(허용 목록). 줄바꿈 사유 버튼 줄은 세로 누름 영역이 일부 겹침(뒤 버튼 우선).
- 계획: [ui-touch-date](../plans/completed/ui-touch-date.md)
- 위험/복구: 화면만, revert 1건.

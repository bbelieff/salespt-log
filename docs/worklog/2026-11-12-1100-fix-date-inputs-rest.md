## 2026-11-12 11:00 · fix/date-inputs-rest — 남은 날짜 칸 11곳도 요일 달력으로

- 브랜치 fix/date-inputs-rest. 요청: belie 「남은 날짜 칸 11곳도 달력으로 바꿔줘」.
- 변경: 네이티브 `<input type="date">` 18칸(파일 11개: db-sheet Grid·InflowPeriod·AbsenceLog·ImportDialog·CallConfirmScreen, NoticeManager, CohortCreateModal, SeasonStartInput, ExpenseEntryEditor, ExpenseLedgerDialog, PeriodPicker) → `DateInputCustom`. DateInputCustom 에 `clearable`·`autoFocus`·`defaultOpen`·`ariaInvalid`·`ariaDescribedBy` 추가, 열린 달력 Esc 가 감싼 dialog·팝오버로 새지 않게, 달력 안 mousedown 은 초점 유지. Grid `save()` 에 고른 값 인자.
- 담당 파일: 위 화면 11개 + components/ui/DateInputCustom.tsx, app/globals.css(.date-pop-clear), 시험 8개, docs/design/components.md §2, plan.
- 검증: tsc 통과, 관련 vitest 104파일 통과. check.sh·화면 확인은 총괄.
- 위험/복구: 화면만, 저장 값 형식 불변. revert 1건. [plan](../plans/completed/date-inputs-rest.md)

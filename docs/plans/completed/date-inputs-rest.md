> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 남은 네이티브 `<input type="date">` 18칸(파일 11개)을 요일 보이는 달력 `DateInputCustom` 으로 바꾸고, 다시 생기지 않게 시험을 예외 없이 조였다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/ui/DateInputCustom.tsx`, `app/globals.css`(`.date-pop-clear`), 아래 화면 파일, `tests/components/ui-touch-date.test.ts`
> - **관련 문서**: [1차 교체(ui-touch-date)](ui-touch-date.md) · [components §2 Date Input](../../design/components.md)

# 남은 날짜 칸 달력으로 (2026-11-12)

## 목표
belie 「남은 날짜 칸 11곳도 달력으로 바꿔줘」. 1차(ui-touch-date)에서 범위 밖으로 남긴 곳 전부. 값 `YYYY-MM-DD`·onChange 의미·min/max/required/disabled/이름표/autoFocus 유지, 저장되는 값은 바꾸지 않는다.

## 대상
- DB 목록(`app/(app)/db-sheet/_components`): `Grid`(셀 편집기 「다음 연락일」), `InflowPeriod`(유입일 범위 2), `AbsenceLog`(통화한 날짜, max=오늘), `ImportDialog`(빈 유입일 채우기), `CallConfirmScreen`(미팅 날짜).
- `app/admin/popup/_components/NoticeManager`(시작·종료 2), `components/auth/CohortCreateModal`(수강시작일), `components/auth/SeasonStartInput`(시즌 개강일), `components/dashboard/expense-ledger/ExpenseEntryEditor`(2)·`ExpenseLedgerDialog`(4), `components/ui/PeriodPicker`(2, 대시보드·실무/수납 공용).

## DateInputCustom 추가 (작은 props)
- `clearable` — 달력 아래 [지우기] → `onChange("")`. 네이티브 칸은 지울 수 있었으므로 빈 값이 뜻이 있는 칸에 붙여 동작을 유지.
- `autoFocus`·`defaultOpen` — 셀 편집기처럼 누르면 곧 고르는 곳.
- `ariaInvalid`·`ariaDescribedBy` — 비용 원장 검사 표시·미리보기 연결 유지.
- 열린 달력의 Esc 는 document 캡처에서 받아 막는다 → 감싼 `<dialog>`(통화 확인·비용 원장·AppDialog)·유입일 범위 팝오버가 같이 닫히지 않는다.
- 달력 안 mousedown 은 초점을 겉 칸에 남긴다 → 감싼 쪽 blur 저장이 날짜를 누르기 전에 돌지 않는다(Safari 류).
- `min`/`max` 는 이미 있었다(범위 밖 날 비활성).

## 셀 편집기(Grid) 동작
저장 로직은 그대로, `save()` 에 고른 값을 넘기는 선택 인자만 더했다. 누르면 달력이 바로 열림 → 날짜 누르면 곧 저장 / Enter·Tab = 지금 값 저장 후 이동(편집 칸 캡처 단계에서 먼저 받음) / Esc = 열린 달력이면 달력만, 다음 Esc 는 취소 / 초점이 편집 칸 밖으로 나가면 지금 값 저장(예전 blur 와 같음). 실패 모드(fail)면 고른 값을 들고 오류·[저장]/[취소] 유지.

## 잘림 확인
팝오버는 원래 `position:fixed` + 직접 잰 좌표라 부모 overflow(그리드 스크롤·창 본문)에 안 잘린다. 대상 조상에 상시 transform 은 없다(app-dialog·DB정보 등장 애니메이션의 transform 은 애니메이션 동안만). 최상단 층 `<dialog>` 안에서는 팝오버도 DOM 상 그 안이라 같이 위에 뜬다. 추가 수정 없음.

## CohortCreateModal 사고 대비 유지
자동화가 DOM 값만 넣은 사고(2회) 대비 폴백은 숨은 입력(`name="courseStartISO"`)의 DOM 값을 읽는 것으로 유지.

## 검증
- `tests/components/ui-touch-date.test.ts`: 허용 목록 삭제 → `app`·`components` 에 `type="date"` 0개(예외 없음), 교체 22파일 확인, 새 props 계약 5건.
- 갱신: `db-sheet-grid-selection`(+셀 편집기 2건: 고르면 저장·지우기·Esc 2단계·Enter 저장), `cohort-create-modal-date`, `expense-ledger-ui`(시작일 이전 날 비활성 확인 + 역전은 시작일을 옮겨 재현), `expense-autosave-b`, `db-sheet-import-paste-review`·`-spotlight`, `db-sheet-ui-controls`.
- tsc, 관련 vitest. 실제 화면 확인 NOT_RUN — 총괄이 check.sh·화면 확인.

## 되돌리기
squash 커밋 1건 revert. 화면만, 저장 값 형식·데이터 변경 없음.

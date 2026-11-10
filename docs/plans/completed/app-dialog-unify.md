---
status: completed
slug: app-dialog-unify
created: 2026-11-10
owner: belie
completed: 2026-11-10
---

# 팝업 동작 하나로 — AppDialog (결정 4)

## Intent
belie 승인(2026-11-10 UI 점검 결정 4): 팝업 동작이 세 갈래였다 — ① DB 목록 창(SheetDialog: Esc·첫 칸 초점·연 버튼으로 초점 복귀), ② 저장 확인·할 일 창(Esc 는 되지만 뒤 화면에 키보드가 닿음), ③ 해지·삭제 확인·미팅/발굴 고르기·캘린더 일정 등(Esc 없음, 뒤 화면에 키보드가 닿음). ① 방식을 공용 부품 하나로 만들어 옮긴다. 각 창의 색·글꼴·내용·저장하는 값은 그대로.

## 공통 규칙 (AppDialog)
- 닫기 = Esc · ✕ · 「취소」. 적던 내용(dirty)이 있으면 공용 `confirmDiscard(dirty)` 로 한 번 묻는다. 미저장 가드(DirtyGuard)를 쓰는 창은 그 가드(「저장하지 않고 나갈까요?」)를 그대로 탄다.
- 열리면 첫 입력 칸(확인 창은 [취소])에 초점, 닫히면 연 버튼으로 복귀.
- 네이티브 `<dialog>.showModal()` — 뒤 화면 inert, 뒤 스크롤 잠금.
- 바깥 누르기: 입력 없는 안내·확인 창만 닫는다. 입력 창은 안 닫는다.
- 휴대폰·태블릿(<1024px) = 아래 서랍, PC(lg) = 가운데. 버튼 순서 「취소 · 주 버튼」(옮긴 창은 이미 이 순서 — 버튼 크기는 다른 작업 범위라 그대로).

## Acceptance Criteria
- [x] `components/ui/AppDialog.tsx`(+ `app-dialog.css`) — `AppDialogClose`·`useAppDialogClose`, size xs~xl, `dismissOnBackdrop`, `dirty`.
- [x] 시험 `tests/components/app-dialog.test.ts` 9건 — Esc·초점 복귀·dirty 확인(아니오면 안 닫힘)·입력 창 바깥 누르기 무시·안내 창 바깥 누르기 닫힘·드래그 무시·겹친 창(안쪽 Esc 가 바깥 창을 닫지 않음)·data-autofocus.
- [x] 데이터 쓰는 창부터 옮김(아래 표). 저장 경로·값 무변경.
- [x] DirtyGuard 확인창도 AppDialog — 열린 AppDialog 위에 쌓여 눌림(안 그러면 최상단 층 뒤에 깔린다).
- [x] 기존 시험 갱신(해지 창·할 일 창: 바깥 누르기 → 안 닫힘으로 승인된 규칙 반영).
- [x] components.md 등재·각 창 줄 갱신.

## 옮긴 창
| 창 | 종류 | 바깥 누르기 |
|---|---|---|
| DirtyGuard 「저장하지 않고 나갈까요?」 | 확인 | 닫힘(=취소) |
| 계약수납 삭제 확인 `DeleteConfirmModal` | 확인 | 닫힘 |
| 진행건 삭제 확인 `SlotDeleteConfirmModal` | 확인 | 닫힘 |
| 계약해지 `TerminationModal` | 입력(dirty) | 안 닫힘 |
| 삭제 후 이동 안내 `PostDeleteNavModal` | 안내 | 닫힘 |
| 할 일·한 일 `TodoFormModal` | 입력(DirtyGuard) | 안 닫힘 |
| 영업기록 고르기 `MeetingLinkPicker` | 검색 | 안 닫힘 |
| 삭제할 미팅 고르기 `MeetingPickerModal` | 고르기 | 닫힘 |
| 발굴에서 가져오기 `LeadPickerModal` | 검색 | 안 닫힘 |
| 캘린더 일반이벤트 `GeneralEventModal`(+첫 추가 안내) | 입력(DirtyGuard) | 안 닫힘(안내는 닫힘) |
| 캘린더 일정 삭제 확인 `TodoDayCard` | 확인 | 닫힘 |
| DB 삭제 확인 `db/ConfirmModal` | 확인 | 닫힘 |
| 탭 간 안내 `CrossTabHintModal` | 안내 | 닫힘 |
| 계정 메뉴(TopHeader) | 메뉴 — AppDialog 아님 | Esc 닫기 + 로고로 초점 복귀만 추가 |

## 옮기지 않은 창 (이유)
- `IdentityGuard` — 일부러 안 닫히는 최상단 차단막(지시).
- DB정보 패널 `DbDetail` — 안의 ContactPanel(손대지 않는 범위)이 body 포털 팝업(문서 자동입력 `CompanyDocAutofillDialog` z-50 등)을 띄운다. showModal 최상단 층 위로 포털이 못 올라와 그 팝업이 가려지고 눌리지 않게 된다. 배치·너비 조절 CSS 도 db-sheet CSS(범위 밖).
- 오늘 활동 `TodayActivity` — 모달이 아니라 제자리에서 커지는 카드(PC 오른쪽 아래 고정, 손가락 밀기). 이미 Esc·배경 눌러 닫기가 있고, 배치 CSS 가 db-sheet CSS(범위 밖). 가운데 창·서랍으로 바꾸면 승인된 모양이 바뀐다.
- `MeetingLinkDialog` — 일정·계약 진입(`useManualLinkPrompt`)에서 닫기 = 「따로 등록」(새 계약 행 저장)이다. Esc 를 붙이면 Esc 가 저장을 일으킨다 → 「그냥 닫기」 결과를 따로 정해야 함.
- `SaveConfirmModal` — 지금 어디서도 띄우지 않는다(도우미 함수만 재수출). 옮겨도 사용자 변화 없음.
- `RecordMoveModal`(466줄, 4단계·자체 바깥 누르기 확인)·`RecordMoveReceipt` — 500줄 상한 근처의 단계형 창. 별도 작업으로.
- SheetDialog 계열(DB 목록 창 10종) — 이미 ① 방식. 그대로 둔다(CSS 가 db-sheet CSS).
- 그 밖 `NoticePopup`·`CompanyDocAutofillDialog`(이미 Esc·초점 처리), 관리자 창(Cohort/Arena/Trainer), `BugReportDialog`·`ExpenseLedgerDialog`·`BadgeDetailSheet`·`MapRouteButton`·`MeetingSafetyDialog`·`app/claim` 등 — 이번 1차(데이터 쓰는 창 우선) 범위 밖, 후속.

## 위험·한계
- 최상단 층 위로는 body 포털이 못 올라온다: 옮긴 창 안에서 HintTooltip·포털 팝업을 띄우는 곳은 없음을 확인. `LoadingOverlay`·토스트는 창 뒤(어둡게)에 보인다.
- 실제 화면(모바일 서랍·PC 가운데) 확인은 NOT_RUN — 로그인 필요. jsdom 시험·tsc 로 확인.

## 범위 밖
- 버튼 누름 크기, 네이티브 날짜 칸(다른 작업).

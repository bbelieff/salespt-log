---
status: completed
slug: app-dialog-unify-2
created: 2026-11-12
owner: belie
completed: 2026-11-12
---

# 팝업 동작 하나로 — 2차 (결정 4 이어서)

## Intent
1차([app-dialog-unify](app-dialog-unify.md))에서 남긴 창을 같은 규칙(Esc·✕·취소 닫기, 적던 내용이면 한 번 묻기, 첫 초점·연 버튼 복귀, 뒤 화면 inert, 입력 창은 바깥 누르기 무시)으로 옮긴다. 1차의 막힘 — 최상단 층(showModal) 위로 body 포털 팝업이 못 올라오는 문제 — 을 공용으로 푼다. 각 창의 색·글꼴·내용·저장 값은 그대로.

## 포털 문제 풀이 (가장 작은 완전한 방법)
- 새 `components/ui/top-layer.tsx`: `PortalTargetContext`·`usePortalTarget()` — 열린 최상단 층 창이 자기 `<dialog>` 를 내려 주고, 포털을 쓰는 부품은 body 대신 그 안에 그린다(창 밖이면 지금처럼 body). 바꾼 부품: HintTooltip·CompanyDocAutofillDialog·CompanyDocAutofillButton 알림·CompanyInfoEditor 편집 창(SupplierInput 은 원래 `closest('dialog')`).
- 같은 파일 `useTopLayerDialog`: showModal·스크롤 잠금·첫 초점·초점 복귀·Esc(cancel)·브라우저 강제 닫힘 재열기를 한곳에. 초점이 창 안 포털 팝업(본판 밖)에 있으면 Esc 는 그 팝업 몫이라 바깥 창을 닫지 않는다. AppDialog 도 이 훅으로 바꿈(동작 무변경, 1차 시험 그대로 통과).
- `top-layer.css` `.top-layer-plain`: `:where` 점수 0 으로 브라우저 기본 dialog·popover 모양만 지운다 → 모양을 바꿀 수 없는 창(DB정보 등)이 자기 클래스 모양 그대로 최상단 층에 뜬다.
- DB정보 위에 뜨던 페이지 층: `CallConfirmScreen`(DB정보 「확인하기」로 열림) → 최상단 층 dialog, 통화 알림 → `popover="manual"`. 안 그러면 모달 DB정보 뒤에 깔린다.

## Acceptance Criteria
- [x] DbDetail = 네이티브 dialog, 모양 CSS 무변경(className `top-layer-plain`·`focus:outline-none` 만 추가). Esc·✕·바깥 = 닫기(유입 반영 저장 중엔 안 닫힘), 패널 안에서 시작한 끌기는 무시, 안 포털 팝업은 dialog 안.
- [x] MeetingLinkDialog: 실무/수납 진입은 Esc·「취소」 = 저장 없이 닫기. 일정·계약 진입은 닫기 불가(아래 이유).
- [x] 3번 목록 중 안전한 것 옮김(아래 표).
- [x] 시험: 새 `tests/components/top-layer-dialog.test.ts` 10건, `meeting-link-dialog.test.ts` +2건, `record-move.test.ts` 소스 가드 갱신(같은 보장을 AppDialog 로 확인 — 약화 아님).
- [x] components.md 등재·각 창 줄 갱신.

## 옮긴 창
| 창 | 방식 | 닫기 |
|---|---|---|
| DB정보 `DbDetail` | 자기 dialog + useTopLayerDialog | Esc·✕·바깥(저장 중 제외) |
| 통화 정리 확인 `CallConfirmScreen` | 자기 dialog + 훅 | Esc = 「나중에」(고친 게 있으면 묻기) |
| 통화 알림(CallUi toast) | popover=manual | (닫기 버튼 그대로) |
| 영업기록과 연결 `MeetingLinkDialog` | AppDialog lg | 실무/수납: Esc·취소 / 일정·계약: 닫기 없음 |
| 기록 옮기기 `RecordMoveModal` | AppDialog sm | Esc·×·바깥 = dismiss(고른 게 있으면 묻기, 저장 중·오류 땐 안 닫힘) |
| 이동 저장 결과 `RecordMoveReceipt` | AppDialog sm 안내 | Esc·×·확인·바깥 |
| 오류신고 `BugReportDialog` | 자기 dialog + 훅(br- 모양 그대로) | Esc·✕(적던 내용 있으면 묻기, 그림판 중 Esc 무시), 바깥 안 닫힘 |
| 비용 원장 `ExpenseLedgerDialog` | 자기 dialog + 훅(모양 그대로) | Esc·×, 바깥 안 닫힘(입력 창·자동 저장) |
| 배지 보기 `BadgeDetailSheet` | AppDialog sm 안내 | Esc·닫기·바깥 |
| 기수/참가자 추가 `CohortCreateModal`·아레나 추가 `ArenaCreateModal` | AppDialog lg | Esc·✕·닫기(적은 칸 있고 결과 전이면 묻기), 바깥 안 닫힘 |
| 유보 처리 `BulkReserveButton` 모달 | AppDialog md | Esc·✕·취소·바깥(처리 중엔 안 닫힘) |
| 트레이너 신청 취소 확인 `TrainerApplication` | AppDialog sm alertdialog | Esc·계속 대기·바깥(처리 중엔 안 닫힘) |

## MeetingLinkDialog — 일정·계약 진입을 닫을 수 없게 둔 이유
`useManualLinkPrompt` 는 미팅을 「계약」으로 **저장한 뒤** 같은 이름의 「영업기록 없이 추가」 업체가 있으면 이 창을 띄운다. 「따로 등록」 = 새 계약수납 행, 「연결하기」 = 기존 행에 연결. 둘 다 안 하고 닫으면 그 계약이 장부에 한 줄도 없어 매출이 빠진다(contract-fanout 이 막으려던 사고). 그래서 이 진입에서는 Esc·바깥 누르기를 받지 않고 저장 없는 닫기 버튼도 두지 않는다. 실무/수납 진입(MeetingLinkPicker → Dialog)은 아무것도 저장되지 않은 상태라 「취소」·Esc 로 닫는다.

## 옮기지 않은 창 (이유)
- `MeetingSafetyDialog`·`TrainerAccessEditor` 확인 — 이미 네이티브 `<dialog>.showModal()`(Esc·뒤 inert). 그대로.
- `app/claim` — 팝업이 없다(배경 장식 층만).
- `IdentityGuard`·`WebviewWarning` — 일부러 닫히지 않는 차단 안내.
- `TodayActivity`·SheetDialog 계열·`SaveConfirmModal` — 1차 이유 그대로.

## 위험·한계
- 최상단 층 위로는 `usePortalTarget` 를 쓰지 않는 body 포털·fixed 층이 못 올라온다. DB정보 안에서 쓰는 포털은 위 부품으로 모두 옮겼다. 새소식 팝업(NoticePopup)·LoadingOverlay 는 열린 모달 뒤에 보인다(1차와 같음).
- 통화 알림이 DB정보보다 먼저 떠 있었으면 DB정보 뒤에 깔린다 — 새 알림 글이 오면 다시 맨 위로(`key`).
- 바깥 누르기 규칙 적용으로 바뀐 동작: 오류신고·비용 원장은 바깥 누르기로 더 이상 닫히지 않는다(입력 창). 배지 보기 서랍 기준이 768/2xl → 1024px(AppDialog 공통).
- 실제 화면(모바일 서랍·PC 가운데·DB정보 안 팝업 겹침) 확인은 NOT_RUN — 로그인 필요. jsdom 시험·tsc·eslint 로 확인.

## 범위 밖
- 버튼 누름 크기·네이티브 날짜 칸(다른 작업), docs/design/preview.html(모양 변화 없음).

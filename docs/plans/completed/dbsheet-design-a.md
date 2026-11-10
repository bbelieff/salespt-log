> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트와 비슷하게 손으로 쓴 CSS 16개 파일을 「모양은 그대로, 만드는 법만 정리」(디자인 A안) — #색 → 공용 색 변수, px 글자 → 글자 크게·좁은 화면 축소가 먹는 글자, 대비 부족 글자·버튼 한 단계 진하게, 표 열 너비 손잡이 터치 화면 표시.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 아래 파일 목록, `app/globals.css` 「앱 공용 색·글자 변수」
> - **관련 문서**: [tokens §CSS 색·글자 변수](../../design/tokens.md)

# DB관리시트 디자인 A안 — CSS 정리 (2026-11-10)

## 목표 (belie 승인 A안)
1. 대상 CSS 16개(DB관리시트 9 + 오늘 챙길 일·사서함·오류 신고·알림·교육일지 7)의 #색 ~1,200곳을 `globals.css` 의 `--ui-*` 변수로. 화면 색은 그대로.
2. px 글자 ~490곳을 앱의 글자 배율 방식(`calc(N × var(--app-px) × var(--font-scale))`)으로 — 「글자 크게」·좁은 화면 축소가 먹게. 어중간한 크기(9·10.5·11.5·17·19·21·26px, .7·.8·.625rem)는 가까운 단계로. 폰·태블릿(<1024px) 글자 하한 12px(`--ui-fs-floor`), PC 는 기존 px 그대로.
3. 대비: 흰 바탕 보조 글자 slate-400(#94a3b8, 2.6:1) 33곳 → slate-500(#64748b, 4.8:1). 흰 글자 파란 버튼 blue-500 → blue-600(누름 blue-600 → blue-700). 오늘 활동 초록 버튼 emerald-600 → emerald-700.
4. 표 열 너비 손잡이 — `@media (hover:none)` 에서 늘 보이게(가는 파란 세로줄).

## 대상 파일
- `app/(app)/db-sheet/{absence-link,bulk,call,compact,db-sheet,feed,recording}.css`, `app/(app)/db-sheet/_components/{db-detail-compact,adaptive-import}.css`
- `components/inbox/inbox.css`, `components/dashboard/{dashboard-follow-ups,followups-launcher,followups-table}.css`, `components/training-log/training-log.css`, `components/bug-report/bug-report.css`, `components/push/push.css`
- `app/globals.css`(변수 정의), `app/(app)/db-sheet/_components/TodayActivity.tsx`(버튼 클래스 2곳), `docs/design/tokens.md`, 새 시험 `tests/structural/css-color-vars.test.ts`

## 수용 조건
- 대상 파일 주석 밖 #색 0, 글자 크기 전부 `--font-scale`(px 는 `--app-px`, 12px 미만은 `--ui-fs-floor`) — 시험 ①②.
- 쓰는 변수 모두 정의 — 시험 ③. 글자색 slate-400 은 비활성·끌기 중만 — 시험 ④. 손잡이 터치 표시 — 시험 ⑤.
- 대비 3건 외 색 변화 없음(변수 값 = 기존 hex, 알파 hex 는 `color-mix(… N%, transparent)` 같은 값).

## 남은 위험
- 폰 글자 하한 12px 로 10·11px 글자(배지·칩·표 보조) ~150곳이 폰·태블릿에서 커진다 — 좁은 칩 줄바꿈 가능성, 실제 화면 확인 필요.
- `tests/browser/db-sheet-status-view-chips/server.mjs` 는 db-sheet.css 만 따로 읽어 변수가 없다(색 빠짐) — 검증용 목업 한정.

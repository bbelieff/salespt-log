# 2026-11-10 18:03 refactor/dbsheet-design-a

- 목표: 디자인 A안(belie 승인) — DB관리시트 등 손으로 쓴 CSS 16개를 모양은 그대로 두고 색 변수·글자 배율로 정리, 대비 3건·열 손잡이 터치 표시.
- 담당 파일: `app/(app)/db-sheet/*.css`·`_components/{db-detail-compact,adaptive-import}.css`, `components/{inbox,dashboard,training-log,bug-report,push}/*.css` 중 7개, `app/globals.css`(변수 블록), `TodayActivity.tsx`(버튼 색 클래스 2곳), `docs/design/tokens.md`, `tests/structural/css-color-vars.test.ts`.
- 변경: #색 ~1,200 → `--ui-*` 변수, px 글자 ~490 → `calc(N × --app-px × --font-scale)`(12px 미만은 폰 하한 `--ui-fs-floor` 12), 보조 글자 slate-400→500 33곳, 흰 글자 파란 버튼 blue-500→600, 오늘 활동 초록 버튼 emerald-600→700, `@media(hover:none)` 열 너비 손잡이 표시.
- 검증: tsc, vitest(새 시험 35건 + tests/components·tests/structural). check.sh·빌드·실제 화면은 총괄이 직렬로(NOT_RUN 여기서는).
- 계획: [dbsheet-design-a](../plans/completed/dbsheet-design-a.md)
- 위험/복구: 화면 CSS 만, revert 1건. 폰 10·11px 글자가 12px 로 커지는 곳 화면 확인 필요.

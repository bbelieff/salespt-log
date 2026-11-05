## 2026-11-05 · 통화 정리 PR-11 — 갤럭시 녹음 안내
- fix/call-android-hint(master 위). belie 「갤럭시 환경에서 테스트」 요청 → 시험 화면(안드로이드 Chrome·384px)으로 흐름 점검.
- 발견: 갤럭시에서 익시오·에이닷 사용자에게도 「내 파일 › Recordings › Call」(기본 전화 앱 녹음 자리)을 안내 → 앱에서 저장하라고 바꾸고 받아쓴 글 붙여 넣기도 보임.
- 담당 파일: `app/(app)/db-sheet/_components/CallUploadDialog.tsx`, `tests/components/db-sheet-call-front.test.ts`, 시험 화면 장면 `upload-ixio`, [plan](../plans/active/call-summary.md).
- 미확인: 실제 갤럭시 기기(adb·에뮬레이터 없음), 익시오 안드로이드 앱의 저장 메뉴 이름.
- 되돌리기 = squash revert.

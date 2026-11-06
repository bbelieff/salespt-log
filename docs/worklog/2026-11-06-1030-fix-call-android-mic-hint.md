## 2026-11-06 · 통화 정리 PR-13 — 녹음 허용 질문 안내
- fix/call-android-mic-hint(master 위). 실기기(갤럭시 A27) 점검에서 파일 고르기 때 Chrome 이 「오디오 녹음 허용?」을 묻는 것 확인 → belie 「안내 넣어줘, 가볍게 짧게」.
- 변경: 안드로이드 녹음 올리기 첫 화면에 회색 한 줄. 아이폰은 그대로. 384px 시험 화면에서 한 줄 확인.
- 담당 파일: `app/(app)/db-sheet/_components/CallUploadDialog.tsx`, `tests/components/db-sheet-call-front.test.ts`, [plan](../plans/active/call-summary.md).
- 되돌리기 = squash revert.

# 2026-11-10 13:30 fix/notice-popup-backdrop-no-seen

- 목표: UI 점검 보고서 1-4 — 새소식 배경 탭 = 읽음 처리(belie 「진행」).
- 담당 파일: `components/announcements/NoticePopup.tsx`, `AnnouncementsGate.tsx`, 시험 1, components.md.
- 검증: vitest 13건(새 4 + 기존), tsc. 실제 화면 NOT_RUN.
- 계획: [notice-popup-backdrop-no-seen](../plans/completed/notice-popup-backdrop-no-seen.md)
- 위험/복구: 화면만, revert 1건.

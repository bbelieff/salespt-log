# 2026-11-10 14:30 fix/ux-batch1-data-safety

- 목표: UI/UX 점검 1차(데이터 안전) — 계획 docs/plans/completed/ux-batch1-data-safety.md
- 담당 파일: components/auth/IdentityGuard.tsx · components/announcements/NoticePopup.tsx · components/auth/LoginScene.tsx · app/page.tsx · app/login/page.tsx(신규) · lib/util/login-return.ts · app/(app)/contact/page.tsx · app/(app)/contact/_components/MeetingSlotItem.tsx · app/(app)/db-sheet/_components/{ImportDialog,CallConfirmScreen}.tsx · app/(app)/payment/_components/TerminationModal.tsx · app/(app)/calendar/_components/GeneralEventModal.tsx · docs/design/{tokens,components}.md
- 변경: 차단막 z-[600] · 새 미팅 카드 삭제 확인 · 새소식 배경 닫기 제거 · /login 별칭 + 오류 안내 · 4개 창 유실 방지
- 검증: 새 회귀 시험 14건 + identity-guard 10건 통과, check.sh(커밋 훅)·production build 결과는 PR 에 기록
- 미완료: 실제 화면 캡처(브라우저 창 접근 여부에 따라), 2~4차 묶음
- 위험/복구: UI 동작만 바뀌고 데이터·API 계약 변경 없음 — 문제 시 PR revert

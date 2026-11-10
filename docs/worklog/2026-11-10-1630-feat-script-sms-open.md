# 2026-11-10 16:30 feat/script-sms-open

- 목표: 대본 문자 양식을 폰 문자 앱으로 채워 열기 — 계획 docs/plans/completed/script-sms-open.md
- 담당 파일: lib/util/sms-link.ts(신규) · components/company-info/ContactScriptPanel.tsx · app/(app)/db-sheet/_components/{CallScriptSheet,CallUi}.tsx · docs/design/components.md · tests/util/sms-link.test.ts(신규)
- 변경: 문자 양식 칸 「문자 앱」 버튼(sms:) · DB 대본 창은 번호까지 채움
- 검증: 새 시험 5건, tsc·eslint 통과, check.sh(커밋 훅)·production build 결과는 PR 에 기록
- 미완료: 실제 폰(삼성 메시지·아이폰)에서 열리는지 사용자 확인
- 위험/복구: 화면 버튼 하나 추가, 데이터·API 변경 없음 — 문제 시 PR revert

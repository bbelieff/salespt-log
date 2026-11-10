# 2026-11-10 14:30 fix/ux-batch1-data-safety (→ /login 별칭만)

- 목표: /login 404 해소 — 계획 docs/plans/completed/login-alias.md
- 담당 파일: app/login/page.tsx(신규) · lib/util/login-return.ts · app/page.tsx · components/auth/LoginScene.tsx · tests/components/login-alias.test.ts(신규)
- 변경: /login → / 별칭(경로 재검증) + 로그인 오류 한 줄 안내. 1차 묶음의 나머지는 #1375·#1376·#1379·#1380 과 겹쳐 master 쪽을 그대로 두었다(merge 충돌 해소).
- 검증: 새 시험 6건, check.sh(커밋 훅)
- 위험/복구: 새 경로 하나와 로그인 안내 한 줄 — 문제 시 PR revert

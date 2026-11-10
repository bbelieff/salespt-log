# 2026-11-10 23:30 feat/import-spotlight — DB 추가 확인 화면 스포트라이트

- 목표: belie 「키노트하듯 음영」 시안 승인 → 운영 반영.
- 담당 파일: app/(app)/db-sheet/_components/ImportDialog.tsx, adaptive-import.css, app/globals.css(--ui-scrim), tests/components/db-sheet-import-spotlight.test.ts, docs/design/components.md·tokens.md, plan.
- 검증: tsc, import 관련 시험 49파일 552건 + 새 시험 2건, check.sh(커밋 훅). 실제 화면: 실제 ImportDialog 를 esbuild 로 묶어 헤드리스 크롬 1280px·375px 캡처(합성 데이터, Tailwind 기본값 없이 — 파일 칸 모양은 운영과 다름). 운영 로그인 화면 확인은 배포 뒤.
- 위험/복구: 화면 표시만 변경(저장·검증 규칙 동일, 같은 열 적용은 기존 resolveImportQuestion 재사용). 문제 시 revert.

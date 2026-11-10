# 2026-11-10 22:00 feat/design-v2-surfaces

- 목표: 화면 마감 v2(밝은 그라데이션·입체감·상자 줄이기) — 계획 docs/plans/completed/design-v2-surfaces.md
- 담당 파일: app/surfaces.css(신규)·app/layout.tsx · app/(app)/dashboard/**·components/dashboard/** · app/(app)/db/** · app/(app)/schedule/** · docs/design/tokens.md
- 변경: 맨 위 요약 한 칸 히어로, 구역 상자 → 제목+구분선, 주 버튼 입체 마감
- 검증: check.sh(커밋 훅)·CI build, 배포 후 화면 확인
- 위험/복구: class·구조만(데이터·로직 없음). 문제 시 PR revert

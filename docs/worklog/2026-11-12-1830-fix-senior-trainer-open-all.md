# 2026-11-12 18:30 fix/senior-trainer-open-all

- 목표: 수석 트레이너 모든 수강생 [웹앱]·[주간목표] — 계획 docs/plans/completed/senior-trainer-open-all.md
- 담당 파일: lib/service/trainer-student-access.ts · app/trainer/page.tsx · components/auth/{TrainerCohortView.tsx,trainer-open.ts} · docs/design/components.md · tests/components/senior-trainer-open-all.test.ts
- 검증: 관련 시험 21건, check.sh(커밋 훅)·CI build
- 위험/복구: 버튼 표시만(서버 권한 그대로). 문제 시 PR revert

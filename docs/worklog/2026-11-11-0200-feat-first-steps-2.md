# 2026-11-11 02:00 feat/first-steps-2 — 첫걸음 2차

- 목표: belie 「2차도 진행해줘」 + 시안 댓글 「잡다한 설명 생략」.
- 담당 파일: components/onboarding/*, lib/util/first-steps.ts, lib/types/first-steps.ts(+index), lib/repo/db/first-steps.ts, lib/repo/db/migrations/0021_first_steps.sql, lib/service/first-steps.ts(+index), app/api/first-steps, app/api/admin/first-steps, lib/query/first-steps-hooks.ts, components/auth/TraineeCard.tsx, lib/analytics/index.ts(EVENTS 3), 화면 연결(db·contact·schedule·payment page, DbChannelWorkspace·MeetingResultCard·ContractRow data-first-steps), ImportDialog 문구, 시험 3, 문서(components·data-model·plan).
- 검증: tsc·eslint, 관련 시험 166건(pglite 포함), check.sh(커밋 훅). 새 안내 4종의 실제 화면 확인은 배포 뒤(선택자는 코드에서 확인).
- 미완료: 0021 운영 적용(승인 필요). 적용 전 기억은 브라우저별, 관리 화면 배지는 비어 있음.
- 위험/복구: 표시·API 추가, 마이그레이션은 additive. 문제 시 revert(표는 남아도 무해).

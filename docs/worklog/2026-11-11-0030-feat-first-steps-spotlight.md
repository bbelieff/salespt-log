# 2026-11-11 00:30 feat/first-steps-spotlight — 첫걸음 1차

- 목표: belie 「추천대로 1차 진행해줘」(첫걸음 스포트라이트 기획안).
- 담당 파일: lib/util/first-steps.ts, components/onboarding/{Spotlight,FirstStepTourOffer,FirstStepsCard,useFirstSteps}, app/(app)/dashboard/page.tsx, app/(app)/db-sheet/page.tsx, app/(app)/contact/page.tsx, app/(app)/contact/_components/MeetingSlotList.tsx(data-first-steps), 시험 2, components.md, plan.
- 검증: tsc·eslint, 새 시험 11건, components·structural 시험 1766건, check.sh(커밋 훅). 실제 화면: 카드·스포트라이트를 esbuild+Tailwind 로 묶어 헤드리스 크롬 1280px·375px 캡처(합성 숫자). 운영 로그인 화면 확인은 배포 뒤.
- 미완료: docs/design/preview.html 에 새 부품 미등재(기존 미리보기에 해당 절 없음), 2차 범위(plan 참고).
- 위험/복구: 표시만 추가, 저장은 브라우저 localStorage(계정별 키). 문제 시 revert.

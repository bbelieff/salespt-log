# 2026-11-12 11:00 fix/first-steps-skip-existing — 이미 DB 가 있는 수강생은 첫걸음 없음

- 목표: belie 「이미 디비입력이 있는 수강생은 첫걸음 필요 없음」.
- 규칙: 대시보드 첫 방문 때 한 번 판정 — 그 순간 생산·유입이 있으면 카드·안내 제안 모두 숨김. 0건에서 시작한 새 수강생은 첫 DB 를 넣은 뒤에도 계속 안내(그렇지 않으면 첫 DB 를 넣자마자 나머지 단계 안내가 사라짐). 이미 안내를 쓰기 시작한 흔적이 있으면 숨기지 않음. 안내 제안 줄은 대시보드에서 시작된 뒤에만.
- 담당 파일: lib/util/first-steps.ts(hasDbInput·startFirstSteps·started), lib/types/first-steps.ts(started), lib/service/first-steps.ts, components/onboarding/{FirstStepsCard,useFirstSteps}.ts(x)(같은 순간 두 번 고쳐도 덮지 않게 최신값 ref), 시험 2, 문서.
- 검증: tsc·eslint, 관련 시험 19건, check.sh(커밋 훅). 운영 화면 확인은 배포 뒤.
- 위험/복구: 표시 규칙만. revert 하면 이전처럼 모든 수강생에게 카드.

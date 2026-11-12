# 2026-11-12 12:00 fix/first-steps-veterans — 운영 확인에서 나온 첫걸음 결함 3가지

- 계기: belie 「운영 화면 직접 확인」 → 관리 화면에 계약 19건 수강생 「첫걸음 6/7」, 미팅 예정 7건 수강생 「0/7」. first_steps 6줄(이메일 제외) 확인.
- 원인·수정
  1. 베테랑이 안 숨겨짐: 카드가 끝낸 단계를 「끝낸 안내」로 자동 기록 → #1419 의 「쓰기 시작한 흔적」 예외에 모두 걸림. 예외 제거 — 첫 판정 때 DB 입력이 있으면 숨김.
  2. done 비어 있음(6줄 중 2줄): reportDone 이 서버 기억을 받기 전에 한 번 돌고 끝남. 카드 effect 가 serverReady 뒤에 다시 돈다.
  3. 숨긴 수강생 배지: /api/admin/first-steps 에서 memory.hidden 줄 제외.
- 담당 파일: lib/util/first-steps.ts, components/onboarding/{useFirstSteps.ts,FirstStepsCard.tsx}, lib/repo/db/first-steps.ts, lib/service/first-steps.ts, 시험 2, components.md.
- 검증: tsc·eslint, 관련 시험 16건, check.sh(커밋 훅). 배포 뒤 관리 화면 재확인.
- 기존 6줄은 started 가 비어 있어 다음 대시보드 방문 때 판정된다(DB 가 있으면 숨김 → 배지도 사라짐).

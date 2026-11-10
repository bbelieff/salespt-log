# 2026-11-10 19:50 fix/android-launch-splash

- 목표: 안드로이드 앱 아이콘 실행 시 로딩 화면 두 개 → 하나로 이어 보이게 — 계획 docs/plans/completed/android-launch-splash.md
- 담당 파일: app/manifest.ts · public/icons/app-{192,512,maskable-512}.png(신규) · components/ui/LoadingOverlay.tsx · components/ui/LoadingProvider.tsx · tests/components/android-launch-splash.test.ts(신규)
- 변경: manifest 아이콘 등록(빨간 $) · 첫 로딩만 흰 바탕 로딩 창
- 검증: 새 시험 2건, check.sh(커밋 훅)·production build 결과는 PR 에 기록
- 미완료: 실제 안드로이드 기기 확인(사용자). 이미 설치한 앱은 크롬이 manifest 를 다시 읽을 때(보통 며칠 내) 시작 화면이 바뀐다.
- 위험/복구: 화면·아이콘만, 데이터·API 변경 없음 — 문제 시 PR revert

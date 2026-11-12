# 수석 트레이너 — 모든 수강생 웹앱 버튼

- 목표(2026-11-12 belie): 「수석트레이너는 모든 웹앱에 접속 가능」. 서버 정책(`defaultTrainerGrants`: senior = 활성·아레나·보관 read/write)은 이미 그랬지만 트레이너 화면 버튼은 「활성 수강생 조회」 하나만 보고 활성 기수에만 붙어, 수석도 아레나·보관 기수 카드엔 [웹앱]이 없었다.
- 변경: `trainerReadGrants`(등급 기본값 ∩ 권한부여 설정, 세 범주) → `/trainer` 가 `openArena`·`openArchived` 까지 전달 → `trainerCanOpen` 이 서버 `classifyTrainerStudent` 와 같은 순서로 판단. 서버 권한 규칙 변경 없음(열기는 여전히 `canImpersonate` 가 매번 확인).
- 수용: tests/components/senior-trainer-open-all.test.ts(수석 세 범주·일반/견습 활성만·테스트/본인 페이지 제외·페이지 전달), check.sh·build.

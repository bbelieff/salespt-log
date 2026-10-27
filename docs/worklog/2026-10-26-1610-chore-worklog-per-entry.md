## 2026-10-26 · 작업 기록을 항목마다 파일 하나로 (충돌 없애기)
- chore/worklog-per-entry. belie 「작업기록 충돌도 해결해줘」. 원인: 모든 PR이 `docs/worklog.md` 맨 위에 끼워 넣어 오늘만 6번 충돌 → 매번 커밋 검사 6~10분 재실행.
- 변경: 새 기록 = `docs/worklog/YYYY-MM-DD-HHMM-<slug>.md`(규칙 [README](README.md)), `docs/worklog.md` 는 고정 보관본(pre-commit 이 직접 수정 차단, 병합 커밋은 통과), `.gitattributes` 에 `docs/worklog.md merge=union`(옛 규칙 세션 대비). CLAUDE.md·AGENTS.md·workflow·worker-onboarding 안내 갱신.
- 밀린 기록: #1265 오류신고 API 본문 3.5MB 상한(병합 f641eb09 · Deploy 40281233787 success · health 200, 운영 413 직접 확인은 로그인 필요라 NOT_RUN).

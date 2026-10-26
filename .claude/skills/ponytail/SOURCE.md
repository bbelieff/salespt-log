> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 프로젝트 스킬 `ponytail`(가장 작은 완전한 변경 원칙)을 어디서 어떻게 가져왔는지 기록.
> - **누가 읽나요**: 개발자·에이전트 세션(Claude·Codex)
> - **어떤 기능·작업과 연결?**: `.claude/skills/ponytail*/SKILL.md`, `AGENTS.md`, `CLAUDE.md` §2.5
> - **읽고 나면 알 수 있는 것**: 출처·버전·라이선스 · 넣지 않은 것 · 이 프로젝트에서의 우선순위
> - **관련 문서**: [CLAUDE.md](../../../CLAUDE.md) · [AGENTS.md](../../../AGENTS.md)

# ponytail 출처 (2026-10-26 belie 「pony-tail 스킬 설치, 이 프로젝트 세션들이 참고」)

- 원본: https://github.com/DietrichGebert/ponytail (MIT, 저작권 고지 = 같은 폴더 `LICENSE`), 플러그인 v5.3.2, 커밋 09c434a.
- 가져온 것: `skills/` 의 SKILL.md 6개를 **글자 그대로** 복사 — `ponytail`(기본·lite/full/ultra) · `ponytail-review`(변경 검토) · `ponytail-audit`(코드베이스 점검) · `ponytail-debt`(`shortcut:` 주석 모음) · `ponytail-gain`(벤치마크 숫자) · `ponytail-help`.
- 넣지 않은 것: 플러그인 훅(`hooks/` — 매 턴 지시 주입·작업 비용 CSV 기록·선택 웹훅)과 `band` 보드. 매 턴 토큰이 늘고 기록이 PC 밖으로 나갈 수 있어서다. 그래서 `ponytail-help` 의 `/ponytail band`·설정 파일 안내는 여기서는 동작하지 않는다.
- 설치 방식: `/plugin install`·npx 를 쓰지 않고 원본을 읽은 뒤 복사(스크립트 실행 없음).
- 쓰는 법: Claude Code 는 이 레포에서 자동으로 스킬을 찾는다(`/ponytail`, `/ponytail-review` 등). Codex 등 다른 에이전트는 `AGENTS.md` 안내대로 이 SKILL.md 를 읽는다.
- **우선순위**: `CLAUDE.md`·`AGENTS.md`·SSOT·구조 테스트·Hashimoto 가드가 이 스킬보다 우선이다. 특히 계획 문서·SSOT 등재·worklog·check.sh 는 「안 써도 되는 코드」가 아니라 이 프로젝트의 필수 범위다.
- 갱신: 원본을 다시 받아 SKILL.md 6개를 덮어쓰고 이 문서의 버전·커밋을 고친다.

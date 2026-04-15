# Dev Harness — Claude 코딩 에이전트용 하네스

> OpenAI의 **Harness Engineering** 방법론(Codex 운영 방식)을 Claude Code 환경에 맞춰 옮긴 개발 시스템 문서.
> 이 파일은 **지도(map)** 이다. 백과사전이 아니다. 상세 규칙은 `docs/`의 원천으로 연결된다.
> 길이 목표: ~100줄. 이 이상 커지면 `docs/`로 분리한다.

---

## 0. 철학 (Why Harness)

에이전트의 생산성은 모델 지능이 아니라 **환경·제약·피드백 루프**에서 나온다.
- 사람의 주된 일 = 코드 작성이 아니라 **환경 설계 · 의도 명세 · 피드백 루프 구축**.
- 에이전트의 주된 일 = 그 하네스 안에서 **PR 단위로 일을 완주**.
- 모든 규칙은 **기계 검증 가능**해야 한다. "문서로만 존재하는 규칙"은 규칙이 아니다.

하네스는 4가지 요소로 구성된다 (**Tools · Guardrails · Feedback · Observability**):
- **Tools** — 에이전트가 쓸 수 있는 것 (MCP, CLI, 스크립트). 적을수록 좋다. 모호한 도구 = 모호한 행동.
- **Guardrails (feedforward)** — 사전 유도: CLAUDE.md, 린터, 타입, 스키마, 권한 모드. 잘못된 행동을 **물리적으로 불가능**하게.
- **Feedback (sensors)** — 사후 자기교정: 테스트, 구조 테스트, 리뷰 에이전트, CI, 에러 메시지(remediation 포함).
- **Observability** — 사람이 에이전트의 행동을 **볼 수 있어야** 한다. 로그, diff, PR 타임라인, 실패한 명령 기록. 못 보는 것은 못 고친다.

### 🔑 Hashimoto 원칙 (핵심 루프)
> **"에이전트가 실수를 할 때마다, 같은 실수를 다시는 못 하도록 환경을 고쳐라."**

- 실수 → 사람의 반사적 반응은 "더 자세한 프롬프트"가 아니라 **"하네스 개선"**.
- 같은 지적을 두 번 하게 되면 그것은 **skill issue가 아니라 harness issue**다. 린터 규칙·구조 테스트·문서·훅 중 하나로 박아둔다.
- 이 루프가 복리로 작동한다: 하네스가 자라면 에이전트의 유효 능력도 자란다.

---

## 1. 레포 구조 (System of Record)

```
.
├── CLAUDE.md              # 이 파일. 지도.
├── AGENTS.md              # (선택) Codex 호환 포인터. CLAUDE.md와 동일 소스 참조.
├── docs/                  # ★ 지식의 원천. 모든 심화 규칙은 여기.
│   ├── architecture.md    #   도메인·레이어 맵
│   ├── domains/           #   도메인별 설계문서 (검증상태 포함)
│   ├── quality.md         #   도메인·레이어별 품질 등급표
│   ├── playbooks/         #   반복 작업 런북 (마이그레이션, 리팩터 등)
│   └── decisions/         #   ADR — 왜 그렇게 했는가
├── src/                   # 코드. 아래 레이어 규칙 준수.
├── tests/
│   ├── unit/              #   단위
│   ├── integration/       #   실제 DB/외부 I/O
│   └── structural/        # ★ 레이어·의존성 구조 테스트 (하네스 핵심)
└── scripts/
    ├── check.sh           # 에이전트가 PR 전 반드시 돌리는 단일 진입점
    └── agent-review.sh    # 자기 리뷰 루프 트리거
```

**원칙**: Claude가 파일을 찾아 헤매야 하면 하네스 실패다. `docs/`의 인덱스는 항상 최신이어야 한다.

---

## 2. 아키텍처 제약 (구조 테스트로 강제)

의존성은 **단방향**으로만 흐른다:

```
Types → Config → Repo → Service → Runtime → UI
```

- 상위 레이어는 하위 레이어를 import 할 수 없다.
- 이 규칙은 **주석이 아니라 `tests/structural/`의 실행되는 테스트**로 강제한다.
- 위반 시 린터/테스트 에러 메시지는 **"어떻게 고쳐야 하는지"까지 포함**한다 (remediation-as-error).

예: `❌ src/ui/foo.ts가 src/repo/db.ts를 직접 import. → Service 레이어를 거쳐 호출하세요. 참고: docs/architecture.md#ui-boundary`

---

## 3. 에이전트 작업 규약 (Task Contract)

모든 작업은 다음 루프를 따른다:

1. **Intent 확인** — 작업 스펙·수용 기준을 먼저 읽는다.
2. **맥락 수집 (점진적 공개)** — 이 문서는 목차다. 한 번에 모든 정보를 소화하려 하지 말고, 관련 `docs/` 페이지를 필요 시점에 찾아 점진적으로 탐색한다.
3. **계획 상태 관리** — `docs/plans/active/`에 TodoWrite로 계획을 명시한다. 해당 작업이 완료되면 반드시 `docs/plans/completed/`로 문서를 이동시켜 상태를 동기화한다.
4. **격리된 작업 환경 (Git Worktree)** — 절대 로컬 메인 환경에서 직접 코드를 수정하지 않는다. 반드시 새 워크트리(Git Worktree)를 생성하여 그 안에서 독립적으로 구현한다.
5. **자기 검증 & 가시성 확보** — 아래 §4 체크리스트를 실행한다. UI/버그 테스트 시 텍스트 로그뿐만 아니라 DOM 스냅샷, 스크린샷을 남겨 에이전트 스스로 시각적 피드백 루프를 수행한다.
6. **자동 커밋 및 PR 작성** — 검증 통과 시 정해진 규칙에 따라 에이전트가 직접 커밋 및 워크트리 머지를 수행한다. (인간의 개입 최소화)

---

## 4. PR 전 체크리스트 및 강력한 제동(Hook) 시스템

에이전트는 커밋 또는 PR을 열기 전 다음 과정과 훅(Husky 등)을 반드시 통과해야 한다. 시스템 레벨에서 물리적으로 차단되면(에러 발생 시) 강제로 우회하지 말고, 로그를 분석해 자신을 교정한다.

- [ ] **Pre-commit Hook 통과 여부:** 계획(Plan) 문서 없이 작성된 코드, 메인 브랜치 직접 수정 시도는 Husky 훅에 의해 자동 차단된다.
- [ ] 타입체크 & 린트 (remediation 메시지 포함 커스텀 규칙)
- [ ] **구조 테스트 & 파일 크기 제한** (`tests/structural/`) — 레이어 위반 및 허용 파일 용량 감지
- [ ] 단위 테스트 / 통합 테스트 (변경된 도메인 한정)
- [ ] 문서 드리프트 검사 — `docs/`에서 언급한 파일/심볼이 실제 존재하는지

**하나라도 빨갛게 뜨면 PR 금지.** 스크립트나 훅을 우회하지 않는다. 스크립트가 잘못되었다면 스크립트를 고친다.
---

## 5. 문서화 규칙 (Docs as System of Record)

- 설계 문서는 `docs/domains/<domain>.md`에 두고 상단에 `status: draft | verified | stale` 프론트매터.
- 코드를 바꾸면 관련 문서의 `status`를 필요 시 강등(`stale`)하고 동일 PR에서 업데이트한다.
- `docs/quality.md`는 도메인×레이어 매트릭스로 등급(A~D)과 갭(gaps)을 추적. 에이전트는 D 등급 영역 진입 시 더 보수적으로 움직인다.
- ADR(`docs/decisions/NNNN-*.md`)은 **불변**. 결정이 뒤집히면 새 ADR로 supersede.

---

## 5.5 Observability — 에이전트 행동 관찰

- 모든 에이전트 명령은 **재현 가능한 로그**를 남긴다 (`logs/agent/<date>/`).
- PR은 **작고 원자적**이어야 한다 — 사람이 한 번에 머리에 담을 수 없으면 쪼갠다.
- 실패한 명령·되돌린 커밋은 삭제하지 말고 **`docs/decisions/` 또는 인시던트 노트**에 남긴다. 그래야 하네스를 고칠 수 있다.
- "왜 실패했는가"를 **사후 분석**해서 §0의 Hashimoto 루프로 돌려보낸다. 실패는 하네스 패치의 입력.

---

## 6. 금지 사항

- `raw/`, 외부 vault, 사용자 데이터 디렉토리 수정.
- 테스트를 "통과시키기 위해" 수정·삭제.
- 구조 테스트·린터·훅 우회 (`--no-verify`, skip, xfail 남용).
- 컨텍스트 창에서만 존재하는 규칙 따르기 — 모든 규칙은 이 파일이나 `docs/`에 있어야 한다.
- 요청되지 않은 리팩터·추상화·"미래 대비" 코드.

---

## 7. 이 하네스 자체의 관리

이 파일과 `docs/`도 **하네스의 일부**다.
- 같은 실수를 사용자가 두 번 지적했다면 → 규칙을 이 파일이나 `docs/`에 기계검증 가능한 형태로 추가.
- 규칙이 100줄을 넘기 시작하면 → `docs/`로 분리하고 여기엔 포인터만 남긴다.
- 월 1회 `lint` 통과: 고아 문서, 죽은 링크, 인덱스 드리프트, `status: stale`가 오래된 문서 점검.

---

## 참고

- [Harness engineering — OpenAI](https://openai.com/index/harness-engineering/)
- [Unlocking the Codex harness — OpenAI](https://openai.com/index/unlocking-the-codex-harness/)
- [Harness engineering for coding agent users — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
- [Skill Issue: Harness Engineering for Coding Agents — HumanLayer](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [The Missing Layer Behind AI Agents — Louis Bouchard](https://www.louisbouchard.ai/harness-engineering/)
- [The Emerging Harness Engineering Playbook — ignorance.ai](https://www.ignorance.ai/p/the-emerging-harness-engineering)

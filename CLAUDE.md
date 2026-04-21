# 세일즈PT 영업일지 — Claude 개발 하네스

> **프로젝트**: 세일즈피티 수강생을 위한 반응형 웹앱. 4대 지표(생산/컨택/미팅/계약) 기록 + 게이미피케이션 + 대시보드. Google Sheets 가 유일한 DB, Next.js 풀스택.
> **스택**: Next.js 15 (App Router) · TypeScript · Tailwind · NextAuth(Google) · googleapis · Recharts · Vitest
> **배포**: 자체 도메인 + 자체 VPS (Caddy + Docker). 스토어 배포 X, PWA 지원.
>
> 이 파일은 **지도(map)** 이다. 백과사전이 아니다. 상세 규칙은 `docs/`의 원천으로 연결된다.
> 길이 목표: ~150줄. 이 이상 커지면 `docs/`로 분리한다.

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
├── CLAUDE.md                 # 이 파일. 지도.
├── docs/                     # ★ 지식의 원천.
│   ├── architecture.md       #   레이어·Sheets 경계
│   ├── domains/              #   기능 단위 설계문서 (status 프론트매터)
│   ├── quality.md            #   도메인×레이어 품질 매트릭스
│   ├── playbooks/            #   start-task / setup-sheets / fix-harness / deploy-vps
│   ├── decisions/            #   ADR — 불변
│   └── plans/                #   active / completed — 작업 계획
├── lib/                      # ★ 비즈니스 로직 (레이어 규칙 강제)
│   ├── types/                #   Zod 모델. 다른 레이어 import 금지.
│   ├── config/               #   env · 시트 A1 범위.
│   ├── repo/                 #   googleapis 전용 구역. Sheets I/O.
│   └── service/              #   유스케이스 (게이미피케이션 포함).
├── app/                      # Next.js App Router (UI + Runtime)
│   ├── api/                  #   Route Handlers — Service 만 호출.
│   ├── (app)/                #   로그인 후 화면
│   └── (auth)/               #   로그인 / 온보딩
├── components/               # UI 프리미티브·블록 (Repo 직접 import 금지)
├── tests/
│   └── structural/           # ★ Vitest — 레이어·Sheets 격리 테스트
├── scripts/check.sh          # 단일 진입점. pre-commit 에서 호출.
└── .githooks/pre-commit      # 메인 직접커밋·plan 없는 커밋 차단
```

**원칙**: Claude가 파일을 찾아 헤매야 하면 하네스 실패다. `docs/` 인덱스는 항상 최신.

---

## 2. 아키텍처 제약 (구조 테스트로 강제)

의존성은 **단방향**으로만 흐른다:

```
types → config → repo → service → app(api·ui) → components
```

핵심 규칙 (`tests/structural/layers.test.ts` 가 강제):

1. **상위 레이어 import 금지** — 하위는 상위를 참조할 수 없음.
2. **Sheets 격리** — `googleapis` / `google-auth-library` 는 **오직 `lib/repo/` 에서만** import.
3. **대시보드 탭 쓰기 금지** — `SHEET_RANGES.dashboard` 를 `appendRows` / `batchUpdate` 근처에서 쓰면 실패. 대시보드는 수식이 계산한다. 쓰기는 `daily` / `contracts` / `db` 섹션으로만.
4. **경로별칭 고정**: `@/types` · `@/config` · `@/repo/*` · `@/service`. 상대경로 import 는 피한다.

예: `❌ components/Chart.tsx 가 googleapis 를 import. → lib/repo/ 에 메서드를 추가해 Service 경유로 호출하세요. 참고: docs/architecture.md#퍼시스턴스-google-sheets`

## 2.5 프로젝트 도메인 제약 (추가)

- **SSOT(Single Source of Truth)는 Google Sheets.** 별도 DB·Redis·ORM 금지.
- **수강생마다 개별 시트.** `email → spreadsheetId` 매핑은 **마스터 레지스트리 시트** 한 개에 저장 (`lib/repo/users.ts`).
- **대시보드(탭1)는 읽기 전용.** 기존 시트의 수식이 자동 갱신한다. 재구현 X, 데이터만 읽어 Recharts 로 다시 그린다.
- **반응형은 모바일 우선.** 모바일 = 입력 중심, PC = 대시보드·트레이닝 중심. 두 화면은 같은 API를 쓰되 다른 레이아웃.
- **게이미피케이션 로직은 `lib/service/gamification.ts` 단일 파일.** XP 가중치 수정은 ADR 작성 후.

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

- [ ] **Pre-commit Hook 통과:** main 직접 커밋, plan 없는 `lib/`·`app/` 변경은 `.githooks/pre-commit` 에 의해 자동 차단.
- [ ] `npm run typecheck` — TypeScript strict
- [ ] `npm run lint` — ESLint (remediation 메시지 포함 커스텀 규칙)
- [ ] `npm run test:structural` — 레이어·Sheets 격리
- [ ] `npm run test` — 단위·통합
- [ ] 파일 크기 ≤ 500줄 (check.sh 가 검사)
- [ ] 문서 드리프트 — `docs/` 에서 언급한 파일/심볼이 실재

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

## 6.5 문서·디자인 규칙

### 문서 작성
모든 `.md` 문서는 맨 위에 "문서 요약 카드" 포함 필수. 없으면 PR 반려.
형식:
```markdown
> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: (1문장)
> - **누가 읽나요**: 개발자/PM/수강생/전체 팀
> - **어떤 기능·작업과 연결?**: (연결된 기능·코드 영역)
> - **읽고 나면 알 수 있는 것**: (2~3개 질문)
> - **관련 문서**: (선행/후속 링크)
```

### 디자인
- 모든 색·간격·타이포는 `docs/design/tokens.md`를 따른다.
- 새 컴포넌트는 `docs/design/components.md`에 등록 후 구현.
- Tailwind arbitrary value(`text-[15px]` 등) 금지. 토큰에 없으면 토큰 먼저 추가.
- 채널 4색(매입DB/직접생산/현수막/콜·지·기·소)은 고정 — 변경 금지.
- 디자인 변경 시 `docs/design/preview.html` 도 같이 업데이트.

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

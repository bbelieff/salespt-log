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
4. **경로별칭 고정**: `@/types` · `@/config` · `@/repo/*` · `@/service` · `@/util/*`(순수 유틸 — import 0). 상대경로 import 는 피한다.
5. **사용자 작성값 절대 보존 (Bulk-write 안전 가드, 2026-05-14 사고 후)** — 시트 셀에 일괄 쓰기 (`spreadsheets.values.batchUpdate`, `batchClear` 등) 하는 모든 함수는 타겟 셀을 `valueRenderOption: "FORMULA"` 로 **pre-read** 한 뒤, raw 값 (텍스트·숫자·boolean) 이 있으면 그 셀은 **skip** 해야 한다. 빈 셀과 수식(`=...`)만 덮어쓰기 허용. 참고: `lib/repo/setup-formulas.ts:isSafeToOverwrite` + `tests/repo/setup-formulas-guard.test.ts`. 새 bulk-write 함수 추가 시 같은 가드 의무 — 안 그러면 사용자 데이터 손실 사고 재발.

예: `❌ components/Chart.tsx 가 googleapis 를 import. → lib/repo/ 에 메서드를 추가해 Service 경유로 호출하세요. 참고: docs/architecture.md#퍼시스턴스-google-sheets`

## 2.5 프로젝트 도메인 제약 (추가)

### MVP 스코프 (절대 원칙)
- **기간 한정** (날짜 규칙 SSOT: `docs/decisions/0005-week-counting-convention.md`):
  - 종강총회(수료일) = 수강시작일(시트 O1) + **50일** (7기+ 현행). 6기 이하 legacy 는 +57.
    진실은 각 시트 **O2 셀 직접값** — 코드는 offset 강제 안 함.
  - 편집 가능 기간 = 수강시작일 + 69일 (편집 유예). ※ 7기+ 모델 기준 재조정은 ADR-0005 후속 미정.
  - 마감 유예 기간은 8주차 말 잡힌 미팅의 실제 진행/계약 기록용.
  - ~~편집 기간 이후는 모두 읽기 전용.~~ → **ADR-0031(R4) 로 폐지** — 수료(archived) 후에도
    자기 기록을 계속 입력·수정한다(무제한 CRM). 11주+ 는 시트 좌표가 없어 파일럿 DB 정본에만 기록.
  - 모든 통계(퍼널/스킬 점수)는 8주 기준 계산. 유예 기간은 별도 집계.
  - 문서·코드에 특정 날짜 하드코딩 금지.
  - **기간 상수 SSOT = `lib/config/cohort-dates.ts`** (50/57·69·10·8) · **주차 계산 SSOT =
    `lib/util/week.ts`** (시작일 앵커 vs 금~목 앵커 분리). 재하드코딩은
    `tests/structural/period-hardcode.test.ts`(G1~G8)가 차단 (R4 W1-0).
- **사용자 한정**: 현재 수강 중인 수강생 1인칭. 운영자·수료생·일반인 대상 기능 금지.
- **확장 분리**: 확장 가능성 있는 기능은 `docs/future/extensions.md`로 분리. 코드에 미리 넣지 않는다.
- **YAGNI**: "언젠가 쓸 수도 있어서" = 금지. 지금 필요한 것만.
- 스코프 밖 요청을 받으면 먼저 `docs/scope.md`를 참조해서 거절 또는 확장 제안.

### 기술 제약
- **SSOT(Single Source of Truth)는 Google Sheets.** 별도 DB·Redis·ORM 금지.
- **수강생마다 개별 시트.** `email → spreadsheetId` 매핑은 **마스터 레지스트리 시트** 한 개에 저장 (`lib/repo/users.ts`).
- **대시보드(탭1)는 읽기 전용.** 기존 시트의 수식이 자동 갱신한다. 재구현 X, 데이터만 읽어 Recharts 로 다시 그린다.
- **시트 탭 구조**:
  - 웹 직접 쓰기: 업체관리(미팅), 02 계약수납관리(F~AA), 03 DB관리(4섹션), 영업관리 E~H
  - 시트 수식 자동: 영업관리 I~P(`lib/config/index.ts:172 formulaCols`), 대시보드, DB관리 합계행.
    Q~T(승인건수/수납건수/수납액/대행사메모 컬럼 정의)는 `lib/config`에 좌표만 남아있고 실제
    읽기·쓰기 코드가 없는 **폐기된 입력값**(2026-08-05 실측 — `lib/repo`·`lib/service`·`app` 어디서도
    참조 안 함, 구 "I~L/N~T" 표기는 stale)
  - 웹이 영업관리 I~P에 직접 쓰면 린터로 차단
- **업체관리 탭**: 1행=1미팅. append/update 단위로만.
- **표시문자열 2종**: 업체관리 N(날짜 포함)·O(날짜 제외) 두 수식 컬럼 유지.
- **반응형은 모바일 우선.** 모바일 = 입력 중심, PC = 대시보드·트레이닝 중심. 두 화면은 같은 API를 쓰되 다른 레이아웃.
- **게이미피케이션 로직은 `lib/service/gamification.ts` 단일 파일.** XP 가중치 수정은 ADR 작성 후.

---

## 3. 에이전트 작업 규약 (Task Contract)

모든 작업은 다음 루프를 따른다:

0. **워크로그 확인 (세션 공유 기억)** — `docs/worklog.md` 최근 항목 5~10개를 먼저 읽고,
   이번 요청이 어느 트랙의 연장인지·이전 결정과 충돌하지 않는지 사고한 뒤 한 줄로 선언하고 시작한다.
   작업 종료·중요 결정·머지·사고 시 워크로그 맨 위에 항목을 추가한다(형식은 그 파일 상단).
   **Cowork·Claude Code 공통 의무** — 세션 간 핸드오프 문서를 이것으로 대체한다.
0.5. **비판적 사고 (지시 수용 프로토콜, 2026-07-08)** — 지시를 실행하기 전에 한 번 사고한다:
   ① 이 지시의 결과가 최종 목적(로드맵·워크로그 맥락)과 일치하는가
   ② 같은 목적의 더 나은 방법·방향은 없는가 — 중복 구현·장기적 악수는 아닌가
   ③ 안전장치·공수가 목적 대비 부족하거나 과하지 않은가 (필요한 힘 vs 빼야 할 힘).
   납득되면 진행(더 나은 대안이 있으면 함께 제시), 납득되지 않으면 **실행 전에 사용자에게
   의도를 묻는다**. 반박은 쉬운 말로 근거+대안과 함께. 사용자가 근거를 듣고 재확인하면
   그 결정을 따른다. 맹종과 반사적 반대는 둘 다 사고 생략이다.
0.6. **belie 질문 프로토콜 (쉬운 말·2026-07-13)** — belie 에게 선택지를 물어야 할 때(§0.7 화이트리스트),
   **전문용어 금지** — 쉬운 말로, 기술용어가 꼭 필요하면 `실제용어(=비유)` 짝으로. 선택지마다 3줄:
   ① 무엇을 하는 것인지 ② 고르면 실제로 벌어지는 일(화면·데이터·수강생이 겪는 변화) ③ 잘못되면·되돌릴 수 있는지.
   여기에 **권장안 1개(고른 이유 한 줄)** + **결정을 미루면 어떻게 되는지 한 줄**을 붙인다. 개발 내부용어로
   묻지 않는다 — belie 가 결과로 판단할 수 있게.
0.7. **질문 최소화·자율 진행 (2026-07-13)** — 기본은 **묻지 않고 진행**한다. 되돌릴 수 있는 결정은
   권장안으로 **자율 결정·실행**하고 워크로그/PR 에 **자율결정·근거·복구법**을 기록한다. blocking 질문으로
   세션을 세우지 않는다(멈춤 = 시간 유실). 머지는 **check.sh 초록 + 직렬 큐 + §6.8 완주 시 승인 불요**
   (이견 시 **revert 가 정본** — 되돌리면 되므로 진행이 기본). belie 에게 물어야 하는 것은 **화이트리스트만**:
   ① 수강생 실데이터 비가역 변경 ② 돈·보안 ③ 수강생 정책·스펙 방향 전환 ④ 외부 발행. 이때도 **멈추지 말고**
   워크로그 `📥 belie 결정함` 섹션에 등재한 뒤 **다른 작업을 계속**한다.
0.8. **사고 절차 5단계 (2026-08-05 — 실측 실패 사례 역산)** — 사소하지 않은 모든 작업은 순서대로 밟는다
   (단순 질문·한 줄 확인은 건너뛴다):
   **① Scope** — 무엇을 요구받았는지 다시 진술한다(산출물·제약·완료 조건). 모호하면 내 해석을 명시한다.
   **② Gather** — 기억으로 때우지 않는다. 파일은 실측한다(`git show origin/master:<경로>` — 로컬본은
   낡을 수 있다). 착수 전 "이미 있는지" 먼저 찾는다(같은 기능·최근 머지 PR·다른 세션 접수 도장). 없으면
   없다고 말한다.
   **③ Solve** — 단계로 쪼갠다. 방법이 여럿이면 짧게 견주고 이유를 밝혀 고른다.
   **④ Verify** — 수용 기준을 하나씩 짚어 통과/미통과를 가른다. 반증을 시도한다("틀렸다면 무엇이 보일까").
   파급 범위(다른 화면·비파일럿 기수)를 확인한다. 되돌리는 법을 남긴다.
   **⑤ Report** — 결론을 먼저 말한다. 남은 불확실성을 명시한다.
   **증거 없는 문장 금지** — 숫자·로그·`경로:줄번호`·SHA·run id 중 하나가 없으면 추측이다. 모르면
   "모른다"라고 쓰고 못 얻은 이유를 함께 남긴다. **검증 안 한 것을 검증한 것처럼 내놓지 않는다.**
   **완료의 정의** — "문서를 썼다" ≠ "실행했다". 문서 작업과 실행 작업을 한 카드에 섞으면 문서만
   하고 완료로 닫히는 사고가 난다(재발 방지 = 카드를 분리 발행). **부분 완료를 완료로 두는 게 가장
   위험하다** — 아무도 이어받지 않는다.
   **belie 요구 전** — 이미 처리된 일인지 먼저 실측 확인한다. 근거 없는 재요청은 반려한다. belie 는
   개발자가 아니므로 화면 이름·버튼 이름으로 설명한다.
   **적용 범위 제한(2026-08-05 확정)** — 이 절차는 CLAUDE.md 본문(위 방식)으로만 유지한다. 별도
   파일을 세션 기동 시 시스템 프롬프트로 자동 주입(`--append-system-prompt-file` 등)하지 않는다 —
   내용을 매 세션 직접 읽고 다른 규칙과 함께 판단하는 지금 방식이 정본이다.
1. **Intent 확인** — 작업 스펙·수용 기준을 먼저 읽는다.
2. **맥락 수집 (점진적 공개)** — 이 문서는 목차다. 한 번에 모든 정보를 소화하려 하지 말고, 관련 `docs/` 페이지를 필요 시점에 찾아 점진적으로 탐색한다.
3. **계획 상태 관리** — `docs/plans/active/`에 TodoWrite로 계획을 명시한다. 해당 작업이 완료되면 반드시 `docs/plans/completed/`로 문서를 이동시켜 상태를 동기화한다.
4. **격리된 작업 환경 (Git Worktree)** — 절대 로컬 메인 환경에서 직접 코드를 수정하지 않는다. 반드시 새 워크트리(Git Worktree)를 생성하여 그 안에서 독립적으로 구현한다.
5. **자기 검증 & 가시성 확보** — 아래 §4 체크리스트를 실행한다. UI/버그 테스트 시 텍스트 로그뿐만 아니라 DOM 스냅샷, 스크린샷을 남겨 에이전트 스스로 시각적 피드백 루프를 수행한다.
6. **자동 커밋 및 PR 작성** — 검증 통과 시 정해진 규칙에 따라 에이전트가 직접 커밋 및 워크트리 머지를 수행한다. (인간의 개입 최소화)

---

## 3.5 병렬 작업 규약 (2026-07-10 도입)

여러 Claude Code 세션이 동시에 다른 기능을 개발할 수 있다. 단 세 규칙을 지킨다:

1. **트랙 선언** — 병렬 작업은 시작 전에 `docs/worklog.md` 맨 위에 `[병렬트랙]` 항목으로
   자기 구역(디렉토리·파일 범위)을 선언한다. 이미 선언된 다른 트랙과 구역이 겹치면
   병렬 금지 → 순차로 전환. (겹침 판정이 애매하면 겹치는 것으로 간주)
2. **구역 소유 + 계약 먼저** — 트랙은 자기 구역 파일만 수정한다. 공용부(`lib/types`,
   `lib/config`, SSOT 4문서, `scripts/`, `.github/`)는 "계약"이다 — 변경이 필요하면
   그 변경만 떼어 **먼저 단독 PR로 머지**한 뒤 병렬을 재개한다.
   (`docs/worklog.md`는 append 전용이라 예외 — 충돌 시 양쪽 항목 모두 보존)
3. **병렬 구현, 직렬 머지** — PR 오픈까지는 병렬 허용. **머지는 한 번에 하나**(§6.8 배포
   관찰 포함). 하나가 머지되면 다른 트랙은 master 리베이스 + check.sh 재통과 후 머지.
   충돌은 나중에 머지하는 트랙이 해소한다.

게이트는 기존 그대로: check.sh 초록 + 배포 success·health 200 + 워크로그 기록.

---

## 4. PR 전 체크리스트 및 강력한 제동(Hook) 시스템

에이전트는 커밋 또는 PR을 열기 전 다음 과정과 훅(Husky 등)을 반드시 통과해야 한다. 시스템 레벨에서 물리적으로 차단되면(에러 발생 시) 강제로 우회하지 말고, 로그를 분석해 자신을 교정한다.

- [ ] **Pre-commit Hook 통과:** main 직접 커밋, plan 없는 `lib/`·`app/` 변경은 `.githooks/pre-commit` 에 의해 자동 차단.
- [ ] `npm run typecheck` — TypeScript strict
- [ ] `npm run lint` — ESLint (remediation 메시지 포함 커스텀 규칙)
- [ ] `npm run test:structural` — 레이어·Sheets 격리
- [ ] `npm run test` — 단위·통합
- [ ] 파일 크기 ≤ 500줄 (check.sh 가 검사)
- [ ] **SSOT 드리프트** (`scripts/doc-drift.sh` — Hashimoto 가드레일) — 코드의 컴포넌트/타입/시트키가 4개 SSOT 문서에 등재되어 있는지 검증. 면제는 `docs/.ssot-grandfathered.md` 에 박제된 심볼만.

**하나라도 빨갛게 뜨면 PR 금지.** 스크립트나 훅을 우회하지 않는다. 스크립트가 잘못되었다면 스크립트를 고친다.

**CI 자동 검증** (`.github/workflows/typecheck.yml`, 2026-05-13 도입): PR 생성 +
master 푸시 시 GitHub Actions 가 `scripts/check.sh` 를 그대로 실행. 로컬 pre-commit
통과해도 CI 에서 한 번 더 검증 (예: pre-commit 가 비활성화된 워크트리, stash pop
후 commit 누락 등). PR #171 같은 master 빌드 실패 사고 재발 방지.

### SSOT 4 문서 (단일 진실원천)

새 컴포넌트·타입·시트 좌표는 다음 4 문서 중 적절한 곳에 **반드시** 등재 후 코드 추가:

| 코드 영역 | SSOT 문서 |
|---|---|
| `components/**` + `app/(app)/**/_components/**` | `docs/design/components.md` |
| `lib/types/index.ts` exports (Zod) | `docs/domains/data-model.md` |
| `lib/config/SHEET_RANGES.*` 키 | `docs/domains/sheet-structure.md` |
| 색·간격·z-index·typography arbitrary value | `docs/design/tokens.md` |

**원칙: "현재 코드가 진실, SSOT는 그걸 반영한다."**
- 검사 방향은 코드 → SSOT 한 방향만. 옛 plan/wireframe 문서는 SSOT 아님.
- 반대 방향(SSOT에 있는데 코드에 없음)은 검사 안 함 — 그래야 옛 설계로 끌려가지 않음.
- 기존 누락분은 `docs/.ssot-grandfathered.md` 에 박제하여 점진 backfill. 새 PR이 추가하는 누락은 절대 면제 안 됨.
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
- **Cowork(샌드박스)에서 git 변경 명령 실행·`.git/` 내부 파일 조작** (§6.7 — unlink 차단으로 .git 손상·broken ref). git 은 사용자 PC 의 Claude Code 에서만.
- 컨텍스트 창에서만 존재하는 규칙 따르기 — 모든 규칙은 이 파일이나 `docs/`에 있어야 한다.
- 요청되지 않은 리팩터·추상화·"미래 대비" 코드.

---

## 6.5 문서·디자인·브랜치 규칙

### 브랜치 네이밍 (에이전트 포함, 기계검증 대상)
- **금지**: `claude/issue-N-YYYYMMDD-HHMM` 같은 자동 생성 불투명 브랜치명
- **필수**: 접두어 + 의미 있는 kebab-case
  - `docs/<slug>` — 문서만 변경 (예: `docs/sheet-architecture`)
  - `feat/<slug>` — 새 기능 (예: `feat/meeting-results-ui`)
  - `fix/<slug>` — 버그 수정 (예: `fix/stepper-spinner`)
  - `refactor/<slug>` — 리팩터링
  - `chore/<slug>` — 설정·CI·의존성 (예: `chore/branch-naming-guardrail`)
- **slug 규칙**: 영문 kebab-case, 2~5 단어, 무엇을 하는지 읽고 바로 이해 가능
- **이슈 번호/타임스탬프 포함 금지** — PR 설명에 `Closes #N` 대신 기재
- Claude Action은 `.github/workflows/claude.yml`의 `branch_prefix` + `custom_instructions`로 강제

### PR Changelog 규약 (새소식 팝업 자동 수집 — announcement-popup §2)
- **feat/fix PR 은 squash 커밋 메시지 본문에 `Changelog: <수강생이 읽는 쉬운 한 줄>` 포함 의무.**
  이 레포는 단일 커밋 PR → squash 시 그 커밋 메시지가 그대로 master 커밋이 된다.
  배포 시 `scripts/append-updates.mjs` 가 이 줄을 추출해 새소식 팝업 `title_user` 로 쓴다
  (없으면 커밋 제목에서 type 접두어 제거한 fallback).
- 문체 = 토스 UX 라이팅: 쉬운 말, 사용자 혜택 중심("~할 수 있어요"), 짧은 능동형 1문장.
  예: `Changelog: 계약 업체 정보를 한 곳에 적고 TXT로 내려받을 수 있어요.`
- 커밋 제목은 conventional(`feat(scope): ...`) 유지. 제목이 깨진 과거 커밋(`@ (#N)`)은
  수집 스크립트가 본문 첫 줄 fallback 으로 흡수하지만, 제목 안 깨뜨리는 게 정본.
- docs/chore/refactor 는 Changelog 불필요 (기본 visible=FALSE — 수강생에게 안 보임).
- **feat PR 는 가능하면 `Changelog-Anchor: <앵커키>` 포함**(선택) — 앱 내 NEW 표시 위치
  (new-feature-highlight §3). 앵커 키는 `lib/config/anchors.ts` ANCHORS 에 **먼저 등록**
  (코드 상수가 정본, 미등록 키는 무시+경고 로그). 앵커 없는 feat 는 팝업 뱃지만.

**문구 기준 (2026-06-11 확정 — 상세는 announcement-popup.md §7)**:
- 제목: **기능명·기술용어 금지**, 고객이 얻는 것 1문장("~해요" 능동형).
- 상세(body_md)는 `전: ...` / `후: ...` 두 줄 — [전] 곤란했던 실제 상황 1~2문장,
  [후] 달라진 경험 + 구체 행동 1~2문장.
- **여러 PR 짜리 기능**: squash 커밋에 `Changelog-Group: <그룹키>` → 수집 시
  visible=FALSE 로 적재(반쪽 기능 노출 방지), 그룹 마지막 PR 커밋에 `Changelog-Done`
  한 줄 → 그룹 전체 visible=TRUE 전환. 그룹키는 milestone 컬럼에 적재돼 팝업에서
  1개 항목으로 묶인다.

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

---

## 6.6 Dev Server 자동 동기화 (Hashimoto 가드)

**문제**: 사용자가 GitHub에서 PR 머지 → 로컬 worktree(`wt/<x>/`)는 옛 commit 그대로 →
브라우저 새로고침해도 옛 화면. 매번 수동 pull + 재시작 필요.

**해결 (2026-05-08 — `chore/dev-auto-sync` + `fix/dev-watch-cross-platform` PR)**:

- `npm run dev` 실행 시 `scripts/dev-with-watch.mjs` (**Node**) 가 두 프로세스 병렬 실행:
  1. `next dev` — Next.js dev server (foreground 콘솔)
  2. 내부 watcher loop — 30초마다 `origin/master` poll → 변경 시 `git pull --ff-only`
- **PowerShell/Windows 호환** — bash 의존 제거 (이전 .sh 버전은 PowerShell에서 `'bash'은(는) 내부 또는 외부 명령` 에러).
- Next.js 가 파일 변경 자동 hot-reload 하므로 **재시작 불필요**.
- Ctrl+C 한 번에 둘 다 종료 (signal trap).

**npm scripts**:
- `npm run dev` — watcher + dev server (기본, Node)
- `npm run dev:no-watch` — watcher 없이 (오프라인)
- `npm run dev:watch-bash` — bash 단독 watcher (Git Bash 사용자용 fallback)

**원칙**: 같은 "왜 새로고침 안 되지?" 질문이 두 번 나오는 순간 = harness issue.
환경을 고쳐 사용자가 다시 묻지 않게 한다.

---

## 6.7 Cowork(샌드박스)에서 git 안전 (2026-06-02 인시던트 후)

**무엇이 터졌나**: Cowork 데스크톱(샌드박스)에서 마운트된 레포에 `git add/commit/switch -c/branch -D` 실행.
이 샌드박스 마운트는 **파일 삭제(unlink)를 막는다** → git 이 만든 `*.lock` 이 안 지워지고 잔류.
이어 `find .git -name "*.lock"` 식 **광범위 rename 정리**가 `refs/heads/<branch>.lock` 을 ref 디렉토리 안에
**빈 파일(= null SHA, 깨진 ref)** 로 남겨 `git fetch` 전체를 차단함.
참고: `docs/incidents/2026-06-02-cowork-git-no-unlink.md`.

**규칙 (샌드박스는 훅으로 못 막으니 반드시 준수)**:
1. **Cowork 샌드박스에서 git 쓰기 명령 금지** — `add·commit·switch/checkout -b·branch·merge·rebase·stash·reset·gc` 등 `.git` 을 변경하는 명령 일절 금지. 읽기 전용(`status·log·diff·show·cat-file`)만 허용.
2. **커밋·푸시·PR 은 핸드오프** — Cowork 는 working tree 에 파일 작성까지만. 커밋/푸시/PR 은 **사용자 PC 의 Claude Code**(unlink 정상 + GitHub 인증 보유)에서 수행하도록 사용자에게 넘긴다. 샌드박스엔 GitHub 인증이 없어 push 자체가 불가.
3. **`.git/` 내부 파일 rename·이동·삭제 절대 금지** — 특히 `refs/` 하위. 잠금 해제가 꼭 필요해도 `.git/index.lock` **정확한 단일 경로**만, `find`·글롭·일괄 rename 금지. ref 디렉토리에 `.lock`·`.bak` 잔재를 남기면 fetch 가 깨진다.
4. **동시 세션 주의** — 사용자 PC 의 Claude Code 가 같은 레포를 동시에 만질 수 있다. 샌드박스에서 `.git` 을 건드리면 충돌·손상 위험 → `.git` 은 읽기 전용으로만 취급.

## 6.8 배포 & 롤백 (머지 후 에이전트가 끝까지 책임)

**원칙 (2026-06-03 사용자 지시)**: PR 머지로 끝내지 않는다. **머지 → 배포 관찰 → health 확인까지가 한 작업.** 문제 시 **즉시 롤백**.

**자동 배포**: `master` push 시 `.github/workflows/deploy.yml` 이 자동 트리거(수동 = `gh workflow run "Deploy to VPS"`).
워크플로우(요약): VPS `/opt/salespt-log` 에서 `git reset --hard origin/master` → `npm ci` → `npm run build`(`NODE_OPTIONS=--max-old-space-size=2048`, `.next-build` 에 빌드→원자 swap, **BUILD_ID 검증**) → `pm2 reload salespt-log` → health 게이트(실패 시 자동 롤백).
원격 스크립트는 **detached(`setsid`)로 실행**되어 러너↔VPS 연결이 끊겨도 끝까지 완주한다(연결끊김→`.next` 손상→502 사이트다운 재발방지, 2026-07-09). 배포 성공/실패의 정본 = 원격이 남긴 `.deploy/<run>.status`. 상세 = `docs/playbooks/deploy-vps.md §0`.

**에이전트 절차**:
1. **머지 직전 last-good SHA 기록** — `git rev-parse origin/master` (롤백 타겟).
2. 머지 후 배포 run 을 **끝까지 관찰**: `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion`.
3. 결과 분기:
   - **success** → 공개 health(`https://salesptlog.online` HTTP 200) 확인 후 완료 보고.
   - **Setup SSH 단계 실패** → 거의 안 남: ssh-keyscan **자동 재시도 내장**(connect 타임아웃 + 최대 5회, `chore/deploy-ssh-retry`). 그래도 실패면 VPS 도달성 지속 장애 → `gh run rerun <id> --failed` + VPS 상태 점검.
   - **build / health 실패** → 코드 문제 → **즉시 롤백**.

**롤백 (정본 — force-push 금지, 이 레포는 squash merge)**:
```bash
# 이 레포 PR 은 --squash → master 에 단일 커밋. 머지 1건 되돌리기:
git revert <bad-squash-sha>     # (merge 커밋 아님 → -m 불필요)
git push origin master          # push → 자동 재배포(직전 정상 코드)
```
- 여러 커밋이면 범위 revert. 절대 `reset --hard` + force-push 로 master 역사 훼손 금지.
- 롤백 배포도 동일하게 success + health 확인.
- 롤백 후: 원인 분석 → fix-forward PR. 실패·롤백 기록은 `docs/incidents/` 에 남긴다(§5.5).
- 상세 = `docs/playbooks/deploy-vps.md`.

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

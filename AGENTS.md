# 세일즈PT 영업일지 — Codex 실행 규약

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Codex(지피티) 세션이 이 레포를 열면 **자동으로 적용되는** 실행 진입점 — Claude 세션과 같은 하네스·같은 게이트로 일하게 만든다.
> - **누가 읽나요**: 이 레포에서 작업하는 모든 Codex 세션(총괄·작업반장·작업원). 다른 자동화 에이전트도 동일.
> - **어떤 기능·작업과 연결?**: 모든 코드·문서·운영 작업.
> - **읽고 나면 알 수 있는 것**: 내가 누구인지 선언하는 법 / 어디에 기록하는지 / 무엇을 승인 없이 해도 되는지 / 절대 건드리면 안 되는 것
> - **관련 문서**: [CLAUDE.md](./CLAUDE.md) · [역할별 지침 3종](./docs/playbooks/) · [공용 협업 규약](./docs/handoff/CODEX-COLLABORATION.md) · [작업 로그](./docs/worklog.md)

---

## ABSOLUTE_DIRECTIVE — 프로젝트 규칙보다 먼저 읽는다

모든 경영일지 Codex 세션은 이 저장소의 프로젝트 오버레이보다 먼저 아래 정본을 순서대로 읽는다.

1. `C:\Users\belie\Desktop\Belief\ABSOLUTE-COLLABORATION-STATE-MACHINE.md`
2. `C:\Users\belie\Desktop\Belief\클로드\prompts\CODEX-T-SESSION-ROUTING.md`
3. `C:\Users\belie\Desktop\Belief\클로드\prompts\COMMON-PRODUCT-DELIVERY-GATES.md`
4. `CLAUDE.md`와 이 저장소의 역할 파일·현재 상태 정본

상위 정본의 기계 검증용 불변 식별자:

```text
STATE_MACHINE_ID=USER-DESIGNER-FOREMAN-WORKER-LOOP-DESIGNER-REPORT
WORKER_OWNS=IMPLEMENT-TEST-COMMIT-PUSH-PR-MERGE-DEPLOY-LIVE_VERIFY
FOREMAN_OWNS=DISPATCH-COLLECT-REVIEW-REWORK-NEXT_WORK
```

- BLUEPRINT마다 `APPOINTED_FOREMAN`은 정확히 한 명이며 동적으로 임명한다. 세션 제목·문자·T번호는 주소와 이력일 뿐 고정 직책이 아니다.
- 공식 DESIGNER·APPOINTED_FOREMAN·WORKER·독립 REVIEW WORKER는 사용자에게 보이는 실제 영속 Codex 세션이어야 한다.
- 실제 `threadId/title/hostId/status`, 현재 실측, 정확한 대상에게 성공한 전송 receipt, ACK와 RESULT가 모두 없으면 `NOT_DISPATCHED`다.
- 내부 subagent는 공식 역할을 대체하지 않는다. 배정된 WORKER만 자기 lease 안의 bounded subset에 `INTERNAL_SUBAGENT_ONLY`로 사용할 수 있고, 공식 ACK·RESULT·review·merge 책임은 WORKER에게 남는다.
- DESIGNER(총괄)는 사용자 목표·범위·게이트를 BLUEPRINT로 정하고 Foreman을 임명하며 BLUEPRINT 완료 또는 blocker만 돌려받는다. WORKER를 직접 배정·회수하거나 일반 제품을 구현하지 않는다.

## 0. 먼저 — 네 역할 파일을 하나 더 읽어라

이 파일은 **전 역할 공통**이다. 여기에 더해 **네 역할 파일 1개**를 반드시 읽는다.

| 네가 | 읽을 파일 |
|---|---|
| **총괄 세션** (`DESIGNER`: BLUEPRINT·Foreman 임명·사용자 보고) | [`docs/playbooks/codex-lead.md`](./docs/playbooks/codex-lead.md) |
| **작업반장** (`APPOINTED_FOREMAN`: 배정·회수·검수·재지시) | [`docs/playbooks/codex-foreman.md`](./docs/playbooks/codex-foreman.md) |
| **작업원** (계약 1건 완주) | [`docs/playbooks/codex-worker.md`](./docs/playbooks/codex-worker.md) |

역할과 실제 전송 증거를 못 받았으면 스스로 역할을 택하지 말고 `PARKED / NOT_DISPATCHED`로 둔다.

---

## 1. 신원 — 첫 응답에서 선언한다

```
[경영일지 <머신> <공급자><역할>(몸버전)]
  머신   = 노트북 | 데탑          (물리적으로 다른 기기)
  공급자 = G(지피티/코덱스) | C(클로드)
  역할   = 작업원A~F | 작업반장 | 총괄
  몸버전 = 세션을 연 날짜 6자리(YYMMDD)
```

예: `경영일지 노트북 G작업원A(260809)` · `경영일지 노트북 G작업반장(260809)`

- **접두사 `경영일지` 는 필수다.** 같은 Linear 팀(`Bbelieff`)에 **모아워크** 프로젝트가 함께 있고 이슈 접두어가 둘 다 `BBE-` 라, 프로젝트 접두사가 유일한 구분자다. (2026-08-09 실제 오염 사고 — 모아워크 세션이 경영일지 관제판을 점거)
- 접두사 내부는 공백 구분, 역할+문자는 붙여쓴다(`작업원 A` ✗ / `작업원A` ✓).
- **배차자가 적어준 머신·공급자가 실제와 다르면 네가 고쳐 선언한다.** 자기 환경은 네가 가장 잘 안다.

---

## 2. 정본과 우선순위

| 무엇 | 정본 |
|---|---|
| 하네스·도메인 규칙·배포 절차 | **`CLAUDE.md`** (Codex도 그대로 따른다) |
| 세션 간 공유 상태·병렬 트랙 선언 | **`docs/worklog.md`** (Git 공유) |
| 운영 규칙(도장·자율 완주) | **Linear BBE-73** |
| 세션 하트비트 | **Linear BBE-75** ⚠️ 모아워크는 BBE-94 — 헷갈리면 상대 관제판이 오염된다 |

**코드와 문서가 충돌하면 코드가 진실이다.** 단 변경 전 관련 SSOT·ADR을 확인하고 같은 PR에서 문서를 동기화한다.

**실측 원칙**: 파일은 `git show origin/master:<경로>` 로 확인한다. 로컬본은 다른 세션 리셋으로 낡아 있을 수 있다(실제 사고 있었음).

---

## 3. 자율 완주 — 머지·배포에 승인이 필요 없다

**belie 정책(2026-08-09, 전 프로젝트 공통).** 아래 3개가 충족되면 **묻지 말고 진행한다**:

1. `bash scripts/check.sh` 초록
2. 직렬 머지 큐 준수(§3.5 — 한 번에 하나)
3. §6.8 완주(머지 → 배포 관찰 → health 200)

**이견이 생기면 revert 가 정본이다.** 되돌릴 수 있으므로 "진행"이 기본값이고 "대기"가 예외다. 멈춤 = 시간 유실.

**belie 에게 물어야 하는 것은 4가지뿐**:
① 수강생 실데이터 **비가역** 변경 ② 돈·보안(과금·자격증명·방화벽·새 원격접속경로) ③ 수강생 정책·스펙 방향 전환 ④ 외부 발행(공지·문안)
※ 코드 변경·머지·배포는 revert 가능하므로 **해당 없음**.

WORKER는 이 게이트를 발견하면 `APPOINTED_FOREMAN`에게 `BLOCKED`로 실제 전송하고, Foreman이 DESIGNER에게 반환한다. 사용자와의 결정은 DESIGNER가 맡는다.

**하지 마라**: "belie 승인 대기"로 카드를 세워두기 · 완주 도장에 "머지는 belie 확인 후" 적기 · 화이트리스트 아닌 건을 belie 결정함(BBE-35)에 올리기.
한시 보류가 필요하면 **해제 조건과 시점을 반드시 함께** 적어라 — 조건 없는 보류는 영구 정지다(실제로 PR 6건이 그렇게 쌓였다).

※ 카나리아 테스트·회귀 확인 같은 **기술 검증 게이트는 승인 게이트가 아니다.** 통과하면 그대로 머지한다.

---

## 4. 사고 절차 (= CLAUDE.md §0.8)

사소하지 않은 작업은 순서대로 밟는다. 단순 질문은 건너뛴다.

1. **Scope** — 무엇을 요구받았는지 다시 진술(산출물·제약·완료조건). 모호하면 내 해석을 명시.
2. **Gather** — 기억으로 때우지 않는다. `git show origin/master:<경로>` 실측. 착수 전 **"이미 있는지" 먼저 찾는다**(같은 기능·최근 머지 PR·다른 세션 접수 도장). 없으면 없다고 말한다.
3. **Solve** — 단계로 쪼갠다. 방법이 여럿이면 짧게 견주고 이유를 밝혀 고른다.
4. **Verify** — 수용 기준을 하나씩 ✅/❌. **반증 시도**("내 결론이 틀렸다면 무엇이 관찰될까"). 파급(다른 화면·비파일럿 기수). 되돌리는 법.
5. **Report** — 결론 먼저. 남은 불확실성 명시.

**증거 없는 문장 금지** — 숫자·로그·`경로:줄번호`·SHA·run id 중 하나가 없으면 추측이다.
`"잘 됩니다"` ✗ → `"테스트 1053 green · health 200"` ✓ / 모르면 **"모른다" + 왜 못 얻었는지**.

**완료의 정의** — "문서를 썼다" ≠ "실행했다". 수용 기준 전부 ✅ + 실행 항목 실제 실행 + §6.8 완주 + 증거 숫자. 하나라도 ❌면 완료가 아니다. **부분 완료를 완료로 두는 것이 가장 위험하다** — 아무도 이어받지 않는다.

**"판별 불가"는 정당한 결론이다. "아마 이것일 것이다"는 결론이 아니다.**

---

## 5. 기록 — 안 남기면 존재하지 않는 일이 된다

관제판은 Linear 를 **직접 읽어** 그린다. 사람이 따로 입력하는 곳이 없다.

### 5-1. 하트비트 (BBE-75 — 경영일지 전용)

```
[경영일지 <머신> <공급자><역할>(YYMMDD)] <착수|진행|막힘|완주|대기|종료> · <시각>
지금: <한 줄>
다음: <한 줄>
카드: <BBE-nn(경영일지) 또는 "미배정">
막힘: <있으면 한 줄, 없으면 "없음">
```
시점: 세션 열자마자 · 착수 · **30~60분마다** · 막혔을 때 즉시 · 완주 · 종료.
⚠️ 마지막 신호가 90분 넘으면 관제판에 빨갛게 뜬다 — **조용히 일하는 것과 멈춘 것은 구분되지 않는다.**

### 5-2. 도장 (BBE-73)

**착수** — 카드를 `In Progress` 로 + 코멘트
```
접수 — 경영일지 <머신> <공급자><역할>(YYMMDD) · <날짜 시각>
브랜치: codex/<slug> · base SHA: <sha> · lane: <레인>
착수 범위: <1줄>
```

**완주** — §6.8 완주 후 `Done` + 코멘트. **증거 형태는 카드 종류를 따른다**:

| 카드 종류 | 완주 증거 |
|---|---|
| 코드 PR | PR #n · 머지 SHA · 배포 run id · health 200 · 검증 수치 |
| 운영 실행(코드 변경 0) | **워크플로 run id + 실측 대조표** (PR 자체가 없다) |
| 읽기 전용 조사·검증 | **산출물 경로 + 실측값** |
| 범위가 "PR 오픈까지"인 카드 | PR 번호 + CI run (WORKER는 Foreman의 다음 지시까지 HOLD) |

**무기명 변경 금지.** PR 본문에 카드 번호 필수. feat/fix 커밋 본문에 `Changelog: <수강생이 읽는 쉬운 한 줄>`.
Linear MCP 가 없으면 같은 양식을 `docs/worklog.md` 에 남긴다 — **기록 생략은 안 된다.**

---

## 6. 작업 시작 절차

1. `docs/worklog.md` 최근 10건 + 요청 관련 활성 plan·SSOT·ADR 을 읽는다(origin/master 기준).
2. 목적·중복 여부·안전장치를 검토한다. **데이터/배포 위험이 커지거나 의도가 불명확하면 구현 전에 묻는다.**
3. `git fetch origin` 후 메인 체크아웃을 건드리지 않고 전용 worktree 를 만든다:
   ```powershell
   git worktree add -b <feat|fix|docs|chore>/<meaningful-slug> wt/codex-<slug> origin/master
   ```
   ⚠️ 새 worktree 엔 `node_modules` 가 없다 → `npm ci`. junction/심볼릭 링크는 `npx`·`node` 해석을 깨뜨리니 쓰지 마라.
4. worklog 맨 위에 `[병렬트랙] Codex` 로 소유 파일 범위·의존 계약을 선언한다. 겹치거나 애매하면 **병렬 금지**.
5. `docs/plans/active/` 에 계획을 만들고 구현·검증·문서 갱신·PR·배포 관찰을 **한 작업 단위로** 끝낸다.

---

## 7. Claude 사무소와 충돌 없이 협업하기

- **브랜치 소유**: `codex/*` 는 코덱스, `claude/*` 는 클로드. **상호 임의 인수 금지.** 먼저 선언한 쪽 우선, 겹치면 나중 쪽이 비켜 다른 작업으로.
- **메인 금지**: 메인 작업트리의 코드·추적 문서를 수정하거나 pull/rebase/commit 하지 않는다. 로컬 변경은 다른 세션 소유로 취급.
- **전용 worktree**: `wt/codex-<slug>` 만 사용. 상위 `wt/` 의 다른 worktree 는 참고만 하고 변경하지 않는다.
- **공용부는 계약이다**: `lib/types` · `lib/config` · `scripts/` · `.github/` · `CLAUDE.md` · SSOT 4문서. 변경이 필요하면 **그 변경만 떼어 단독 PR 로 먼저 머지**한 뒤 재개한다. `docs/worklog.md` 충돌은 **양쪽 기록 모두 보존**.
- **직렬 머지**: 구현은 병렬, 머지~배포 health 확인은 한 트랙만. 앞 PR 이 머지되면 `origin/master` 에 rebase 후 `check.sh` 재통과.
- **도장은 전체 표기로 읽어라** — `노트북 G작업원A` 와 `데탑 C작업원A` 는 **다른 몸**이다.
- **네 구역이 아닌 지시는 반려가 올바른 행동이다.** 오배송이 실제로 있었다.
- **마이그레이션 번호**는 열려 있는 다른 PR 것까지 확인하고 정한다(충돌 상습).

---

## 8. 이미 밝혀진 함정 — 여기서 헛수고하지 마라

- **로컬 PC 에 운영 비밀값이 없다.** `ADMIN_DRIVE_REFRESH_TOKEN`·`DATABASE_URL` 은 GitHub Secrets → 배포가 VPS `.env` 에 주입한다. 로컬 실행 시 `invalid_grant`/DB 접속 실패는 **환경 문제지 값 문제가 아니다.** 정본 실행 경로 = GitHub Actions `workflow_dispatch`.
- **DB 마이그레이션은 자동 적용되지 않는다**(2026-08-09 실측, BBE-85). `deploy.yml` 은 `DATABASE_URL` 을 앱 env 로 주입만 하고 `db:migrate` 를 호출하지 않는다. `lib/repo/db/migrations/*.sql` 을 추가했다고 프로덕션에 반영되는 게 아니다.
- **배포 SSH 타임아웃 = 코드 문제 아님** → **rerun**, 롤백 금지. `build`/`health` 실패만 진짜 롤백 사유다.
  근인 확정(2026-08-09, BBE-77): 호스팅사(Hostinger) 엣지가 GH 러너의 유동 IP 를 이상탐지로 차단. **Tailscale 터널로 우회** — 워크플로 5종은 전환 완료, `db-migrate`·`arena-season2-batch`·`db-backfill-registry` 3종은 잔여(BBE-95).
- **SSH 를 짧은 간격으로 반복 실행하지 마라.** 그 자체가 차단 방아쇠다(실측: 2분 안 3회 → 앞 2번 성공, 3번째부터 전면 차단). 검증은 1회씩 간격을 두고.
- `git worktree remove` 는 Windows 긴 경로로 물리삭제 실패 가능(git 등록 해제됨·빈 디렉토리 잔류 = 무해).
- **`.git/` 쓰기 금지는 Cowork(관제탑) 전용이다.** 너는 커밋·푸시·PR 을 정상 수행한다.

---

## 9. 구현·검증 기준

- 레이어 규칙, Google Sheets 격리, 대시보드 쓰기 금지, §2.5 대량쓰기 보존 가드, 도메인 불변식은 **`CLAUDE.md`** 를 따른다.
- 도메인 불변: **부가세 제외 · 매출 = 수임비 + 수납액 · 용어 '수임비' · 채널 4색 고정 · 날짜 하드코딩 금지.**
- 새 컴포넌트·타입·시트 키·디자인 토큰은 **SSOT 4문서를 같은 PR 에서** 갱신한다.
- **훅·테스트를 우회하지 않는다.** PR 전 `bash scripts/check.sh`를 통과한다. runtime/app bytes가 바뀌면 `npx next build`도 필수다. 문서만 바뀌고 runtime bytes가 불변이면 build를 생략할 수 있지만, 이유와 `NOT_RUN`을 증거에 명시한다.
- 완료 시 plan 을 `completed/` 로 옮기고 worklog 에 결과·검증·남은 위험을 기록한다.
- **NOT_RUN 을 PASS 로 올리지 않는다.**

---

## 10. 금지

- `raw/`, 외부 vault, 사용자 데이터 수정.
- 테스트를 "통과시키기 위해" 수정·삭제.
- `--no-verify` 등으로 훅·린터·구조 테스트 우회.
- 요청 밖의 리팩터·추상화·"미래 대비" 코드.
- `.git/` 내부 직접 조작, 다른 에이전트의 worktree·브랜치 정리.
- `HANDOFF.md`·`scratchpad/`·`.env*`·`logs/` 임의 정리·삭제·커밋(읽기는 가능).

---

## 11. 첫 응답 형식

1. **신원** — 전체 표기(`경영일지 <머신> <공급자><역할>(YYMMDD)`) · 소유 구역
2. **읽은 것** — AGENTS.md ✅ / 역할 파일 ✅ / CLAUDE.md ✅ / worklog N건 ✅ / BBE-75·BBE-73 ✅ / 계약 카드 ✅
3. **환경** — Linear MCP `O/X` · `gh auth status` `O/X` · worktree 경로 · base SHA
4. **계약 이해** — 내가 할 일을 내 말로 1~3줄
5. **이미 돼 있나** — 계약 내용이 이미 구현/실행돼 있는지 **실측** 결과
6. **레인 확인** — 겹치는 트랙 유무
7. **막힘** — 없으면 "없음"
8. **게시** — 하트비트(BBE-75) ✅ / 접수 도장 ✅

⚠️ 7번에 "belie 가 해줘야 할 것"을 적을 땐 **이미 끝난 일인지 먼저 실측**해라. 토큰·시크릿 등록은 이미 완료된 건이 많다. 근거 없는 재요청은 반려된다. **머지 승인은 belie 몫이 아니다(§3) — 여기 적지 마라.**

---

## Log

- 2026-08-02 최초 작성.
- 2026-08-09 대폭 개정 — 역할 파일 3종 분기(§0), 세션명 규칙(§1), 자율 완주 정책(§3), 사고 절차 §0.8(§4), 하트비트·도장(§5), 최근 함정 4건(§8), 첫 응답 형식(§11) 추가. 존재하지 않는 `HANDOFF.md` 참조 제거.
- 2026-08-09 R2 — 절대 상태머신·실제 세션 증거를 선행 정본으로 고정하고 DESIGNER·APPOINTED_FOREMAN·WORKER 소유권과 docs-only build 예외를 정렬.

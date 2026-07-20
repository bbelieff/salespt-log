# 인수·복귀 런북 — Claude 전체 중단 ↔ Codex 비상관제

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Claude 사용 한도가 통째로 끝났을 때 Codex가 5분 안에 이어받고, 복귀 시 안전하게 돌려주는 절차.
> - **누가 읽나요**: Codex-Failover-Control, Claude 디스패치, 운영자(belie)
> - **읽고 나면 알 수 있는 것**: 언제/누가/어떻게 지휘권을 넘기고 돌려받는가
> - **관련 문서**: coordination/README, provider-status.yaml, session-registry.yaml, AGENTS.md

## 전제

- 사용 한도는 **제공자 단위**로 소진된다 — Claude가 끝나면 디스패치·Cowork·전 코드 트랙·카페봇 세션이 함께 멈출 수 있다. 트랙별 토큰 상태를 만들지 않는다.
- 그래서 **checkpoint는 평상시에 쌓는다** (한도 종료 후엔 handoff를 쓸 손이 없다). 갱신 시점: 착수/중요 결정/원자 구현 완료/검사 성패/PR 오픈/리뷰 반영/머지 직전·직후/배포/블로커/사용자 결정 대기/세션 종료 전. 기록처: session-registry.yaml + 각 트랙 handoff 파일 + worklog.
- **제공자별 실행환경 능력은 비대칭이다** (드라이런 실측 2026-07-20, §C). Codex 세션은 오프라인 샌드박스에서 돌 수 있어 **게이트(check.sh·next build)·GitHub(fetch/push/PR)·배포 관찰이 구조적으로 불가**할 수 있다 — 이건 규약 위반이나 실력 문제가 아니라 **환경 한계**다. 그때는 강제 우회(§6 금지)도, 실패 선언도 아닌 **relay**(§C)로 처리한다.

## A. Claude 전체 중단 → Codex 인수

**트리거 (사용자 발화)**: "Claude 전체 사용 한도가 끝났어. 현재 진행 중인 Claude 작업을 전부 확인하고 필요한 Codex 트랙을 만들어 이어서 진행해."

**Codex-Failover-Control 절차** (목표: 5분 내 활성 작업 식별):

1. `provider-status.yaml`: `claude.status=exhausted`, `claude.active_controller=null`, `openai.active_controller=CODEX-FAILOVER-CONTROL` (근거 evidence 기록 — 같은 커밋).
2. 읽기 순서(5분 코스): coordination 3파일(README·registry·queue) → worklog 보드 → GitHub Open PR·최신 master → `git worktree list`.
3. **실제 활성 트랙만** 식별 — worktree 이름만 보고 활성으로 판단 금지, registry의 status+checkpoint와 GitHub 실측 대조. 완료·대기 트랙은 인수하지 않는다.
4. 기존 Claude writer를 registry에 `FROZEN_PROVIDER`로 기록 (트랙 상태는 보존).
5. checkpoint ↔ 실제 worktree(staged/unstaged/untracked) 대조. 어긋나면 실측 우선 + 어긋남을 registry에 기록.
6. **Claude worktree는 읽기 전용 보존** — 절대 수정·정리·삭제하지 않는다.
7. 이어받을 작업만 **Codex 전용 worktree**(`wt/codex-<slug>`, AGENTS.md 규약)를 origin/master 또는 해당 PR 브랜치에서 새로 만든다.
8. 트랙별 Codex writer 한 명 지정 → registry `writer_session` 갱신.
9. 인수 사실을 registry + worklog 맨 위에 기록.
10. 이후 작업은 기존 완료 기준 그대로: check.sh → 직렬 머지 → 배포 success + health 200 (CLAUDE.md §6.8).

## B. Claude 복귀

**트리거 (사용자 발화)**: "Claude 사용 한도가 초기화됐어. Codex 작업을 정리하고 Claude가 다시 받을 수 있게 해줘."

**처리 원칙**:

1. **빼앗지 않는다** — Codex가 거의 완료한 작업은 Codex가 마무리(머지·배포 관찰까지). 구현 중이면 원자 checkpoint 후 반환. 조사만 했으면 조사 결과+근거만 반환.
2. Claude 디스패치가 **독립 실측**(GitHub PR·master SHA·배포 상태·worktree)으로 checkpoint를 검증한다. 검증 전 writer 변경 금지.
3. 검증 후 registry에서 트랙별 writer를 Claude 세션으로 갱신 — **제공자 active 전환과 트랙 writer 반환은 별도 사건**으로 각각 기록.
4. `provider-status.yaml`: `claude.status=active`, `claude.active_controller=CLAUDE-DISPATCH`, `openai.active_controller=null` — Codex-Failover-Control은 STANDBY.
5. Codex 전용 worktree는 반환 완료 후에도 참고용 보존(정리는 별도 승인).

## C. Codex 환경 제약 → relay (게이트·머지·배포를 Codex가 못 할 때)

**실측 근거 (KPI-③ 드라이런, 2026-07-20 — codex-dryrun-track-coord-docs)**: Codex 세션이 오프라인 샌드박스(別 OS 사용자 `CodexSandboxOffline`)에서 실행되어 아래가 전부 막혔다 — vitest/esbuild 상위경로 접근 거부(→ `check.sh` 불가), next build 폰트 HTTPS 차단(→ 빌드 불가), GitHub fetch/push 차단(→ PR·배포 관찰 불가). **A.10·bootstrap 완료기준이 전제하는 "Codex가 직접 check.sh→머지→배포"가 이 환경에선 성립하지 않는다.**

**분기 판단 (Codex 세션 스스로)**: 착수 후 `bash scripts/check.sh` 또는 `git fetch origin` 이 **환경 사유**(파일 접근 거부·네트워크 차단)로 실패하면 — 코드/규약 문제가 아니라 **환경 블로커**다. 재시도·우회(§6 금지) 금지.

**relay 절차**:
1. Codex 는 **worktree 작성 + checkpoint 까지만** 완주한다 — 브랜치·변경 파일·`base_sha`·staged 목록·실패 명령과 그 원인(환경)·다음 원자 행동을 session-registry 자기 슬롯에 기입(bootstrap [checkpoint] 필수 필드).
2. **게이트·PR·머지·배포 관찰은 Claude(정상환경)가 이어받는다** — B의 복귀 원칙과 대칭. Claude 디스패치가 독립 실측으로 Codex 산출물을 검증한 뒤(worktree diff·파일 내용·비밀값), **동일 파일을 정상환경에서 재검증**(check.sh 초록·next build 성공)하고 §6.8까지 완주한다.
3. relay 커밋은 **Codex 를 `Co-authored-by`** 로 명시(작업 주체 보존). registry 자기 슬롯에 채점표(규약 준수 항목별 PASS/BLOCKED)와 relay PR 을 기록한다.
4. **판정**: 규약(worktree 격리·공용부 무접촉·내용 불변·비밀값0·checkpoint 필드) 준수 = PASS 면 relay 는 **정상 경로**다(실패 아님). 게이트·머지 항목만 `BLOCKED_BY_ENV` 로 표기.
5. **relay 주체 — 전면 소진 대비 (belie 확정 2026-07-21)**: §C.2 의 "Claude 정상환경"은 **부분 소진**(일부 Claude 세션 생존) 기준이다. Claude 가 **전면** 한도 종료면 relay 할 Claude 세션도 없다 — 이때는 (a) **belie 수동 머지**(GitHub UI 로 Codex worktree diff·비밀값 검토 후 직접 squash 머지 → 배포 run success·health 200 확인), 또는 (b) **한도 리셋까지 머지 동결**(Codex 는 worktree+checkpoint 로 대기, 리셋 후 Claude 가 relay 완주)로 처리한다. 즉 페일오버 = "Codex 조사·작성 + relay(정상 Claude **또는** belie 수동)"이며, **완전 무인 자동 완주는 범위 밖**이다 — 안정화는 *절차·주체·경계의 확립*이지 완벽 자동화가 아니다.

> **∴ 완료기준 읽는 법**: A.10 과 bootstrap [작업 규칙]의 "check.sh→머지→배포"는 **정상환경 기준**이다. Codex 샌드박스가 오프라인이면 그 단계는 relay 로 위임하는 것이 규약이며, Codex 단독 완주를 강요하지 않는다.

## B-1. 복귀 프로토콜 왕복 실연 기록 (KPI-③ ⓒ, 2026-07-20)

드라이런에서 B(복귀)의 왕복이 실제로 한 번 돌았다 — 축소판이지만 절차 검증으로 유효:
- **Codex →**: `wt/codex-track-coord-docs`(branch `chore/track-coord-docs`, base dab5386) 작성 + 문서 2건 staged + registry 자기 슬롯 checkpoint 기입 → 환경 블로커로 게이트/머지 불가 신고.
- **→ Claude 독립 검증**: GitHub Open PR·master SHA·worktree diff 실측, 2문서 SHA-256 원본과 바이트 동일 확인, 비밀값 0, 공용부 무접촉 확인 — checkpoint ↔ 실측 일치(B.2).
- **→ relay 완주**: 동일 파일 정상환경 재검증(check.sh 초록·next build 성공) → #610 squash 머지(Codex Co-authored) → 배포 success·health 200(§6.8) → registry writer/verdict 기록(B.3).
- **결과**: 규약 위반 0, 환경 블로커만 relay 로 흡수. 절차상 결함 없음.

## 검증 (분기별 모의훈련 권장)

- 두 컨트롤러 동시 활성 불가 확인 / writer 1명 규칙 / file lease 무겹침 / Open PR↔registry 일치 / stale worktree 오인 없음 / 비밀값 없음 / 웹앱·카페봇 VPS 경로 분리(/opt/salespt-log vs /opt/bots/salespt-cafe-bot).

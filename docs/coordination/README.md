# 협업 관제 (Coordination) — Claude ↔ Codex 영구 협업 체계

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Claude 전체 사용 한도 종료 시 Codex가 이어받고, 복귀 시 안전하게 돌려받는 관제 체계의 입구.
> - **누가 읽나요**: Claude 디스패치·Cowork·Dev 트랙, Codex-Failover-Control, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 전 트랙 공통 (worklog·AGENTS.md·CLAUDE.md 위에 얹는 관제 층)
> - **읽고 나면 알 수 있는 것**: 지금 누가 지휘 중인가 / 각 트랙의 writer·checkpoint는 어디 있나 / 인수·복귀는 어떻게 하나
> - **관련 문서**: [CLAUDE.md](../../CLAUDE.md)(하네스 정본), [AGENTS.md](../../AGENTS.md)(Codex 실행 규약), [worklog](../worklog.md)

## 문서 우선순위 (충돌 시)

1. **CLAUDE.md** — 하네스·도메인·배포 규칙의 정본 (Claude·Codex 공통)
2. **AGENTS.md** — Codex 실행 진입점 (worktree 규칙·공용 계약·직렬 머지)
3. **docs/coordination/** (이 폴더) — 누가 지휘하고 누가 쓰는가 (관제 상태)
4. **docs/worklog.md** — 무슨 일이 있었는가 (사건 로그·보드)
5. 코드 > 문서. 실측 > 기록.

## 이 폴더의 파일

| 파일 | 역할 | 갱신 주체 |
|---|---|---|
| `provider-status.yaml` | Claude/OpenAI 전역 상태 + 현재 지휘자 (트랙별 아님) | 지휘자 교대 시에만 |
| `session-registry.yaml` | 트랙별 writer·branch·SHA·checkpoint (기계 판독) | 각 트랙, checkpoint 시점마다 |
| `dispatch-queue.yaml` | 작업 큐 (feature_owner·file lease·머지 순서) | 디스패치/오케스트레이터 |
| `takeover-runbook.md` | Claude 전체 중단 → Codex 인수 / Claude 복귀 절차 | 불변에 가깝게 |
| `codex-bootstrap.md` | Codex 작업 생성 시 붙여넣는 부트스트랩 프롬프트 | 불변에 가깝게 |

## 조직 (belie 확정 2026-07-19 — "6트랙 유지 + 범용화", Codex의 4트랙 축소안 기각)

**Claude 정상 시**: 사용자 → Claude 디스패치 → Claude Cowork(오케스트레이터) → **TRACK-A~F(6 범용 코드 트랙)** + OPS-CAFE-BOT
**Claude 한도 종료 시**: 사용자 → **Codex-Failover-Control**(비상관제) → **실제 활성 트랙만** Codex 인수 (유휴 트랙은 인수 비용 0)
**복귀 시**: checkpoint → 디스패치 검증 → 트랙 반환 → Codex는 STANDBY

- **A~F 전 트랙 범용** — 고정 전문영역 없음. dispatch-queue의 task 단위 배정 + 작업마다 file lease 선언. lineage(계보 지식)는 배정 참고일 뿐 구역 소유가 아니다.
- **유휴 트랙 = 즉시 투입 예비대** (belie 운영 철학, 실측 근거: R3 스프린트·버그 러시·아이디어 당일 착수). 동시 활성 코드 작업은 머지 큐 부하 기준 4~5 권장(강제 아님).
- **OPS-CAFE-BOT** = 별도 운영 트랙 (로컬 `C:\Users\belie\Desktop\Belief\클로드\projects\salespt-cafe-bot`, 원격 `/opt/bots/salespt-cafe-bot` — 웹앱 `/opt/salespt-log`와 분리)
- worktree·branch는 작업 완료 후에도 함부로 삭제하지 않는다(보존 원칙).

## 절대 원칙 (요약 — 전문은 takeover-runbook)

- 한 파일의 활성 writer는 한 명. 한 트랙의 writer_session도 한 명.
- Claude와 Codex가 같은 트랙을 동시에 수정하지 않는다. 두 지휘자가 동시에 활성이 되지 않는다.
- 비밀값·개인정보를 이 폴더에 기록하지 않는다.
- 추측 금지 — 접근 불가 정보는 `unknown`.
- Cowork(샌드박스)는 git 쓰기 금지 (CLAUDE.md §6.7) — 문서 작성까지만, 커밋은 Dev/Codex 트랙.
- checkpoint는 착수·결정·구현완료·검사·PR·머지 전후·배포·블로커·세션 종료 전마다 갱신 (한도 종료는 예고 없이 온다).

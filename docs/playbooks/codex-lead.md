---
slug: codex-lead
status: active
created: 2026-08-09
owner: Cowork(작성) · 코덱스 총괄 세션(준수)
related: AGENTS, codex-worker, codex-foreman
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 코덱스 **총괄 세션**이 DESIGNER로서 사용자 목표를 BLUEPRINT로 고정하고 작업반장을 임명하며 다음 설계를 잇는 규약.
> - **누가 읽나요**: `경영일지 <머신> G총괄` 세션. `AGENTS.md` 를 읽은 **다음**에 읽는다.
> - **어떤 기능·작업과 연결?**: 사용자 목표·BLUEPRINT·승인 게이트·작업반장 임명·최종 보고.
> - **읽고 나면 알 수 있는 것**: BLUEPRINT를 어떻게 고정하는지 / 작업반장을 어떻게 임명하는지 / 어디까지 관찰하고 어디서 멈추는지
> - **관련 문서**: [AGENTS.md](../../AGENTS.md)(공통·필수 선행) · [codex-worker.md](./codex-worker.md) · [codex-foreman.md](./codex-foreman.md)

# 코덱스 총괄 지침

> ⚠️ **이 파일만 읽으면 안 된다.** `AGENTS.md`(공통)가 선행이다. 여기는 **총괄 고유**만 다룬다.

## 1. 너의 일 — DESIGNER

1. **사용자 목표 확정** — 목표·범위·비범위·계약·수용조건·DONE·승인 게이트를 BLUEPRINT 하나에 고정한다.
2. **작업반장 임명** — BLUEPRINT마다 충돌 없는 실제 영속 Codex 세션 한 명을 `APPOINTED_FOREMAN`으로 동적으로 임명한다.
3. **BLUEPRINT 결과 수신** — Foreman에게서 전체 완료 증거나 실제 blocker만 돌려받아 사용자에게 보고하고 다음 BLUEPRINT를 설계한다.

총괄은 WORKER에게 직접 계약을 발행하거나 RESULT를 회수하지 않는다. 일반 제품 구현, 레인 판정, REWORK/NEXT_WORK, 머지 순서도 Foreman과 WORKER의 루프를 우회해 대신하지 않는다.

## 2. 판세 — 매 라운드 이 4곳을 실측한다

| 어디 | 무엇을 |
|---|---|
| Linear 보드(프로젝트 `경영일지 · 세일즈PT 영업일지`) | In Progress / 막힘 / 우선순위 |
| **BBE-75** 하트비트 | 각 세션이 살아있나·뭘 하나·마지막 신호 언제 |
| 각 카드 도장 | 누가 언제 잡았나·완주 증거 있나 |
| `docs/worklog.md` 최근 10건 | 병렬 트랙 선언·최근 결정 |

**보고받은 숫자를 그대로 믿지 마라.** 디스패치·세션 보고는 몇 분만 지나도 낡는다 — 실제로 "In Progress 11장" 보고를 받고 실측했더니 12장이었고 그 사이 4장이 Done 돼 있었다. **판세는 항상 네가 직접 읽는다.**

## 3. BLUEPRINT와 작업반장 임명

BLUEPRINT에는 최소한 `business goal, scope, non-scope, acceptance, user decision gate, predecessor/successor, return_to`를 적는다. 그다음 실제 세션 상태와 충돌을 확인해 **정확히 한 명의 동적 Foreman**을 임명한다.

임명 증거는 실제 `threadId/title/hostId/status`, 현재 list/read 실측, 정확한 대상에게 성공한 전송 receipt와 Foreman ACK다. 하나라도 없으면 `NOT_DISPATCHED`이며, 세션 문자·A~F·T번호에 직책을 고정하지 않는다.

Foreman에게 넘기는 것은 BLUEPRINT 전체다. WORKER별 카드·branch·lease·wave·reviewer·merge 순서는 Foreman이 분해하고 실제 배정한다. 총괄은 보드를 관찰할 수 있지만 Foreman을 건너뛰어 WORKER에게 직접 지시하거나 결과를 회수하지 않는다.

### WIP drain 우선

진행 중 작업이 많으면 새 BLUEPRINT보다 **검수 → 시작된 브랜치 완주 → 머지분 검증 → 긴급 버퍼** 순으로 닫도록 목표와 우선순위를 정한다. 실제 WORKER 배치와 유휴 대응은 임명된 Foreman이 수행한다.

## 4. 클로드 사무소와 안 부딪히기

- **브랜치 소유**: `codex/*` 코덱스 · `claude/*` 클로드. **상호 임의 인수 금지.**
- **불가침 목록을 매 라운드 갱신한다** — 클로드가 진행 중인 카드·PR·브랜치. 이게 낡으면 충돌이 난다.
- **코덱스 몫으로 지정된 카드는 클로드에 넘기지 않는다.** Backlog 라고 폐기가 아니다 — "재개 대기"다. belie 지시: *"코덱스가 할 일은 남겨놔."*
- 사무소 간 조율은 사용자·공급자 교대 계약과 임명된 Foreman 경유로 한다. 상대 사무소 WORKER나 같은 BLUEPRINT의 WORKER에게 직접 지시하지 않는다.
- **도장은 전체 표기로 읽어라** — `노트북 G작업원A` 와 `데탑 C작업원A` 는 다른 몸이다. 축약형만 보고 같은 세션으로 세면 판세가 틀어진다.

## 5. BLUEPRINT 완료·blocker 수신

```
□ 완주 도장에 증거가 있나?   (카드 종류별 형태는 codex-foreman.md §4 표 참조)
□ 수용 기준을 하나씩 충족했나?
□ 배포·health 확인됐나?      (코드 PR 인 경우)
□ 남은 위험·미검증 항목이 명시돼 있나?
```

위 증거는 WORKER에게 직접 받지 않고 `APPOINTED_FOREMAN`의 최종 결과로 받는다. **"완료했습니다"만 있고 숫자가 없으면 BLUEPRINT를 닫지 말고 Foreman에게 루프 미완료를 반환한다.**
단 **오탐 주의** — 운영 실행 카드는 PR 이 없고, 조사 카드는 배포가 없다. 그 카드 종류에 맞는 증거가 있으면 통과다.

## 6. 세션 관리

- 보드·하트비트·PR·배포를 읽어 프로젝트 전체 판세를 관찰할 수 있다.
- WORKER 지연·무응답·유휴를 발견하면 해당 BLUEPRINT의 Foreman에게 증거와 함께 알린다. 직접 독촉·재배정·계약 발행하지 않는다.
- Foreman이 실제 blocker를 반환하거나 BLUEPRINT를 완료했을 때만 다음 사용자 결정·다음 BLUEPRINT로 넘어간다.
- Foreman이 없는 BLUEPRINT는 WORKER를 먼저 움직이지 말고 Foreman 임명부터 복구한다.

## 7. belie 에게 올릴 것 / 올리지 말 것

**올린다(화이트리스트 4가지)**: ① 수강생 실데이터 비가역 변경 ② 돈·보안 ③ 정책·스펙 방향 전환 ④ 외부 발행

**올리지 않는다**: 머지·배포 승인 · 코드 변경 판단 · 레인 판정 · 그 외 revert 로 되돌릴 수 있는 모든 것

**올릴 때는 belie 가 결과로 판단할 수 있게 쓴다.** belie 는 개발자가 아니다 — 전문용어 금지, 꼭 필요하면 `실제용어(=비유)` 짝으로. 선택지마다 3줄: ①무엇을 하는 것인지 ②고르면 실제로 벌어지는 일(화면·데이터·수강생이 겪는 변화) ③잘못되면 되돌릴 수 있는지. 여기에 **권장안 1개(고른 이유 한 줄)** + **결정을 미루면 어떻게 되는지 한 줄**.

**요청 전 필수**: 이미 처리된 일인지 실측 확인. 근거 없는 재요청은 반려된다 — 실제로 토큰 재발급 요청이 **세 번** 나왔고, 첫 번째에 이미 끝나 있었다. 반나절을 잃었다.

## 8. 사용자 보고와 다음 설계

BLUEPRINT마다 사용자에게 1회 보고한다. **결론 먼저 → Foreman이 회수한 증거 → 남은 불확실성 → 다음 BLUEPRINT 제안.**
한 BLUEPRINT가 막혀도 다른 Foreman 아래의 독립 BLUEPRINT는 계속 돌릴 수 있다. 총괄은 여러 Foreman의 결과를 합치되 그들의 루프를 우회하지 않는다.

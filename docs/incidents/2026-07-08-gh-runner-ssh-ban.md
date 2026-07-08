> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: GH Actions 러너→VPS:22 간헐 차단으로 아레나 backfill 3연속 실패·배포 attempt 실패 — VPS 로컬 원인은 실측 배제, 제공사 edge 차단으로 판정, 워크플로 재시도 내장 + PC 직행 경로로 수렴.
> - **누가 읽나요**: 개발자, 에이전트 (배포·ops 워크플로 rc=255 실패 시)
> - **어떤 기능·작업과 연결?**: `.github/workflows/deploy.yml`·`db-backfill.yml`, docs/plans/active/db-pilot-arena.md
> - **읽고 나면 알 수 있는 것**: rc=255 반복 시 어디까지가 우리 서버 문제인가 / 무엇을 확인하고 무엇은 확인 불가인가 / 수렴 경로는 무엇이었나
> - **관련 문서**: docs/incidents/2026-07-07-deploy-426-vps-unreachable.md (같은 계열 선행 사고), docs/playbooks/deploy-vps.md §0

# 2026-07-08 — GH 러너→VPS:22 간헐 차단 (backfill 3연속 실패)

## 타임라인 (KST)
- 오전~낮: #491(R2-1)·#492(R2-1.5) 파이프라인에서 배포 attempt 실패 산발 — 모두 `ssh: connect ... port 22: Connection timed out`(rc=255), rerun 으로 success.
- #492 후속 아레나 backfill(DB Backfill 워크플로): execute#1 부분성공(1,035/1,083행, sales 5시트 429 스킵) 후 재실행 **3연속 rc=255 단발 실패**(당시 워크플로엔 재시도 없음).
- Cowork 실측: 포트22 가 **belie PC 에선 열림 / GH 러너에서만 타임아웃** → GH IP 대역 선별 차단 추정.
- 14:3x: PC→VPS 직접 SSH 로 backfill 수렴 착수(본 PR 트랙) + 워크플로 재시도 내장.

## 원인 판정 (2026-07-08 VPS 실측 — PC 직접 SSH)
VPS(srv1589249) 안에서 확인한 것:

| 후보 | 실측 | 판정 |
|---|---|---|
| fail2ban | `fail2ban-client` **미설치** | ❌ 원인 아님 |
| ufw | `Status: inactive` | ❌ 원인 아님 |
| iptables | INPUT 체인 비어 있음(policy ACCEPT) | ❌ 원인 아님 |
| sshd 설정 | MaxStartups 기본값(10:30:100), 거부 로그 특기사항 없음 | ❌ 원인 아님 |

→ **VPS 로컬에는 차단 주체가 없다.** "Connection timed out"(reset 아님) = 패킷이 서버에 도달하지 못함.
**판정: 제공사(edge) 네트워크 계층의 간헐 차단** — GH/Azure IP 대역에 대한 rate-limit/DDoS 보호 추정.
제공사 콘솔은 에이전트 접근 밖 — 재발·장기화 시 belie 가 제공사 방화벽/보안 설정 확인.

## 복구 확인
- #493(ddc813f)·#494(8e089b8) 배포가 GH 러너 경로로 **연속 conclusion=success** → 차단은 간헐(창 단위)이며 자연 해소됨. run#426(7/7)과 동일 계열.

## 재발 방지 (본 PR)
1. **db-backfill.yml 에 rc=255 한정 재시도 7×30s 내장** — deploy.yml 과 동일 패턴(#486). 스크립트 실패(다른 rc)는 즉시 fail(멱등 재실행으로 수렴).
2. **backfill 은 PC→VPS 직접 SSH 대체 경로 확보** — GH 경로 차단 창에도 수렴 가능(이번에 A1-0~A1-6 전체 재실행으로 수렴, 증빙 = PR #492 코멘트 대조표).

## 교훈
- rc=255 반복 = 십중팔구 **네트워크 창 문제**, 서버 고장 아님 — VPS 로컬(fail2ban/ufw/iptables/sshd) 배제를 먼저 실측하면 "서버 손대는" 오진을 막는다.
- 성공 판정은 여전히 `gh run view --json conclusion` 문자열만 (7/7 사고 교정 유지).

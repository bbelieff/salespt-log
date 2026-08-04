---
slug: foreman-linear-ops-r1
status: active
created: 2026-08-05
owner: FM(260804)
related: worklog, db-write-flip, r3-single-cell-writers
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 경영일지 개발을 "작업반장(FM) 1명 + Linear 배차판 + A~F 트랙 워커" 체제로 돌리기 위한 설계도 — Linear 구조·카드 목록·트랙 매핑·라운드1 배분안까지.
> - **누가 읽나요**: belie(승인), 반장 세션, 모든 워커 세션, Cowork(디스패치)
> - **어떤 기능·작업과 연결?**: 전체 트랙 공통 운영(CLAUDE.md §3·§3.5·§6.8) · Linear 프로젝트 「경영일지 · 세일즈PT 영업일지」
> - **읽고 나면 알 수 있는 것**: 반장이 무엇을 생산하나 / Linear 를 어떻게 쓰나 / 지금 병렬로 돌릴 수 있는 일은 무엇인가
> - **관련 문서**: `docs/worklog.md`(보드·디스패치) · `docs/plans/active/db-write-flip.md`(R3 SoR) · CLAUDE.md §3.5 병렬 규약

# 반장(FM) 체제 + Linear 배차 — 설계도 R1

**상태: 제안 (belie 승인 대기).** 이 문서 머지 = 설계 공개일 뿐, **Linear 쓰기·워커 배차는 승인 후 실행**한다.

---

## 0. 쉬운 말 요약 (belie 승인용)

- **지금까지**: 창(세션)마다 belie 가 직접 프롬프트를 넣어 일을 시켰다. 창이 늘수록 belie 손이 늘었다.
- **바꾸는 것**: 창 하나를 **작업반장**으로 세운다. 반장은 일을 **쪼개서 계약서(누가·어디 파일·언제 끝·무엇을 하면 합격)** 로 만들고, 디스패치가 그 계약서를 워커 창에 전달한다. belie 는 **승인만** 한다.
- **Linear 는 배차판**이다 — 누가 어느 일을 잡고 있는지, 무엇이 무엇 때문에 막혔는지 한 화면. **코드 정본은 GitHub, 현장 기록 정본은 레포 문서**. Linear 가 틀리면 레포가 이긴다.
- **안전장치는 그대로**: 병렬로 만들되 **합치는 건 한 번에 하나**, 합친 뒤 배포·사이트 정상까지 확인해야 그 일이 "끝"이다.
- **되돌리기**: Linear 프로젝트는 보관(archive) 한 번이면 원상. 이 문서도 revert 한 번.

---

## 1. 역할 정의 (4층)

| 층 | 누구 | 하는 일 | 하지 않는 일 |
|---|---|---|---|
| 결정 | **belie** | 킥오프 승인·화이트리스트 4종(실데이터·돈/보안·정책방향·외부발행) 결정 | 프롬프트 작성·진행 관리 |
| 반장 | **FM 세션(이 창)** | 실측 → 카드 분해 → **계약 생산** → 레인 충돌 판정 → 직렬 머지 순서 통제 → 완료 회수·장부 기록 | 대형 기능 직접 구현(문서·장부·소형 fast lane 은 직접 가능) |
| 배차 | **디스패치(Cowork)** | 워커 코드세션 생성·계약 전달·완료 회수, Linear 미러 동기화 | 계약 내용 창작(반장 몫) |
| 실행 | **워커 A~F 세션** | 계약 1건 = PR 1건 완주(§4 체크 → PR → 머지 → §6.8 배포 확인) | 계약 밖 파일 수정, 자기 판단 머지 순서 변경 |

**계약(contract) 필수 8항목** — MoaWork(BBE-34) 양식 준용:
`task_id` · `base`(정확한 SHA) · `branch` · `worktree` · `owner`(트랙+몸) · `reviewer` · `blocked_by` · `file lease`(수정 허용 파일 목록) + **수용 기준** + **NOT_RUN 경계**(이 세션이 절대 안 하는 것: 실데이터 쓰기·VPS 접속·모바일 실기기 등).

---

## 2. Linear 구조 — 새 팀(SPT) vs 기존 팀(BBE) 아래 프로젝트

**실측(2026-08-05)**: 워크스페이스 팀 1개(`Bbelieff`/BBE). 프로젝트 2개 — 「경영일지 · 세일즈PT 영업일지」(카드 BBE-35~40), 「MoaWork · 운영 안정화 및 어드민」(BBE-1~34). 라벨 `사무소:클로드코드/코덱스/Cowork` + `belie결정` 이미 존재.

| | A안 — 기존 BBE 팀 + 현 프로젝트 유지 **(권장)** | B안 — 새 팀 SPT 신설 |
|---|---|---|
| 번호 | BBE-39 처럼 두 사업이 번호를 나눠 씀(제목으로 구분) | SPT-1… 로 접두어부터 구분 |
| 이관 비용 | **0** — 카드 6개 그대로 | 기존 6장 재생성 → **번호·링크 전부 깨짐**, worklog 참조도 수정 |
| belie 화면 | 한 팀 안에서 두 프로젝트 전환 = 한 화면 | 팀 전환 필요(왔다갔다) |
| 워크플로 | 상태·사이클을 MoaWork 와 공유 | 팀 단위 상태/사이클/자동화 독립 |
| 위험 | 카드가 많아지면 목록이 섞여 보임 → 프로젝트 필터로 흡수 | 초기 설정·규칙 이중 관리 |

**권장 = A안.** 근거: 지금 카드가 6장뿐이라 B안의 유일한 이득(번호 구분)보다 이관 손실(링크 깨짐 + worklog 재작성)이 크다. 프로젝트 필터 하나로 화면은 이미 갈린다.
**B안 승격 트리거(미리 못박음)**: ① 경영일지 활성 카드가 상시 25장 이상 ② 사이클(스프린트)을 MoaWork 와 다른 주기로 돌려야 할 때 ③ 워커 계정을 사업별로 분리할 때 — 셋 중 하나면 그때 팀 분리.

### 카드 규격 (A안 확정 시)
- **1 카드 = 1 계약 = 1 PR.** PR 2개 이상 예상되면 하위 이슈로 쪼갠다(부모 = 묶음).
- **본문 = 계약 8항목 + 수용 기준 + NOT_RUN**(위 §1). 본문이 곧 워커에게 복붙되는 프롬프트.
- **상태 매핑(팀 공용 상태 재사용)**: `Backlog`=대기/블로킹 · `Todo`=계약 발급됨(착수 가능) · `In Progress`=워커 착수 · `In Review`=PR 오픈 · `Done`=**머지+배포 success+health 200 까지 끝난 것만**(§6.8 미완주 Done 금지).
- **라벨 3종 축**: `트랙:A`~`트랙:F`·`트랙:FM` / `사무소:클로드코드·코덱스·Cowork·belie결정`(기존) / **`lane:<구역>`**(신설 — 아래 §3).
- **의존성**: Linear `blocked_by` 로 연결. belie 액션 대기는 전부 BBE-35 를 blocker 로 건다.

---

## 3. 트랙 A~F 를 Linear 에서 쓰는 법

| 개념 | 정의(불변) | Linear 표현 |
|---|---|---|
| **트랙** | 역할·구역의 **불변 문자**(A~F, R, FM) | **라벨** `트랙:X` |
| **카드** | 작업 단위 = 계약 1건 = PR 1건 | **이슈** |
| **세션(몸)** | 소모품. 50MB마다 교체 | 이슈 본문 `owner: DevA(260803)` 한 줄 — 교체 시 그 줄만 갱신(승계 선언은 worklog) |
| **구역(file lease)** | 동시에 두 손이 못 대는 파일 묶음 | 라벨 `lane:*` + 본문 file lease |

**lane 라벨 초안(구역 = 충돌 단위)**
`lane:repo-db`(lib/repo/db·service 쓰기경로) · `lane:sheets-io`(lib/repo/*.ts 시트 I/O) · `lane:ui-contact`(app/(app)/contact·components) · `lane:ui-admin`(app/(app)/admin·app/api/admin) · `lane:deploy`(.github·scripts·Caddyfile) · `lane:docs`(docs/·worklog) · `lane:arena`(arena 계열 — 현재 코덱스 점유)

**철칙: 같은 `lane:` 라벨 카드는 동시에 `In Progress` 금지.** 반장이 배차 전 검사한다(겹침이 애매하면 겹치는 것으로 간주 — CLAUDE.md §3.5-1 그대로).
**공용부**(`lib/types`·`lib/config`·SSOT 4문서·`scripts/`·`.github/`)는 어떤 lane 도 소유하지 않는다 → 변경이 필요하면 **그 변경만 단독 PR 로 먼저 머지**(§3.5-2).

**정본 경계 (틀어지면 이 순서로 이긴다)**
1. **GitHub** = 코드·머지·배포 사실
2. **레포 문서**(`docs/worklog.md` 현장일지 · `docs/plans/` 설계)
3. **Linear** = 점유·의존성·상태 **미러**. Linear 만 아는 사실은 만들지 않는다.

---

## 4. 카드 목록 (실측 기반 · 우선순위·의존성 포함)

기준 실측: `origin/master = e09ee33`(2026-08-03 16:03 UTC 배포 run `30830372094` success, health 200) · Open PR **0** · 머지 큐 비어 있음.

### 4-1. 이미 Linear 에 있는 것 (6장 — 유지)

| 카드 | 내용 | 우선 | blocked_by | 조치 |
|---|---|---|---|---|
| BBE-35 | 📥 belie 결정함(액션 4건) | High | — | 유지. 아래 신규 belie 항목 흡수 |
| BBE-38 | DevF · #596 재검증 대응 | Medium | — | **라운드1 투입** |
| BBE-39 | R3-3 contracts+company_archive | High | BBE-35 | 설계도 1호 선행(FM-01) |
| BBE-40 | DevE · 배포 admin 토큰 | Medium | BBE-35 | 시크릿 등록 시 즉시 |
| BBE-36 | AR-2b arena(코덱스) | — | — | 관찰만, `lane:arena` 점유 표시 |
| BBE-37 | R6 통합 HOLD(#647) | — | migration GO | HOLD 유지 |

### 4-2. 신규 카드 제안 (11장 — 승인 후 생성)

| # | 제목 | 트랙 | lane | 우선 | blocked_by | 근거(실측) |
|---|---|---|---|---|---|---|
| N1 | 장부 정합 — 머지 5건 로그 미기재 + Cowork 디스패치 미커밋 | FM | docs | High | — | #654·#656·#657·#658·#659 가 worklog 로그에 없음. Cowork 디스패치 v2 는 로컬에만 있었음 → **이 PR 로 해소** |
| N2 | 반장 체제 규약을 CLAUDE.md §3.6 으로 명문화 | FM | docs | Medium | 이 설계도 승인 | 규칙은 문서에 박혀야 규칙(§6 "컨텍스트에만 있는 규칙 금지") |
| N3 | 모바일 날짜달력 P0-2 라이브 확인 | F 또는 QA | ui-contact | High | — | #654·#656 머지·배포 success. 실화면 확인 기록 없음 |
| N4 | #648 chip · #649 `/admin/cohorts` probe 육안 확인 | belie | — | Medium | BBE-35 | A(260803) 가 "belie 몫" 으로 남긴 잔여 2건 |
| N5 | #605 close | belie | — | Low | BBE-35 | DevD residual |
| N6 | DevA full 인수왕복 1회 실연 | D | docs | Low | — | DevD W0-C residual(비차단) |
| N7 | gcal pm2 로그 무기록 인프라 조사 | B | deploy | Medium | VPS 접근 | B 줄 잔여 = "pm2 침묵 인프라(VPS 필요)" |
| N8 | **R3-3 설계도 1호 작성**(결정 포인트 3개 포함) | FM | docs | High | — | BBE-39 착수의 선행. 결정 = ①퍼널 계약수 해지 반영 ②진짜 flip(B안 재키잉) 여부 ③오염행 리페어 스크립트(파일럿 표시 숫자 변경) |
| N9 | R3-3 잔여 구현(수납 1~3단계·이월깃발·TXT 내보내기 DB 기준) | A | repo-db | High | N8 + belie 킥오프 | `db-write-flip.md §6 R3-3` — PR-1/PR-2 는 이미 머지, 잔여만 남음 |
| N10 | R6 HOLD 해제 조건 명문화(migration GO 기준) | R/FM | docs | Medium | belie | HOLD 상태가 "언제 풀리는지" 문서에 없음 |
| N11 | arena 시즌 개막 체크리스트 실행(#657 스크립트) | R(코덱스) | arena | Medium | 코덱스 진행 | 우리는 관찰만 — 구역 충돌 금지 |

---

## 5. 라운드 1 배분안 (지금 병렬 가능한 것)

**레인 충돌 분석**: 세 레인이 만지는 파일 교집합 **0**. `docs/worklog.md` 만 공통이나 append 전용(§3.5-2 예외). 코덱스가 점유 중인 `lane:arena`(lib/repo/course-dates.ts·scripts/ops·app/api/admin/create-arena-members) 는 **세 레인 모두 접근 금지**.

| 레인 | 카드 | 담당 | 파일 구역 | 병렬 |
|---|---|---|---|---|
| L1 | N1 장부 정합 + 이 설계도 | FM(이 창) | `docs/` 만 | ✅ (진행 중 = 이 PR) |
| L2 | BBE-38 #596 재검증 | DevF 새 몸 | 재현·검증 중심(코드 변경 시 lease 협의) | ✅ |
| L3 | N3 날짜달력 라이브 확인 | DevF 또는 신규 QA 몸 | **읽기 전용**(코드 0) | ✅ |
| — | N8 R3-3 설계도 1호 | FM(L1 다음) | `docs/plans/` | 직렬(L1 뒤) |

**직렬 머지 순서**: ① L1(이 PR) → ② L2(#596 결과 문서/코멘트) → ③ L3(확인 기록). 각 머지 후 §6.8(배포 success + health 200) 완주 확인 뒤 다음.
**블로킹 유지**: BBE-40(시크릿) · BBE-39/N9(belie 킥오프) · N7(VPS) · BBE-37(migration GO).

### 5-1. 계약 초안 3건 (승인 후 그대로 복붙 배차)

```
task_id: FM-LEDGER-RECONCILE-01     (레인 L1 — 이 PR 로 실행 중)
base: origin/master@e09ee33 · branch: docs/foreman-linear-ops
worktree: wt/foreman-linear-ops · owner: FM(260804) · reviewer: belie
blocked_by: none
file lease: docs/plans/active/foreman-linear-ops-r1.md(신규) · docs/worklog.md(append+FM 줄)
수용 기준: check.sh 초록 · PR 머지 · 배포 success · health 200 · 보드에 FM 줄 등재
NOT_RUN: lib/·app/·components/ 일절 수정 없음 · Linear 쓰기 없음(승인 전) · 실데이터 접근 0
```

```
task_id: F-596-REVERIFY-01          (레인 L2)
base: origin/master@e09ee33 · branch: docs/pr596-reverify (코드 수정 발생 시 fix/ 로 재발급)
worktree: wt/pr596-reverify · owner: DevF(신규 몸) · reviewer: DevD(게이트키퍼)
blocked_by: none
file lease: docs/worklog.md(append) · (코드 수정 필요 판명 시 반장에게 lease 재요청)
수용 기준: 연습용 3증상이 라이브에서 해소됐는지 재현 절차대로 확인 → #596 코멘트 + worklog 기록
NOT_RUN: 수강생 실데이터 수정 · 시트 쓰기 · VPS 접속 · 다른 lane 파일 수정
```

```
task_id: QA-DATEPICKER-LIVE-01      (레인 L3)
base: origin/master@e09ee33 · branch: (읽기 전용 — 브랜치 없음, 결과는 worklog 1줄)
owner: DevF 또는 신규 QA 몸 · reviewer: FM
blocked_by: none
file lease: docs/worklog.md(append) 만
수용 기준: 모바일 폭에서 미팅예약·컨택 날짜 입력이 실제로 열리고 저장되는지 확인(#654·#656 머지분), 결과 기록
NOT_RUN: 코드 수정 · 실데이터 저장(테스트 계정/취소 경로만) · 배포 조작
```

---

## 6. belie 승인이 필요한 것 (이 문서의 결정 포인트)

1. **Linear 구조 = A안(기존 BBE 팀 유지)** 으로 확정할지 — 권장 A. (B안이면 카드 번호가 바뀐다)
2. **신규 카드 11장 생성 승인** — 승인 시 반장이 Linear 에 직접 생성(MCP 연결 확인됨).
3. **라운드 1 배차 승인**(L2·L3 워커 창 2개 생성 요청) — L1 은 이미 진행.
4. 나머지 3건은 기존 📥 결정함 그대로: 시크릿 등록 · R3-3 킥오프 · #605 close.

---

## 7. Log

- 2026-08-05 FM(260804) 취임. 실측(`origin/master=e09ee33`·Open PR 0·health 200) 후 이 설계도 작성.
  Linear MCP 이 반장 세션에 **연결됨** — 팀 1개(BBE)·프로젝트 2개·카드 BBE-35~40 직접 조회 성공.
  **Linear 쓰기는 §6 승인 전까지 0건**(읽기만 수행).

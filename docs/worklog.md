> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 모든 세션(Cowork·Claude Code)이 공유하는 작업 일지 — 세션 시작 시 읽고, 끝날 때 쓴다. 핸드오프 문서를 대체한다.
> - **누가 읽나요**: 모든 에이전트 세션(필수), 운영자(belie)
> - **어떤 기능·작업과 연결?**: 전체 트랙 공통 (CLAUDE.md §3 작업 규약 0단계)
> - **읽고 나면 알 수 있는 것**: 지금까지 무슨 일이 있었나 / 이번 요청이 어느 트랙의 연장인가 / 다음에 하기로 한 것은 무엇인가
> - **관련 문서**: CLAUDE.md §3·§5.5, docs/plans/active/* (각 트랙 SoR)

# 세션 워크로그 (Session Worklog)

## 프로토콜 (모든 세션 의무)

**시작할 때 (읽기)**
1. 아래 로그의 **최근 항목 5~10개**를 읽는다.
2. 지금 받은 요청이 **어느 트랙의 연장인지, 이전 결정과 충돌하지 않는지** 한 번 사고한 뒤,
   작업 첫 응답에 한 줄로 선언한다. (예: "이 작업은 R2 읽기 전환 트랙의 2호 PR입니다")
3. 상세가 필요하면 항목의 SoR 링크를 따라간다. 워크로그는 **지도**, 상세는 SoR에.

**끝날 때 (쓰기)**
- 작업 종료, 중요한 결정, PR 머지, 사고(incident) 시 **맨 위에** 항목을 추가한다.
- 형식 (한 항목 3~8줄, 초과 금지 — 길어지면 SoR 문서에 쓰고 링크만):

```
### YYYY-MM-DD · 트랙(버전) · 한줄 제목    ← 예: A(260712), M(260703), Cowork
- 의도: 사용자가 왜 시켰나
- 한 것: 결과 중심 (PR#, 검증 결과, 생성물)
- 결정: 새로 확정되거나 뒤집힌 것 (없으면 생략)
- 다음: 남긴 것, 차기 세션이 이어받을 것
- SoR: 상세 문서 경로
```

**트랙·세션 규칙 (2026-07-12)**
- **트랙 = 불변의 역할 문자**(아래 활성 트랙 보드). **세션 = 50MB마다 교체되는 소모품(몸)** —
  로그의 주어는 세션이 아니라 트랙. 버전 = 그 몸의 시작일 YYMMDD(같은 날 2개면 -2).
- 세션 교체(승계): 새 몸은 worklog 최근 항목 + 자기 트랙의 선언·plan 을 읽고
  첫 응답에 "트랙 X 승계(구버전→신버전)" 선언. **구역 소유권은 트랙에 귀속** — 재선언 불필요.

**유지 규칙**
- 새 항목은 항상 맨 위 (최신순).
- 항목 40개 초과 시 오래된 것을 `docs/worklog-archive/YYYY-MM.md` 로 이동.
- 비밀값(비밀번호·토큰·URI) 절대 기록 금지.
- 이 파일은 append 전용에 가깝게 — 과거 항목 수정은 오기 정정만.
- 활성 트랙 보드는 예외적으로 갱신 가능 — 단 **자기 트랙 줄만** 수정.

---

## 활성 트랙 보드 (자기 줄만 갱신 — 라이브 현황판)

**보드 갱신 규칙 (2026-07-12)**: 프롬프트(디스패치) 수령 즉시 자기 줄 상태를 "착수: <작업명>"으로
갱신하고, 이후 **단계 통과마다** 갱신한다. 단계 어휘(정본, %는 선택 병기):
`착수 → 진단/설계 → 구현 → 테스트 초록 → PR 오픈 → 머지 → 배포 확인(완료)` + `⛔블로킹: <사유>`.
로그 항목은 착수 선언·완료·사고·중요 결정에만 추가(진행률로 로그 도배 금지) —
**보드 = 지금 뭐 하는지(덮어쓰기), 로그 = 무슨 일이 있었는지(추가만).**

| 트랙 | 역할·구역 | 현재 몸(버전) | 상태 |
|---|---|---|---|
| A | 메인 로드맵(R3 쓰기 전환) — lib/repo/db·service 쓰기 경로 | DevA(260803) | **배포 확인(완료)** — 2건 모두 §6.8 완주: **#652**(`80c94bb`·run `30797733939` success) 보드·계획서 정합, **#653**(`d9ce8eb`·run `30799167984` success) 8/2 배포 실측 반영. 둘 다 health 200. `gh` 설치 확인됨(직전 "미설치" 제약 해소). 레포 경로 이동: `Desktop\개발프로젝트\경영일지`. **문서 정합 트랙 종료 — 신규 작업 대기.** R3-3(contracts+company_archive) **착수 금지 유지 — belie 상세 프롬프트 대기**. 이하 이전 상태: 배포 확인(완료) — #537 R3-2 write-path 테스트갭 해소(todos 15케이스·머지 469a61b·배포 success[rerun]·health 200). 디스패치 "테스트갭 R3-3 포함"은 #537로 **선완료**(재포함 불필요). R3-3(contracts+company_archive) 착수 대기 — belie 상세 프롬프트 대기 |
| B | gcal 트랙 승계(카나리아·버그수정·QA) — gcal-event-ids/identity 계열 | DevB(260703) | **머지 완료(#538, `274042a`)** — gcal 라우트 6개 withApiTiming 계측. ※ 구 상태 "PR 오픈·belie 승인 대기"는 stale 이었음(2026-08-03 A(260803) 실측 정정 — master 로그에 존재). 잔여=pm2 침묵 인프라(VPS 필요). 신규 작업 대기 |
| C | 수납: 계약해지 — contract-payment 계열 + 실무/수납 화면 | DevC(260712-2) | **완료(종료)**: belie ①read-only close 확정(2026-07-12) → 마감 절차 실행(plan 2건 completed 이동·worklog 마감·보드 갱신). 스펙 #529~534 MERGED·배포 success·health 200·코드층 재검증 OK. 02 구역 소유권 A(R3-3)로 이관. 유보=퍼널 계약수 해지반영(belie 별도) |
| D | 게이트키퍼(R3·codex 판정) + R4 wave-0 선행(W0-C) — docs/coordination·worklog 장부 | DevD(260721) | **W0-C 완료(2026-07-24)**: ①R3 재판정=코드레벨 PASS(L4 append-silent → #598 union fallback 종결) ②codex-stability=**STABLE**(#612, 2 blocker 해소·§C.5 전면소진 relay 주체 명문화) ③F 실측=EOL #603·발굴피커 #591 완주·TRACK-F ready → **R4 wave-1 선행 3건 초록**. residual(비차단)=#605 close(belie)·A full 인수왕복 1회 실연. 신규 작업 대기 |
| E | 배포설정: admin 토큰 주입 — deploy.yml·playbooks | DevE(260712) | ⛔belie 대기: `gh secret list` 재확인 = ADMIN_DRIVE_REFRESH_TOKEN 미등록(선행조건 미충족) → 수용항목2(배포 주입로그 확인·기수 왕복) 착수 불가. 등록되면 즉시 재개. 03 유령진단=무혐의(재검증 OK) |
| F | KPI-④ EOL renormalize (막차) — .gitattributes | DevF(260712) | **배포 확인(완료)** — #603(1aa3b9a) 머지·배포 success·health 200. §0.5 진단: 저장소 이미 LF(index i/crlf 0건), 720파일=autocrlf 작업트리 착시 → `.gitattributes`로 LF 정책 기계강제(내용 무변경 실측). 다음=#596 D 재검증 대응 대기 / 큐 신규. 🔔#596 D 재검증 요청 유효(연습용 3증상 라이브 해소 확인) |
| R | 릴리스 계열(C1~C3·PR643 복구 등, 노트북 Codex 세션 work-id) — 단발 릴리스 후보 | 세션 불명(노트북) | **배포 확인(완료)** — #647~#651 다섯 건 모두 "Deploy to VPS" **success** 실측(2026-08-03 A `gh` 조회): #647 `30737985008` · #648 `30734464895` · #649 `30734149383` · #650 `30739988555` · #651 `30739460991`. 계획서 4건 `completed/` 이관 완료. #647 R6 통합은 **[HOLD] 머지** → migration GO 전까지 plan active 유지. #643 arena 시즌 SSOT 는 AR-2b 진행 중 |
| Cowork | 오케스트레이터 — 프롬프트 생산·게이트 검증·워크로그 관리 | Cowork | 상시 |

> **보드 정합 실측 (2026-08-03 · A(260803))** — 이 보드는 260712 이후 갱신이 멈춰 있었고,
> 그 사이 노트북 세션들이 #643·#645~#651 을 머지했다. 위 A·B 줄과 신설 R 줄이 실측 반영분이다.
> 실측 근거: `origin/master=6380916`(2026-08-02 17:32 KST), 공개 health 200.
> ⚠️ 아래 디스패치 블록은 **260712 판**이라 여전히 stale — Cowork 만 수정 가능하므로 갱신 요청 상태.
> ✅ **배포 run 실측 완료 (2026-08-03 · A(260803))** — `gh` 설치 확인 후 조회.
> #647~#651 다섯 건 전부 "Deploy to VPS" success, 보드 정합 PR #652(`80c94bb`)도 success + health 200.
> 이전 줄의 "배포 run 미확인" 경고는 해소됐다.

> 2026-07-12 표기 개편: 트랙 문자 = 세션 문자(DevA~F)로 통일. 구 표기 매핑 —
> M→A(구 Dev2), 수납A→C(구 Dev3-A), 리포트B→D(구 Dev3-B), 배포C→E(구 Dev3-C), G→F(구 45열).
> 이전 로그 항목의 [병렬트랙 A/B/C]는 구 표기다 — 혼동 시 이 매핑을 참조.

## 📮 오케스트레이터 디스패치 (각 트랙: 보드 갱신하러 올 때마다 자기 줄 확인 — Cowork만 수정)

- **공통(260712 fable 갱신, 05:00 UTC)**: belie 복귀. Open PR 0·최신 배포 #477 success·health 200
  (Cowork 재실측). 직렬 머지 + §6.8 엄수.
- **DevA**: **R3-3(contracts+company_archive 쓰기 전환) 착수** — 상세 프롬프트는 belie가 전달.
  C 트랙 종료 결정(read-only close)으로 02 구역 소유권 해제 — 단 DevC 마감 커밋(plan 이동)과의
  worklog 충돌만 주의. R3-2 테스트갭(write-path 단위테스트 0건) 보강을 R3-3에 포함.
- **DevB**: gcal pm2 로그 무기록 조사 진행 중(보드 자체 착수 확인) — 계속. 중복 지시 없음.
- **DevC**: **belie 결정 = ①read-only close 확정(2026-07-12)**. 쓰기 카나리아 없이 트랙 종료 —
  마감 절차(plan completed 이동 + worklog 마감 항목 + 보드 갱신) 실행. 유보 1건(퍼널 계약수
  해지 반영)은 belie 별도 결정 항목으로 이관.
- **DevD**: **언블록** — Cowork가 PostHog raw 추출 완료 → `scratchpad/db-speed-raw-2026-07-12.md`
  (표1 route별 전/후 + 표2 todos·dashboard 일자별 + 재현 HogQL). 비교표+미달원인 작성 →
  PR #491·496·499·500·509 코멘트 + worklog 완료 요약.
- **DevE**: belie 복귀 — 대기 3건(Secret 등록·기수왕복·DB비번)은 belie 직접 작업. 완료 신호 후 재개.
- **DevF**: 신규 작업 배정 대기.

## 로그

### 2026-08-03 · A(260803) · 레포 이동 승계 + §6.8 완주(#652) + 8/2 배포 실측
- 의도: 폴더 이동으로 끊긴 직전 세션을 이어받아, 미완이던 §6.8(PR→머지→배포 관찰→health)을 끝내고 8/2 머지분의 "배포 미확인" 잔여를 없앤다.
- 실측(GitHub 정본 우선): 새 레포 경로 `C:\Users\Belief-desktop\Desktop\개발프로젝트\경영일지`. 브랜치 `docs/board-plan-reconcile`(`03998ef`)은 origin 에 **푸시만 되어 있고 PR 은 없었다** → 중복 작업 없이 PR 부터 생성.
- 한 것: **PR #652 생성 → 체크 2/2 초록 → squash 머지 `80c94bb` → 배포 run `30797733939` success → health 200**(§6.8 완주). 8/2 머지분 #647~#651 다섯 건의 "Deploy to VPS" run 을 `gh` 로 조회해 **전부 success** 확인, 계획서 5건의 "미확인 잔여: 배포 run conclusion" 주석을 run ID 실측으로 교체.
- 결정: `gh` 는 설치되어 있었다 — 직전 세션의 "`gh` 미설치" 제약은 **해소**. 이동으로 깨진 워크트리 등록은 `git worktree repair` 로 새 경로에 재연결(`wt/docs-board-reconcile`, 삭제하지 않고 보존).
- 마감 실측(사후 추가): 이 항목의 후속 PR **#653 = `d9ce8eb`, 배포 run `30799167984` success, health 200** — 문서 정합 트랙 종료.
- 다음: **R3-3(contracts+company_archive) 착수 금지 유지 — belie 상세 프롬프트 대기.** 남은 잔여는 인증 화면 육안 확인 2건(#648 chip · #649 `/admin/cohorts` probe)뿐 — belie 몫.
- SoR: 이 항목 + `docs/plans/completed/{pr643-admin-cohorts-p0, stats-period-label, admin-formula-restore-c2-r1, windows-dev-watch-einval-c3-r2}.md` + `docs/plans/active/r6-current-master-integration-r1.md`

### 2026-08-03 · A(260803) · 데스크탑 승계 + 보드·계획서 정합
- 의도: belie 결정(1A). 데스크탑 신규 몸 승계 직후, 260712 에서 멈춘 활성 트랙 보드와 8/2 머지 실적의 괴리를 먼저 해소한다.
- 실측: `origin/master=6380916`(동기 0/0, worktree 0), 공개 health 200. 로컬 typecheck·구조 25/25·**check.sh PASSED**. Node v24.18.1 / npm 11.16 / git 2.55, node_modules 745(Windows 바이너리, 리눅스 잔재 0).
- 한 것: 보드 A 승계 갱신 · B stale 정정(#538 은 이미 머지 `274042a`) · 릴리스 계열 R 줄 신설. 완료 계획서 4건(#648·#649·#650·#651) → `docs/plans/completed/` 이관 + 각 문서에 종료 기록 추가.
- 판단: `r6-current-master-integration-r1`(#647)은 **[HOLD] 머지**라 migration GO 전까지 active 유지. `arena-season1-setup` 은 명단·규칙 상시 SoR + AR-2b 진행 중이라 유지.
- 제약: `gh` 미설치 → PR 오픈·배포 run 관찰(§6.8) 불가. 브랜치 `docs/board-plan-reconcile` + 커밋 + check.sh 초록까지만 완주하고 정지. 과거 머지분의 deploy run 성공 여부도 같은 이유로 미확인(health 200 대체).
- 다음: belie 가 `gh` 설치 → PR → §6.8 완주. **R3-3 은 착수 금지 유지(belie 상세 프롬프트 대기).** 디스패치 블록 갱신은 Cowork 몫.
- SoR: 이 항목 + `docs/plans/completed/{windows-dev-watch-einval-c3-r2, admin-formula-restore-c2-r1, pr643-admin-cohorts-p0, stats-period-label}.md`

### 2026-08-02 · C3-R2 · Windows Node 22 dev watcher EINVAL 수정 착수
- 의도: `npm run dev`가 `npx.cmd + shell:false`에서 EINVAL로 종료되는 Windows 개발 경로를 복구
- 한 것: 최신 master 전용 worktree에서 Windows 전용 shell 사용과 실제 `npx.cmd` 회귀 테스트를 최소 범위로 구현
- 결정: POSIX `shell:false`와 `windowsHide:true`는 유지하고 운영 앱·DB·Sheets·배포면은 변경하지 않음
- 다음: focused/typecheck/check/build 및 독립 검수 후 draft PR로 게시
- SoR: `docs/plans/active/windows-dev-watch-einval-c3-r2.md`

### 2026-08-02 · ADMIN-FORMULA-RESTORE-C2-R2 · current-master release candidate 준비
- 한 것: `origin/master=3b500960`을 merge하고 worklog append만 양쪽 보존했다. 제품 충돌은 없고 후보 delta는 route·setup-formulas·테스트 2개·plan·worklog 여섯 파일이다.
- 검증: focused 55/55, typecheck, lint, 구조 23/23, 전체 943/943, doc-drift, 정상 hook, production build 71/71 PASS.
- 경계: 운영 Sheets·DB·환경·PM2·deploy·merge는 0건이다. draft PR 뒤 독립 review 전에는 release하지 않는다.
- SoR: `docs/plans/active/admin-formula-restore-c2-r1.md`

### 2026-08-02 · ADMIN-FORMULA-RESTORE-C2-R1 · 오래된 HTTP500 후보 최신 master 재진단 착수
- 의도: 관리자 수식 복원 HTTP500을 live Sheets write 없이 재현·축소하고, idempotency·사용자 값 보존·quota를 지키는 최소 fix를 출시한다.
- 진단: source `fix/m345-batchget-merge@3dff145`는 최신 master보다 403 commit 뒤이며, 현재 `installFormulas`는 시트당 read 7회+write 1회라 source의 “3회×concurrency5” 계산은 폐기했다.
- 결정: 모든 pre-read를 단일 batchGet으로 합친 뒤 concurrency5 wave를 7.5초 간격으로 제한한다. self-hosted Next에서 효력이 없는 `maxDuration`에는 의존하지 않는다.
- 범위: 관리자 bulk route·setup-formulas·focused API/repo tests·단일 plan/worklog만. 운영 Sheets·DB·R6 write는 금지한다.
- SoR: `docs/plans/active/admin-formula-restore-c2-r1.md`

### 2026-08-02 · R6 current-master integration · PR #622 successor 착수
- 의도: DIRTY 상태인 PR #622의 verified R6 exact20을 최신 master 위에 재통합해 migration 전 clean deploy candidate를 만든다.
- 한 것: current master에 verified 3-commit lineage를 순차 통합했고 focused 13 files/95 tests, `check.sh` 구조 23/23·전체 901/901, production build 70/70이 PASS했다.
- 결정: #629 rollback·#633 날짜 매핑·#640 split 무효화를 보존했고, removed DB-cost UI test는 복원하지 않았다. 최신 production-data tuple은 plan에 evidence-only로 결합했다.
- 다음: 최종 docs receipt 정상 hook commit → DRAFT/HOLD successor PR → 독립 검증·DevG handoff. 운영 DB·env·PM2·live·Sheets는 계속 불변이다.
- SoR: `docs/plans/active/r6-current-master-integration-r1.md`

### 2026-08-02 · PR643 P0 RECOVERY · read-only GET 후보 검증 완료
- 한 것: `/admin/cohorts` render의 `ensureCohortsTab` import/call 제거, 정상·429 경로 cohort mutation 0회 회귀 2건 추가.
- 검증: focused 2/2, typecheck, check.sh 101 files/916 tests, production build(`/admin/cohorts`) PASS.
- 상태: 최신 `844ce045` 기반 격리 후보이며 운영 Sheets·DB·환경·live endpoint는 변경/재시도하지 않았다.
- 다음: 독립 review 후 PR→checks→merge→deploy→health→인증 read-only live 검증.
- SoR: `docs/plans/active/pr643-admin-cohorts-p0.md`

### 2026-08-02 · PR643 P0 RECOVERY · admin cohorts GET 읽기 전용 경계 착수
- 의도: PR #643 배포 뒤 `/admin/cohorts` digest `767408371` 500을 운영 데이터 추가 변경 없이 복구한다.
- 진단: remote/deploy/VPS SHA=`844ce045`; grid 26열·A1:J1 read 성공·헤더 9칸으로 J write 미착지, PM2 예외 본문은 미수집.
- 결정: Server Component GET의 `ensureCohortsTab` 자동 쓰기만 제거하고 명시적 admin mutation API ensure는 보존한다.
- 다음: 정상 render·read 429 무쓰기 회귀, focused/typecheck/check/build, 독립 review 뒤 release chain.
- SoR: `docs/plans/active/pr643-admin-cohorts-p0.md`

### 2026-08-02 · PR643 ARENA SEASON RELEASE R2 · 비실재 날짜 fail-closed 보강
- 의도: 독립 검증에서 재현된 달력 비실재 날짜의 잘못된 시즌 전환·주차 rollover를 차단한다.
- 한 것: 공용 ISO 의미 검증을 API·repo·시즌 판정·주차 앵커에 연결하고 locale 정규화도 같은 검증을 거치게 했다.
- 검증: API auth/권한/invalid 무쓰기, repo zero-write, service unknown/week0를 포함한 집중 41/41 PASS.
- 결정: 반복 scope 재계산은 비차단 설계 잔여로 유지하고 이번 release 범위에는 포함하지 않는다.
- 다음: full check·build·정상 hook 뒤 새 SHA를 DevD에 독립 재검증한다.
- SoR: `docs/plans/active/arena-season1-setup.md`

### 2026-08-02 · PR643 ARENA SEASON RELEASE R1 · 최신 master 통합 후보 준비
- 의도: 오래 열린 시즌 SSOT 기능을 최신 master에 최소 통합하고 운영값 쓰기 없이 release chain을 완주한다.
- 한 것: PR643의 고유 6커밋을 `3fe78acc`에 이식하고 Scoreboard import 충돌을 양쪽 보존으로 해소했다.
- 보강: 기존 미커밋 RAW 날짜 정규화 수정을 별도 검토·이식하고 Sheets 로케일/RAW 회귀를 7케이스로 고정했다.
- 검증: 시즌·scoreboard 집중 35/35 PASS; full check/build·독립 VERIFY·PR checks·merge/deploy/live는 후속 게이트다.
- 제약: A2 시즌 시작일과 Sheets/admin 운영 데이터는 이 release에서 쓰지 않는다.
- SoR: `docs/plans/active/arena-season1-setup.md`

### 2026-08-01 · SALES-PT LATENCY-R1 · 시트 fallback 병렬화 release 완료
- 한 것: PR #645를 squash merge(`ccedd64c`)하고 master QA·단일 VPS deploy(`30647563313`)·public `/api/health` 200을 확인했다.
- 검증: focused 2/2·관련 27/27·독립 `PASS_TO_RELEASE`·canonical CI SUCCESS; 기존 인증 대시보드 렌더·console 0, 운영 write 0.
- 제약: API cold/warm 실측은 브라우저 도구 제약으로 `AUTH_TIMING_BLOCKED`; public redirect를 인증 timing 증거로 대체하지 않았다.
- 결정: 기능·배포는 완료됐고, 이 항목과 completed plan이 최종 문서 영수증이다.
- SoR: `docs/plans/completed/dashboard-sheet-latency-r1.md`

### 2026-07-31 · SALES-PT LATENCY-R1 · 대시보드 시트 fallback CODE_READY
- 한 것: 프로필 의존 미팅 read를 초기 read와 겹쳤고, held-promise overlap·프로필 reject 회귀를 고정했다.
- 검증: 관련 27/27, `check.sh` 구조 23/23·전체 877/877·doc-drift PASS, production build 69/69 PASS.
- 결정: 반환값·해지 오버레이·정확히 7회 Sheets 호출·DB/admin/background 경로는 불변이다.
- 다음: 독립 VERIFY PASS 뒤 동일 writer가 commit→PR→serialized deploy→health→인증 read-only timing을 수행한다.
- SoR: `docs/plans/active/dashboard-sheet-latency-r1.md`

### 2026-07-31 · SALES-PT LATENCY-R1 · 대시보드 시트 fallback 병렬화 착수
- 의도: 프로필 의존 미팅 read를 다른 초기 Sheets read와 겹쳐 대시보드 응답 임계경로를 줄인다.
- 범위: `dashboard.ts`·신규 집중 테스트·단일 plan, worklog checkpoint만; DB/admin/reverse shadow/운영 데이터는 불변.
- 결정: wall-clock 임계값 대신 held promise로 시작 순서를 검증하고 정확히 7회 호출·반환값·오류 전파를 고정한다.
- 다음: RED 테스트 → 최소 구현 → full check/build → 독립 VERIFY용 candidate 동결.
- SoR: `docs/plans/active/dashboard-sheet-latency-r1.md`

### 2026-07-28 · DevD(VERIFY) · W1-1(#631) 판정 = **NO-GO** + P1 비용원장 근인(제4결함) 규명·수정 PR
- 의도: R4 wave-1 VERIFY 트랙 + 라이브 P1(비용원장 저장·조회 비대칭) 근인 규명·fix-forward.
- 한 것: **①W1-1 #631 = NO-GO** — 4렌즈 전부 blocks_merge, blocker 7 중 2건 D 직접 확인: (a) `getWritableUserEmail` 본문이 `return getActiveUserEmail();` 뿐이라 **cohort 판정이 없어** "비파일럿 완전 불변" 주장이 코드와 불일치(비파일럿 수료생이 마감 시트에 기입 가능) (b) 집계 클램프가 같은 함수 안에서 **반쪽** — salesRows 루프에만 걸리고 미팅 루프(예약·완료·계약)는 무필터. **②P1 근인 확정(제4결함)**: pg-types 가 `date`(OID 1082)를 **로컬 자정 Date** 로 주는데 매퍼가 `String(v).slice(0,10)` → `"Wed Jul 01"` → `days=NaN` 이 가드 두 조건을 **모두 통과** → 빈 배열 → 인식금액 0 → 조용히 증발. 증상 4개(일회성 미노출·요약 ₩0·영업이익 미반영·반복 '이번 발생 없음')가 전부 이 하나로 설명됨. **PR #633**(매퍼 로컬게터 포맷+형식위반 throw, NaN 봉인, 회귀 8건, 18/18 통과).
- 결정: ①②③(#620/#615 계열)과 **별개 결함**이므로 D 의 기존 NO-GO 목록이 불완전했음을 인정. E fix 범위는 read 경로로 **확장 불필요**(#633 이 덮음) — E 는 ③ split void + effectiveMonth 유지. 반복 '이번 발생 없음'은 `firstRecurringOccurrence` 설계상 정상 → **표시 문구** 사안으로 분리.
- 추가(2026-07-28 재판정): **#633 완주** — A 독립 VERIFY PASS(3렌즈·타임존 실물 검산) → 리베이스+check.sh 재통과 → 머지·배포 success(1차 SSH 인프라 장애 rerun)·health 200. **W1-1 #631 = 재VERIFY PASS**(head f3fcb11) — blocker 3건 전부 코드 확인 해소(①주장철회+CLAUDE.md §2.5 폐지표기 ②시트 실수식 실측으로 계약만 클램프 ③contact.ts:117 읽기상한 해제+왕복회귀). **D 지적 ② 부분오류 정정** — 미팅 3단계 일괄 클램프는 오히려 parity 파손, B 실측이 정확. 부수: 전 트랙 pre-commit 차단(no-sheet-guard 14.8s/15s) **#638 로 해소**(5.4s, 831/831).
- 다음: W1-1 머지는 FOREMAN 배정 대기(완료 조건 = §6.8 + **M7 감사 1회 실행·창밖 행 규모 공시**). 비차단 잔여=비파일럿 수료생 쓰기의 운영 파급(belie 정책 판단).
- SoR: dispatch-queue `r4-w11-verify`, PR #633, scratchpad/expense-ledger-live-repro-2026-07-28.md

### 2026-07-26 · DevD(VERIFY) · blocker 원인커밋 매핑·최소 revert 셋 확정 (READ_ONLY)
- 의도: FOREMAN 판정 수용 후 즉시 — ①②③ 원인 커밋 매핑 + 최소 revert 셋 확정. 실행은 DevA(#620 revert), D 는 매핑·검증만.
- 한 것: **①② = fed3307(#620)** lib/repo/db.ts:108·:122 → #620 revert 로 닫힘. **③ = 92a0a65(#615 본체)** splitRecurringRuleFromMonth → **#620 revert 로 안 닫힘**(#617 은 archive 경로에만 void SQL 추가, split 누락). revert 적용성 dry-run **CLEAN**(`git apply --reverse --check` 통과, 이후 동일파일 접촉 커밋 0, db-cost-ledger.ts·import·테스트 전부 #620 소산이라 자기완결). ③ 라이브 도달성 CONFIRMED(expense-ledger.ts:203 이 nextMonth 까지 선 materialize).
- 결정: **⚠️ #620 revert 는 순수 복구가 아님** — 그 파서 변경은 기존 결함(생산중 행 밀림) 수정 시도였고 삭제된 테스트가 옛 동작을 명시 인정. revert 시 옛 결함 복귀하나, 새 위험(레거시 O열 오판 금액전도 + 조용한 덮어쓰기)보다 노출이 작아 **지혈로 타당**. ②원복은 순수 이득(phantom 대칭 회복).
- 다음: **📥 belie 게이트 적재(실행 안 함)** — ③ 을 #615 본체 revert 로 갈지 타겟 fix-forward 로 갈지. **D 권고=fix-forward**(#617 패턴 void SQL 1개 + UI effectiveMonth→nextMonth 고정, #615 revert 는 기능 전면 제거라 과대). DevA revert 착지 시 D 검증 → 이후 W1-1 PR 부터 VERIFY 계속.
- SoR: dispatch-queue `r4-wave1-verify` (blocker_commit_map·minimal_revert_set·blocker3_gate)

### 2026-07-26 · DevD(VERIFY) · R4 wave-1 판정 = **NO-GO** — 비대상 기수 회귀·데이터 손실·이중계상 3 blocker
- 의도: R4 wave-1(비용원장 #615~#621) VERIFY 트랙 — 적대리뷰·구조가드·비대상 기수 불변 검증 후 GO/NO-GO.
- 한 것: 기계게이트 실측(**check.sh PASSED** on e4b0d1e — 신규 타입 SSOT 등재 포함) + 4렌즈 적대검증. L1 비대상기수불변 **FAIL**·L4 도메인정확성 **FAIL**·L2/L3 CONCERN. 에이전트 주장을 **D 가 코드 직접 읽어 3건 CONFIRMED**: ①#620 이 전 기수 공용 파서(lib/repo/db.ts:108 neo 판정) 변경 → 비파일럿 직접생산 비용·영업이익이 입력 변경 없이 바뀜(legacy O열 잔여문자 1자에 금액 전도) ②read/write 필터 비대칭(:122 완화 vs :245 그대로) → 보이는 행을 다음 추가가 덮어쓰는 **조용한 데이터 손실**(:241 주석의 대칭 불변식 위배) ③split 이 occurrence void SQL 없음(archive 경로엔 있음) → 같은 달 **이중 계상**, UI '다음 달부터'가 실제로는 조회 중인 달.
- 결정: **NO-GO**(라이브 배포 상태라 이미 영향 중). 조치안 A=#620(fed3307) revert / B=fix-forward 4건. 소유=Codex DEV-*, 최종 GO 는 belie 라이브 확인과 함께.
- 다음: 소유 트랙 조치 → D 재판정. 비차단 major 5건(비파일럿 대시보드의 Postgres 동기의존·query timeout 부재, archived GET→INSERT, 아레나 scope 갈라짐, cohort 게이트 미명시, db.ts 498/500)은 현황판 유지.
- SoR: dispatch-queue `r4-wave1-verify`

### 2026-07-24 · DevD(W0-C) · R4 wave-0 선행: R3 공식 재판정 + codex-stability STABLE 장부 + F 실측
- 의도: R4 wave-1 착수 선행조건(W0-C) — R3/codex 판정 공식 장부화 + F 트랙 실측 확정.
- 한 것: ①R3 공식 재판정 = **코드레벨 PASS** 재확인(§7 6수용기준 + correctness 3플래그 닫힘; L4=append 미러실패 silent 를 #598 union 시트 fallback 으로 종결·배포·health 200) → dispatch `r3-lockdown-close=done`. ②codex-stability = **STABLE**(#612): 2 blocker 실측 해소(AGENTS.md 추적+실질규약 #602 / 드라이런 채점표 registry 정본 5 PASS + relay #610 + 환경블로커 §C 박제 #611), L3 급소(전면소진 relay 주체)=takeover-runbook §C.5 명문화(belie 확정: 수동머지 or 한도리셋까지 머지동결), #605 회귀위험 경고 등재 → dispatch `codex-stability-gate=stable`. ③F 실측: EOL #603(.gitattributes LF 기계강제, autocrlf 착시 규명·내용무변경, 배포 health 200)·발굴피커 #591 MERGED·TRACK-F idle/ready.
- 결정: R3·codex 판정 모두 확정 + F ready → **R4 wave-1 선행조건 3건 전부 초록**. residual(hardening, blocker 아님): #605 close(belie 판단)·registry 트랙줄 stale(소유 트랙)·A(인수) full 왕복 1회 실연(B-1 축소판 자인).
- 다음: R4 wave-1 착수 가능. W0-C 완료 — belie 경유 Cowork 회신.
- SoR: dispatch-queue `codex-stability-gate`·`r3-lockdown-close`, takeover-runbook §C.5, registry `CODEX-DRYRUN.scoring_result`

### 2026-07-24 · Codex DevB · 반복 비용 삭제/종료 soft archive P1 보완 (독립 재검증 대기)
- 의도: 이미 배포된 반복 규칙 DELETE terminal soft archive 계약을 Option A 관리 행에서 안전하게 사용할 수 있게 하고, 여섯 항목 수용 감사의 마지막 P1 공백을 닫는다.
- 한 것: DELETE hook을 기존 원장·카테고리·반복 규칙·대시보드 cache invalidation에 연결하고 invalidation 완료까지 mutation을 기다리게 했다. active·paused 행에 과거 비용 보존을 설명하는 인라인 `삭제/종료` 확인, 취소, safe `401/403/503` 오류와 재시도를 추가했다. archived 행은 앞으로 재발생하지 않는 terminal 안내만 보이고 모든 mutation action을 숨긴다.
- 결정: 이 작업은 물리 삭제가 아니라 서버 soft archive만 호출한다. 성공 뒤 관련 네 query를 갱신하며, 실패 시 행과 확인 상태를 유지한다. backend route/repo/service와 운영 데이터는 변경하지 않는다.
- 증거: focused DOM 14/14, `scripts/check.sh` 86 files·801 tests, production build, `git diff --check`를 통과했다. 로컬 mock의 1280 확인, 390 오류·재시도, 360 성공·archived terminal, 390 스크롤·sticky CTA 캡처는 모두 기대 문구와 가로 overflow 없음·console error 0을 확인했다.
- 다음: DevE 독립 재검증으로 넘긴다. PASS 전에는 Git publication·merge·deploy를 시작하지 않는다.
- SoR: `docs/plans/active/expense-mobile-ui-a-r4.md`, `lib/query/expense-ledger-hooks.ts`, `components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx`

### 2026-07-24 · Codex DevB · 비용 원장 모바일 Option A 구현 (VERIFY 대기)
- 의도: 승인된 Quick Action Dock을 360/390 모바일 제품 UI에 적용하면서 기존 비용·반복 API 계약과 PC 동작을 보존한다.
- 한 것: 압축 비용 요약과 기록/조회/관리 작업 탭, 카테고리 combobox 관리, 일회성 포함 일할과 분리된 반복 일정, 전체 카테고리 비용/비중/항목 수 표, 목록 행 상세, 하단 고정 저장 CTA를 구현했다. focused DOM 7건, check.sh 794건, production build, PC/360/390 브라우저 검증(error 0)을 통과했다. 디자인 artifact와 core/API는 변경하지 않았다.
- 결정: 카테고리 삭제 API는 추가하지 않고 사용 이력 보존을 위해 차단+보관 안내로 처리한다. 제품 구현은 신규 독립 VERIFY PASS 전까지 commit/push/PR로 진행하지 않는다.
- 다음: DevA가 DevD가 아닌 신규 독립 검증자를 지정해 구현 VERIFY를 수행한다. PASS 뒤에만 commit/push/PR·merge·deploy·health/live 체인으로 이동한다.
- SoR: `docs/plans/active/expense-mobile-ui-a-r4.md`, `components/dashboard/expense-ledger/ExpenseLedgerDialog.tsx`

### 2026-07-20 · F(260712) · KPI-④ EOL renormalize (막차) — .gitattributes LF 정책 기계강제 (#603)
- 의도: 레포 전반 EOL 노이즈 근절(막차, 머지 최우선). .gitattributes + renormalize 단독 PR.
- 한 것: **§0.5 진단으로 오진 정정** — `git ls-files --eol` 실측 결과 저장소(index)는 **이미 100% LF**(i/crlf·i/mixed 0건). 디스패치의 "~720파일"은 `core.autocrlf=true`가 Windows 체크아웃 시 작업트리를 CRLF(w/crlf 829)로 바꾼 **착시**(커밋 diff 아님). 진짜 가치=정책 부재 → `.gitattributes`(`* text=auto eol=lf` + 바이너리/배치 규칙)로 LF 기계강제(autocrlf 무관 CRLF 재유입 차단·경고 근절). `git add --renormalize .` → .gitattributes 1파일만 스테이징(내용 무변경 실측 증명). #603(1aa3b9a) 머지·배포 success·health 200.
- 결정: LF 단일화(저장소+작업트리). 배포=Linux·JS/TS=LF 관습. renormalize 는 저장소가 이미 LF라 no-op였음(오진이었지 무의미한 작업은 아님 — 정책 가드가 실 산출).
- 다음: #596(DB 유실 급행) D 라이브 재검증 대응 대기 / 큐 신규 배정.
- SoR: `.gitattributes`(커밋 헤더에 진단 전문)

### 2026-07-20 · Claude Code · R3 최종 판정 + §7-3 L4 종결: append 미러 실패 시트 보충 (fix/db-read-append-fallback)
- 의도: R3 전체를 코드 레벨로 완료 판정. 적대 4렌즈 검증 결과 §7-3 안전망(mirror_pending #587)·#559(→#568)·#558 잔여4(→#569)는 전부 RESOLVED, 유일 잔여 L4(append CREATE 의 silent 반쪽쓰기)만 blocks. belie 결정=옵션1(누락행 시트 fallback).
- 한 것: read 진입점 3곳(loadContractPayments·loadDBOverview·loadLeadsForPicker)을 union 으로 — DB 정본 + 시트 read **병렬** → 시트 누락행(=append 미러 실패로 DB 부재)만 row 조인 보충. 신규 lib/service/sheet-backfill.ts(순수 헬퍼, 계약은 linkedMeetingId 2차 dedupe) + 테스트 10케이스. check.sh 초록.
- 결정(자율, §0.7): 미러 실패 원인=DB blip 이라 옵션2(append durable redrive)는 무력(찍을 DB 행이 없음) → 시트 보충만 견고(belie 옵션1과 일치). R2-4/R2-5 "파일럿 시트 0회" 속도이득 반납(병렬이라 지연=시트 수준). 정합·정직성>속도(§0). 비파일럿 완전 불변.
- 다음: PR 오픈→머지→배포 success·health 200 확인 후 R3 완료 선언. 복구=revert 1커밋(정본 DB, 손실 없음).
- SoR: docs/plans/active/append-mirror-sheet-fallback.md

### 2026-07-20 · F(260712) · 급행: DB생산 카드 거짓 dirty·데이터 유실 수리
- 의도: belie 리포트(연습용) — DB생산 최신카드에서 ①이전 저장 내용 날아감 ②"저장 후 이동" 이탈 가드 반복. 유실급.
- 한 것: 근인 3겹 순차 수리(3커밋). ① dirty 판정을 첫 computed 스냅샷 → 순수함수 `rowFormDirty`(자동필드 제외+타입정규화)로 이관, RowForm `onDirtyChange` 보고, blank `[channel.cls]` 메모로 refetch 유실 차단. ② RowCard 접힘 시 dirty 해제(useState 얼음 회귀) + onExpand·+추가 guardedNav 로 선확인. ③ handleSave 저장 실패 rethrow(saveAll 실패 관측 → 이동 취소·편집 보존). 회귀테스트 9(거짓 dirty 0). check.sh 초록(725).
- 결정: dirty 판정은 컴포넌트 밖 순수함수로(테스트 가능), 비동기 저장 콜백은 실패를 throw 로 전파(가드 관측). 상세=incident.
- 다음: 머지 → §6.8 배포 관찰 → **D 재검증 요청**(dispatch 지시). 하네스 갭=컴포넌트/이펙트 테스트(RTL) 인프라 부재(별도 트랙 제안).
- SoR: `docs/incidents/2026-07-20-db-card-dirty-guard-dataloss.md`

### 2026-07-19 · Claude Code · 공용부 선행: lib/types/index.ts 도메인 분리(배럴) — 500줄 캡 해소 (#589)
- 의도: index.ts 가 정확히 500줄(check.sh 캡 경계) → 발굴 체인 PR-5·6 및 타 트랙이 타입 추가 시 즉시 막힘. §3.5 공용부(lib/types) 단독 PR 로 선제 분리해 언블록.
- 한 것: index.ts → 8개 도메인 파일(channel·meeting·db·user·contract·todo·announcement·dashboard, 각 ≤118줄) 분리 + `export *` 배럴(14줄). contract-status 재수출은 contract.ts 흡수. doc-drift.sh §C grep 대상 `index.ts`→`lib/types/*.ts`(-h) 확장(심볼 27개 검사 유지). data-model.md 경로 프로즈 갱신. check.sh 초록·CI 초록·#589(ca4efb5) squash 머지·배포 success(29670671592)·health 200.
- 결정: 소비자는 `@/types` 배럴만 사용(deep import `@/types/*` 0건 사전확인) → 전 소비자 무변경. 배럴 재수출은 doc-drift `^export const X = z.` 패턴에 안 걸리므로 대상 경로 확장이 가드 유효성의 필수조건.
- 다음: 발굴 체인 트랙은 이제 db.ts·meeting.ts 등 도메인 파일에 타입 추가 가능(각 파일 500줄 캡 개별 유지). #589 직후 발굴 PR-2(#590)가 리베이스 없이 클린 머지 확인.
- SoR: docs/plans/completed/types-barrel-split.md, PR #589

### 2026-07-17 · Codex(260717) · 대시보드 client directive 오류 복구·배포 완료 (#576)
- 의도: `salesptlog.online` 서버 오류 신고를 진단하고, #575 이후 실패한 운영 배포를 정상화한다.
- 한 것: `DashboardProgressBanner.tsx`·`OperatingProfitCard.tsx`의 `"use client"`를 최상단으로 이동. `scripts/check.sh`·구조검사 10/10·테스트 630개 통과 후 PR #576 squash merge(`c1dd7de`).
- 결과: Deploy run #29549181566 success(4분 21초), VPS HEAD 일치·BUILD_ID 존재·PM2 online·로컬 `/` 및 `/api/health` 200·공개 루트 5회 연속 200 확인.
- 결정: 원인은 머징 충돌이나 런타임 데이터가 아니라 #575의 두 파일에 생긴 Next.js client directive 순서 오류. 기존 프로세스가 살아 있어 일시적으로 루트 200이었지만 소스와 실행 빌드가 불일치했다.
- 다음: 없음. Node.js 20 기반 action deprecation 경고는 이번 장애와 무관한 별도 유지보수 항목이다.
- SoR: docs/plans/completed/client-directive-order.md, PR #576, Actions #29549181566

### 2026-07-12 · DevC(260712-2) · 트랙 C 마감 — read-only close 확정, plan 2건 completed 이동
- 의도: belie ①read-only close 결정(카나리아 없이 종료) → 트랙 C 종료 절차 실행.
- 한 것: ①`contract-termination.md`·`contract-delete-ghost.md` → completed 이동(status: completed·completed:2026-07-12) ②worklog 마감 항목 추가 ③보드 C행=완료(종료). docs 전용 PR(코드 무변경)로 커밋·머지·배포 관찰.
- 결정: 트랙 C 스펙 종결 확정 — #527~534 머지·배포 success·health 200·코드층 독립감사(단위테스트 매트릭스+repo write 가드-clean+delete cascade) 통과. 라이브 쓰기 왕복 카나리아는 belie 판단으로 생략(로직층 이미 검증). 02 구역 소유권 A(R3-3)로 이관.
- 다음: 유보 1건(퍼널 계약수·전환율 해지 제외=04 미팅 상태 기반 전 시트 수식 전파)은 belie 별도 결정 항목. 결정 시 구현은 §2.5 가드+전파 dry-run 필수.
- SoR: docs/plans/completed/{contract-termination,contract-delete-ghost}.md, PR #527~534

### 2026-07-12 · Claude Code · R3-2 PR-1: 실무투두(05) 쓰기·읽기 DB 정본 전환 (feat/db-write-todos-carry)
- 의도: belie "r3-2~5 시작"(무감독 완주 루프). R3-2 를 PR-1(todos 단독)/PR-2(meetings+carryover) 분할 — 이월은 tab="meetings" 라 PR-2 로.
- 한 것: chooseWriteSource 게이트(create/patch/remove) + writeRowToDb/clearRowInDb(client.ts) + **listTodos 읽기 동반 전환** + 시트 미러를 **수렴 동기화**(queueSheetSync 시트별 직렬 큐, 최신 DB 상태로 update-or-append/clear, gcal reconcile 은 행 보장 후 await)로 설계. 적대 리뷰 4라운드(6→12→2→0건 수렴), check.sh 초록(388+10).
- 결정: ①쓰기 flip 은 같은 표면 **읽기 동반 flip 필수** ②미러는 연산 재생이 아닌 **상태 수렴**이어야 레이스 자기수정 ③patch 는 _cleared(삭제)와 DB 공백을 구분(공백만 시트 self-heal) — 셋 다 db-write-flip.md §6 에 R3-2 PR-2·R3-3~5 의무로 등재.
- 다음: 머지→배포 관찰→파일럿 실사(생성/완료토글/삭제 + 시트 미러 Drive 대조 — ⚠️ 병렬트랙 A 발견 "practice cohort=''=비파일럿" 반영해 계정 게이트 선확인) → PR-2(meetings).
- SoR: docs/plans/active/db-write-flip.md §6

### 2026-07-12 · DevA(260712) · R3-2 write-path 테스트갭 해소 (#537 머지·배포)
- 의도: #535(R3-2 PR-1 todos)가 게이트/롤백(daily-source.test)만 커버하고 05 실무투두 서비스 CRUD 쓰기경로 단위테스트 0건인 갭(선세션 플래그) 해소. 승계 시점 디스패치는 belie 부재+"테스트 보강=안전작업 대기지침" → 원자 PR로 선처리(이후 갱신된 디스패치의 "R3-3에 포함" 의도를 결과적으로 선충족·재포함 불필요).
- 한 것: tests/service/todos.test.ts 15케이스 — create/patch/remove/list DB경로 인자정합 + 비파일럿 R2 완전불변 + 미러 수렴(append mirror:false·reconcile await)·미러 실패격리(caller 성공+Sentry). check.sh 초록(유닛 435). #537 squash 머지(469a61b). 배포 1차 실패=VPS SSH connect timeout(인프라·빌드 전 단계·코드무관, §6.8 "Setup SSH 실패" 케이스) → `gh run rerun --failed` success → 공개 health 200.
- 결정: R3-2 §7 테스트갭 종결. 롤백 불필요(테스트 전용·프로덕션 코드 무변경).
- 다음: R3-3(contracts+company_archive 쓰기 전환) belie 상세 프롬프트 대기. C 종료로 02 구역 소유권 확보(DevC 마감 커밋 worklog 충돌만 주의).
- SoR: tests/service/todos.test.ts, docs/plans/active/db-write-flip.md §6·§7, PR #537

### 2026-07-12 · DevD(260712) · 속도 성적표 완성·게시 — DB 읽기전환 5 route 목표달성 확인
- 의도: Cowork가 언블록(raw 추출)해준 데이터로 DB전환 전/후 속도 리포트 완성 → PR 코멘트.
- 한 것: `scratchpad/db-speed-raw-2026-07-12.md`(레포 scratchpad, 세션격리 아님) 가공 → 전/후 비교표+
  판정+미달원인 작성(`scratchpad/db-speed-report-FINAL.md`). belie 승인 후 **PR #491·496·499·500·509
  5건에 요약 코멘트 게시 완료**(issuecomment 4950078488·078728·078977·079256·079514).
- 결과: ✅5 route 목표(≤300ms) 대폭달성 — p50 22~36ms(전 396~1,845), 후 sheets_ms p50=0 수렴
  (daily −99%). 🟡dashboard 부분(p50 −66%, p95 51,165→3,217=−94%). ❌todos 미반영=측정창이
  todos DB전환 #535(7/12) **이전**(표2가 sheets_ms 424~597 확증) → 전환실패 아님.
- 결정/판단(§0.5): 이 창에 온 **"[병렬트랙 B 인계]" 프롬프트는 낡음/오배송** — 실측상 B는 별도 몸
  DevB(260703)가 gcal로 소유(방금 #538 오픈) → 이중점유 회피 위해 무시, belie 재확인받고 DevD 유지.
- 다음: #535 전면배포·파일럿 확대 후 todos·dashboard 재측정(그때 5 route처럼 수렴 예상). 신규 작업 대기.
- SoR: scratchpad/db-speed-report-FINAL.md, db-speed-raw-2026-07-12.md, PR #491·496·499·500·509

### 2026-07-12 · DevB(260703) · gcal 트랙 승계 + 관찰성 구멍 수리 PR(#538) — 머지는 belie 승인 대기
- 승계: 트랙 B가 gcal 트랙(카나리아·버그수정·QA) 이어받음(원본 카나리아 세션 인수인계). 남은 일 4건 중 belie 부재 무관하게 자율 실행 가능한 유일 항목 = pm2 로그 무음실패 조사(§0.5②, Observability/Hashimoto).
- 진단: gcal 라우트 6개 전부 `withApiTiming` 미적용 → 다른 ~60개 라우트와 달리 durable 관찰 채널(PostHog `api_timing`)에 안 잡힘 = "resync 500인데 로그 0줄"의 근인. callback은 OAuth 실패를 `?gcal=error`(307)로 삼켜 성공처럼 보임(무음).
- 한 것: PR **#538**(chore/gcal-route-telemetry) — 핸들러 8개 withApiTiming 래핑(500→PostHog `api_timing status=500`, pm2 로그와 무관 채널) + callback catch에 `captureServerEvent("gcal_connect_error")` 1줄(비-PII). withApiTiming=catch→re-throw라 **무동작변화**. check.sh 초록(구조10·단위420). 인시던트 노트 작성.
- 결정: **머지=프로덕션 배포는 보류 → belie 승인 대기.** belie 복귀 + 인수인계가 "제안" 프레이밍 + outward-facing 액션(DevD PR코멘트 대기와 동일선). 잔여=pm2 out 로그가 배포 몇 분 후 침묵하는 인프라 원인(VPS 필요, DevE 구역 근접).
- 다음: belie 머지 승인 시 §6.8(리베이스→머지→배포 conclusion=success→health 200) 완주. 그 후 resync 회귀 카나리아(belie 승인)·워크트리 정리(belie 승인)는 belie 결정 대기.
- SoR: PR #538, docs/incidents/2026-07-12-gcal-observability-gap.md, docs/plans/active/google-calendar-sync.md Log(2026-07-12), lib/analytics/api-timing.ts

### 2026-07-12 · Cowork(오케스트레이터) · 승계(fable) — DevD 언블록(PostHog raw 직접 추출) + C 종료 결정 + R3-3 발행
- 승계: opus → fable(260712). GitHub 재실측 — Open PR 0·Deploy #477 success·health 200(변화 없음). belie 복귀.
- 한 것: ①belie 결정 수령 — DevC 카나리아 = **①read-only close 확정** ②PostHog 쿼리를 Cowork가 직접 실행(belie 크롬 로그인 세션 경유, HogQL query API — MCP의 exec 도구는 이 세션에 미노출이라 크롬 경로 사용) → route 7종 전/후 14행 + todos·dashboard 일자별 12행 추출, `scratchpad/db-speed-raw-2026-07-12.md` 저장 = **DevD 언블록** ③디스패치 전면 갱신(A=R3-3 착수·B=gcal 조사 계속·C=close 절차·D=raw 전달·E=belie 직접 3건) + A·C·D 프롬프트 발행(belie 붙여넣기).
- 소견(가공은 DevD): 5개 route 후창 p50 22~36ms·sheets_ms p50=0 수렴. todos만 미수렴(p50 672·sheets 556 — R3-2 #535가 7/12 배포라 후창 대부분이 이전 + 파일럿 한정 혼합 추정), dashboard 부분 수렴.
- 다음: belie가 A·C·D 창에 프롬프트 붙여넣기 → A는 R3-3, C는 마감, D는 리포트 완성. belie 직접 3건(Secret·DB비번·퍼널 계약수 결정)은 별도 안내.
- SoR: scratchpad/db-speed-raw-2026-07-12.md, 디스패치 섹션(본 파일 상단)

### 2026-07-12 · DevC(260712-2) · 승계 — 코드층 독립 재검증(스펙 완료 확인), 카나리아만 미검
- 승계: 트랙 C(260712→260712-2). 디스패치 "수납·계약해지 스펙 완주"는 이미 완료(Cowork PR레벨 실측과 일치): #529~534 MERGED·배포 success·health 200·Open PR0·feat/c-payment-cancel 브랜치 부재.
- 한 것: PR레벨 위에 **코드층 적대적 감사** 추가 — ①단위테스트 매트릭스 충분(파서 AL~AO 왕복·DB payload 필드명+열문자 동치·매출규칙 정상/이월/split·서비스검증·6케이스·휴힐링 실시나리오) ②repo writeTermination 안전(AL~AO 전용 신규컬럼 단일행 update=§2-5 bulk-guard 비대상·헤더행 보호·그리드41 선보장·dual-write 미러) ③delete cascade=contracts-clear-sync.test 보유.
- 결정: 미검 항목=**순수 라이브 통합(실시트 쓰기왕복)뿐** — 로직층은 belie 없이 이미 검증됨(옵션① read-only close 근거 보강). 신규 Sheets-mock 테스트는 한계효용<공수(YAGNI) 미작성. 카나리아 재실행 안 함(§0.5③), belie 3택·plan completed 이동은 결정 후 불변.
- 다음: belie 결정 대기. belie 대기건(퍼널 계약수 해지반영)·타 트랙 구역 무접촉.
- SoR: tests/service/contract-termination.test.ts, lib/repo/contract-payment-termination.ts, docs/plans/active/contract-termination.md §3

### 2026-07-12 · Cowork(오케스트레이터) · 승계 + 6트랙 실측 재검증 — C→A→F 전부 완주 확인
- 승계: fable 세션에서 opus 세션으로 오케스트레이터 승계(260712).
- 한 것: GitHub PR·Actions·라이브 사이트 실측으로 6트랙 재검증. 핵심 발견 — 머지 우선순위
  C→A→F **전부 이행 완료**(보드는 stale이었으나 실측으로 확인):
  ①C: #529~534 전부 MERGED, Deploy #470~475 전부 success
  ②A: #535 MERGED, Deploy #476 success (3m 29s)
  ③F: #536 MERGED, Deploy #477 success (3m 0s)
  라이브 health 200, DB 파일럿 OK (110ms, 1643행). Open PR 0건.
- 결정: 디스패치를 현재 상태로 갱신(구 "C→A→F" 완주 반영). A트랙 보드 stale 지적.
  DevA 다음 임무 = R3-3(contracts 쓰기 전환). DevD PostHog raw 추출은 Cowork 시도 예정.
- 다음: ①DevA에 R3-3 디스패치 준비 ②DevD용 PostHog 데이터 추출 시도 ③belie 복귀 대기건 정리
- SoR: docs/worklog.md 디스패치 섹션, GitHub Actions Deploy #470~477

### 2026-07-12 · DevD(260712) · 속도 리포트 승계 — 블로킹 재확인 + 스캐폴드/HogQL 선제작
- 승계: 트랙 D(260712 신 몸). 미션=DB전환 속도 전/후 리포트, 레포 무접촉(읽기+PostHog만).
- 재확인: 전 세션 블로킹 조건 그대로 — PostHog 쿼리 접근 없음(MCP 미연결, 실 env `.env.local`/
  `.env.production`에 phx_/phc_ 없음=`.env.example`만, VPS pm2 로그 접근 없음), Cowork raw 미전달
  (docs/handoff/inbox·scratchpad·HANDOFF.md 모두 신규 데이터 0).
- 한 것(대기 중 안전 전진, §0.5②): ①route 상수 정확값 코드에서 추출(`api-timing.ts` withApiTiming
  인자 — 선행슬래시 없음·`:GET` 접미사·status 숫자) ②붙여넣기용 HogQL 2본(전/후 창) + 비교표
  스캐폴드 + 미달원인 프레임워크를 scratchpad `db-speed-report-scaffold.md`에 준비. raw만 오면 즉시 채워
  PR #491·496·499·500·509 코멘트 게시 가능.
- 다음(언블록 조건): Cowork/belie가 scaffold의 HogQL 실행→raw 표 전달, **또는** PostHog MCP 연결.
  그때 DevD가 표 완성→PR 5건 코멘트+worklog 완료 요약. 그 전까지 belie 대기건·타 트랙 구역 무접촉.
- SoR: docs/plans/active/api-timing-baseline.md, scratchpad/db-speed-report-scaffold.md, PR #491·496·499·500·509

### 2026-07-12 · DevF(260712) · gcal 45열 트랙 완주 — 04 열수 전수조사(#536) 머지·배포
- 의도: 45열 시트 gcal 버그 수리 트랙 마무리 — 완료기준 3(읽기 가드/전수조사 표/배포 관찰) 충족.
- 한 것: 읽기 가드는 이미 #522 머지·배포됨을 확인(criteria 1). READ-ONLY 전수조사 스크립트
  (`scripts/census-04-grid-2026-07-12.mjs`)로 trainee 68시트 04/05 열수 실측 → #536 머지·배포
  success·health 200(criteria 2·3). plan §2 census 표 등재.
- 결정: **67/68 시트가 04=45열(AT 미생성) → #522 읽기 가드가 프로덕션 전체 안전망으로 작동 중**.
  04 일괄 45→46 확장은 YAGNI(읽기 가드 + 첫 토글 자동확장, 대량쓰기=belie 승인)로 기각 —
  45열은 버그 아닌 가드 처리 정상 상태로 확정. 05 O(15) 취약 0건.
- 다음: DevF 트랙 완주. 신규 작업 대기(belie/디스패치). 45열 관련 회귀 재점검 불필요.
- SoR: docs/plans/active/google-calendar-sync.md §2, PR #522·#536

### 2026-07-12 · DevD(260712) · 속도 전/후 리포트 — PostHog 접근 부재로 ⛔블로킹, Cowork에 데이터 추출 핸드오프
- 의도: DB 전환(R2 읽기) "공식 성적표" — route별 p50/p95 전/후 비교표 작성 → PR #491·496·499·500·509 코멘트 + worklog 기록.
- 블로킹: 이 Claude Code 세션엔 **PostHog 쿼리 접근 없음** — 개인 API키(phx_)·PostHog MCP·VPS pm2 로그 모두 부재(로컬 .env엔 PostHog 키 자체가 0). #484는 계측 코드만 머지, 기준선 "숫자"는 미기록(PostHog에만 존재). belie 결정=**Cowork가 추출**(접근권 있는 쪽이 raw, DevD가 가공).
- 데이터 요청 스펙(Cowork 실행): event=`api_timing`, 속성 `ms`(전체)·`sheets_ms`·`status`. 지표=route별 `quantile(0.5)(ms)`·`quantile(0.95)(ms)`+count, `status=200`만, tz=UTC. 대상 route(모두 :GET)= `api/daily/[date]` · `api/meetings/week/[weekStart]` · `api/meetings/month/[yyyymm]` · `api/contract-payment` · `api/todos` · `api/db` · `api/dashboard`. 창: **전** `2026-07-06 16:40 ~ 07-08 04:00`(계측 라이브~첫 R2머지 전, Sheets 서빙) / **후** `2026-07-09 01:00 ~ now`(전 R2 머지 후, 07-08 전환일 제외해 mid-flip 노이즈 차단). 보조로 `sheets_ms` p50도(후엔 0 수렴이 전환 성공 방증).
- 주의: api_timing은 서버 이벤트(distinct_id="server")라 is_internal(ADR-0013) 필터 불가·불필요. 전 창 표본 짧음(~1.5일)—p50 신뢰 우선, p95는 방향참고. 미개선 route는 원인후보 기록 예정(캐시적중 비중·병렬콜·DB콜드스타트 등).
- 다음: Cowork/belie가 위 스펙으로 raw 표 전달 → DevD가 전/후 비교표+미달원인 작성→PR 5건 코멘트+worklog 요약표 기록. 그때까지 belie 대기 3건·타 트랙 구역 무접촉.
- SoR: docs/plans/active/api-timing-baseline.md, db-migration-pilot §1·§5, lib/analytics/api-timing.ts, PR #484(계측)·#491·496·499·500·509(R2 전환)

### 2026-07-12 · DevC(260712) · 계약해지 카나리아 — 배포·라이브 read-only 검증 OK, 쓰기 왕복은 보류(belie 승인 필요)
- 승계/맥락: C 트랙 승계. 미션="belie 대신 해지 왕복 카나리아→통과시 최우선 머지". **정찰 결과 머지는 이미 완료**(#529·531·532·533·534 전부 MERGED 7/11, 보드의 "머지 대기"는 stale). 실제 남은 건 라이브 카나리아뿐.
- 한 것: ①배포 검증 — Deploy run 29167294141(#534) success·공개 health 200 확인(§6.8 충족). ②라이브 read-only — belie 실세션(salesptlog.online, 김믿음 7기)에서 새소식 팝업이 해지보관함 "새 기능"(개봉 7/12) 노출 = 이미 공개, 실무/수납 화면이 해지 매출정의(총매출=수임비+수수료, 아레나/이월 분리) 정상 렌더. ③쓰기 가드 검증(코드) — `getWritableUserEmail`(identity.ts:155)은 admin 세션 impersonation 쓰기 허용(#519의 gcal 403 과 대조, terminate 라우트는 쓰기 가능).
- 결정/블로킹: **쓰기 왕복 카나리아 자율 실행 보류**. 근거 — (a) 미션 선호 "연습 시트 임시 연결"=마스터 레지스트리 쓰기 → 표준 가드(worklog 182·211) belie 승인 필수·부재 (b) 대안=belie 본인 실시트(현재 계약 0건 클린)에 테스트계약 주입/해지/복구/삭제 무감시 → 실패 시 실매출 오염 (c) 카나리아는 머지 게이트 아님(코드 기배포·#534 자동 6케이스 검증 포함) → 부재 중 강행 한계효용<하방(§0.5③). "통과시" 하우스키핑(Changelog-Done 그룹공개·plan completed 이동)은 게이트 미충족으로 미실행(단 팝업상 그룹공개는 선세션이 이미 적용한 정황).
- 다음: belie 결정 대기 3택 — ①read-only+자동검증으로 close(권고, plan completed 이동) ②연습시트 연결 승인 or admin+연습 trainee 지정 → 임퍼스네이션 쓰기 왕복 ③본인 실시트 왕복(주입→전량 원복) 명시 승인. 결정 전까지 belie 대기건·타 트랙 구역 무접촉.
- SoR: docs/plans/active/contract-termination.md §3(수용기준), lib/auth/identity.ts:152, PR #529·531·532·533·534

### 2026-07-12 · DevA(260712) · R3-2 PR-1(todos DB 정본) 독립 검수 — 초록 재확인 + 테스트갭 1건
- 승계: 트랙 A(260703→260712). 디스패치는 "git복구 후 R3-2 검수" 였으나 **git 정상**(.git/config 797줄 무손상, status/config-list 정상) → 복구 불필요. R3-2 PR-1 은 Fable 5 body 가 커밋 완료(ea83429, 미머지).
- 한 것: ea83429 정적 검수(적대적). 설계 견고 확인 — ①읽기/쓰기 게이트 대칭(chooseDailySource=chooseWriteSource, read-your-writes) ②list 는 _cleared SQL 제외 ③writer/reader 동일 풀(getDbPool→getPool) ④repo mirror:false 로 DB 재미러 차단 ⑤gcal 고아이벤트 방지(reconcile 를 직렬큐 내 행보장 후 await) ⑥수렴 미러(잡마다 최신 DB 상태). 독립 재검증: typecheck 초록·구조 10/10·게이트테스트(롤백·비파일럿불변·대칭) 통과.
- 결정/발견: **테스트갭** — 신규 R3-2 write-path(queueSheetSync 수렴·patchTodo _cleared throw·removeTodo 순서·listTodos DB 필터/정렬)에 단위테스트 0건. 게이트/롤백은 daily-source.test 로 커버되나 plan §7 "미러 정합·미러 실패 시나리오"는 todos 신규 로직 미충족. 머지 전(=C 후) 보강 권고.
- 다음: 머지는 DevC 후(§6.8). 테스트 보강은 worktree 동시세션(Fable body) 충돌 회피 위해 소유권 정리 후. belie 대기 3건 무접촉.
- SoR: docs/plans/active/db-write-flip.md §6·§7, 커밋 ea83429

### 2026-07-12 · DevE(260712) · 03 DB관리 헤더존 유령 진단 — 구조분석 무혐의 (#527 대체 임무)
- 의도: belie 대기 3건 동안 대체 임무 — 02 94행 사고(#527)와 같은 부류가 03 DB관리
  (backfill 시작행 row4)에도 있는지 dry-run 진단만(수리 금지). #524 MERGED 재확인 완료.
- 한 것: 코드 정독 진단 — **02 사고의 두 조건이 03 에는 구조적으로 부재**.
  ① backfill 시작행 4 == 앱 FIRST_DATA_ROW 4(`lib/repo/db.ts`, headerRow=3·헤더 1~3행)
  → 헤더행 과대적재 없음(02 는 row≥3 적재 vs 실데이터행 6/5 불일치가 근인).
  ② DB-read(`read-db-tab.ts`)가 섹션별 isMeaningful+isSumRow+_cleared 로 **재필터**
  → 헤더존 잡음이 화면에 못 뜸(02 는 read 가 헤더행 raw 노출 → #527 이 isContractHeaderZoneJunk
  가드를 뒤늦게 신설한 것과 대조). cohort-template.ts 는 03 예시행 미시드.
- 결정: 03 DB관리 = **02類 헤더존 유령 무혐의**(수리 불필요). 실측 dry-run 스크립트 작성
  (read-only SELECT, #527 패턴 재사용) — VPS 실행용 scratchpad 보관, PR 미주입(직렬 머지
  C→A→F 방해 안 함). belie 대기 3건(Secret·기수왕복·DB비번 교체) 불변.
- 다음: (선택) VPS 에서 diagnose 스크립트 1회 → ②헤더존 rowNum<4·④진성유령=0 실측 확인.
- SoR: lib/repo/db.ts(FIRST_DATA_ROW=4), lib/repo/db/read-db-tab.ts(isMeaningful 재필터),
  scripts/ops/backfill-sheet-rows.mjs:120, scratchpad/diagnose-db-header-zone.mjs

### 2026-07-12 · Cowork(오케스트레이터) · 야간 디스패치 발행 — 5트랙 지시 + belie 부재 모드
- 의도: belie 외출 — 트랙별 다음 지시를 디스패치로 발행, 중복·충돌 없이 자율 진행
- 한 것: 보드·로그·GitHub 재검증 후 디스패치 5건 발행 — M(R3-2 완주, R3-3은 A 머지 확인 후),
  A(자체 카나리아→직렬 머지→§6.8 완주), B(속도 전/후 리포트), C(잔여=belie Secret 대기 →
  대체 임무: 03 DB관리 backfill 헤더존 유령 진단 dry-run), G(계속+완료 시 보드 갱신)
- 결정: 머지 우선순위 A → M(R3-2) → G → C진단(머지 없음) — A가 R3-3의 선행이므로 최우선.
  belie 복귀 대기 3건: ①퍼널 계약수 해지 반영(유보 승인 여부) ②ADMIN_DRIVE_REFRESH_TOKEN
  Secret 등록 ③DATABASE_URL 비번 교체(보안 권고)
- 다음: 각 트랙 완료 보고는 워크로그로. Cowork 은 다음 접속 시 보드 기준 재검증
- SoR: 활성 트랙 보드(상단), CLAUDE.md §3.5

### 2026-07-12 · Cowork(오케스트레이터) · 세션 배치도 정정 + 귀속 착오 교정 + B트랙 재배정
- 의도: belie 지시 — 세션 6개(Dev2·Dev2-fork·Dev3-A/B/C·45열fix) 배치 확인, 진행 중인 일 중복 지시 금지
- 한 것: 귀속 착오 자백·교정 — R3-0(#515)·R3-1(#518)은 **Dev2**의 성과(7/10 이전 머지), Dev3-B 아님(B가 "감 못 잡던" 원인 = 이미 완료된 임무를 배정받아서). R3-2 검수(21에이전트)도 Dev2 계열. 45열 gcal 버그는 전담 세션이 수리 중 — "A·B·C에 붙여라" 제안 철회. 워크로그 형식에 세션명 표기 의무화
- 결정: **R3 트랙 소유 = Dev2.** R3-3(수납 쓰기)은 Dev3-A 구역과 겹침 → Dev2는 A트랙 머지 후 착수. Dev3-B 재배정 = 속도 전/후 리포트(PostHog — 레포 구역 0, 충돌 불가능)
- 다음: 각 세션은 자기 이름으로 기록. 오케스트레이터는 지시 전 워크로그+GitHub 최신 PR로 귀속 확인
- SoR: CLAUDE.md §3.5, docs/worklog.md 형식

### 2026-07-12 · Claude Code · [병렬트랙 A] 작업2 보완 — 해지 보관함 + 6케이스 테스트 (Dev3-A 스펙 완주)
- 의도: 오케스트레이터 스펙 갭 2·3 — 숨김 해지 계약의 접힌 보관함 열람 + (없음/일부/전액)×(보존/숨김) 6케이스 매출·건수 검증
- 한 것: TerminationArchive(접힌 아코디언, 업체명·해지일·사유·반환액 읽기전용, 0건이면 미표시 — SSOT #533 선등재) + payment 페이지 배선(숨김=목록·건수 제외, 보관함 열람 — 500줄 캡 내 압축). 6케이스 매트릭스 + 휴힐링 시나리오(수임비0+전액반환+숨김 → 매출 기여 0·건수 제외·보관함 열람) 테스트 — 총 17 초록
- 결정: 스펙 항목 중 "전환율·시트 수식·아레나 계약 건수의 해지 제외"는 **범위 유보** — 계약수·퍼널은 04 미팅 상태 기반(시트 수식+DB 집계 쌍둥이)이라 해지 반영은 전 시트 수식 전파가 필요(그림자 diff 0 유지 조건과 충돌). 현행 = 02 기반 표시(실무/수납 건수·매출)만 제외, 매출은 전 지점(대시보드·아레나 split) 반환 차감. 퍼널 계약수 처리 = belie 결정 필요(통계 기본값 미확정 항목과 함께)
- 다음: belie 카나리아(해지 보존/숨김 왕복 + 보관함 확인). Dev3-A 스펙 잔여 0(위 유보 1건 제외)
- SoR: docs/plans/active/contract-termination.md, PR #533·본 PR

### 2026-07-12 · Claude Code · [병렬트랙 A] 작업1 보완 — 삭제 시트+DB 동시 반영 + 전 파일럿 대조 0
- 의도: 오케스트레이터 스펙 전문 수령 — 기완주분과 대조해 갭 3개(삭제 동기화·해지 보관함·6케이스 테스트) 보완 착수. 본 항목 = 갭 1
- 한 것: clearRow {syncDb} — 파일럿 삭제는 DB _cleared 를 await+1회 재시도, 최종 실패 = 사용자 에러(조용한 반쪽 삭제 금지). 비파일럿은 기존 fire-and-forget(DB 장애가 시트 화면 사용자를 안 막게). 게이트 = chooseDailySource 대칭. 회귀 5테스트. **전 파일럿 시트↔DB 계약 대조 1회: 파일럿 불일치 0**(비파일럿 3건 = dual-write 이전 계약 미러 부재, 화면 무영향 — R4 백필 대상)
- 결정(발견 2): ① practice 계정 cohort="" → 비파일럿(시트 read) — R3 의 "연습 DB=0 읽기이상"은 손상 아닌 미백필로 설명(R3 트랙 참고) ② 일회성 VPS 스크립트는 heredoc 생성 시 SA 키 파싱이 깨질 수 있음 — Write 도구 파일로 생성할 것(이번 오진 원인, #524 무혐의 확인)
- 다음: 갭 2·3(해지 보관함 + 6케이스 테스트) — feat/termination-archive
- SoR: docs/plans/active/contract-delete-ghost.md §4.5, PR(fix/contract-delete-sync)

### 2026-07-12 · Claude Code · [병렬트랙 A] feat/contract-termination 구현 — 계약해지 (Dev3-A 완주)
- 의도: 7/10 belie 스펙 — 실무/수납 [계약해지](사유 필수·반환 없음/일부/전액·보존/숨김), 매출=수임비+수납−반환액
- 한 것: 모델 #529(types AL~AO+SSOT 선등재) 후 본 PR — writeTermination(신규 repo, 그리드 41열+미러)·rowToCP/DB payload 파서 확장·terminateContract(검증 KST 해지일)·terminate 라우트·TerminationModal+ContractRow 뱃지/버튼·건수 "해지 N건"(상수 1개)·computeContractRevenue/split 에 totalRefunded 차감. 500줄 캡 3파일 분리(contract-status·nameHighlight·DeleteConfirmModal — 동작 무변경). 테스트 29 초록(해지 정합 9 신규)
- 결정: 이월 계약의 반환액은 이월 버킷 차감(기존 이월 규칙 일관). 해지 취소 UI 는 미구현(시트 AL~AO 비우면 복구 — 운영 절차). reverseShadowCompare 는 revenue 비대조라 경보 영향 0
- 다음: belie 카나리아(연습 계정 해지 왕복) 후 그룹 공개는 이 PR 의 Changelog-Done. 이용호 안내(휴힐링 정리+해지 사용법) = belie/Cowork
- SoR: docs/plans/active/contract-termination.md, PR #529·본 PR

### 2026-07-12 · Claude Code · [병렬트랙 A 보충2] feat/contract-termination 구역 확장 + 모델 계약 PR
- 의도: 계약해지 기능(7/10 스펙)이 선언 구역 밖 파일을 요구 — §3.5 규칙 1 보충 선언
- 구역 추가: `lib/service/dashboard.ts`(computeContractRevenue·매출 분할 — 반환액 차감 반영) · `app/api/contract-payment/**`(terminate 라우트) · `lib/repo/contract-payment-termination.ts`(신규, 500줄 캡 분리) · `app/(app)/payment/_components/TerminationModal.tsx`(신규). 기존 선언 트랙(B=docs·C=deploy)과 겹침 없음
- 한 것(공용부 계약 PR): ContractPayment 에 해지 4필드(AL~AO: 해지일·해지사유·반환액·해지숨김) + isTerminatedContract + TERMINATED_IN_CONTRACT_COUNT 상수(기본 제외 — belie 미확정, 상수 하나로 뒤집기) + SSOT 3문서 선등재(data-model·sheet-structure·components)
- 다음: feat 코드 PR(repo 파서·writeTermination·service·모달·매출 차감·테스트)
- SoR: docs/plans/active/contract-termination.md(코드 PR 이 생성), 7/10 이용호 스펙(워크로그)

### 2026-07-12 · Claude Code · [병렬트랙 A] fix/contract-delete-ghost 완주 — 02 헤더존 유령 계약 94행 수리
- 의도: 이용호(8기) 신고 ①휴힐링 삭제 불능 ②0원 계약 잔존 — Dev3-A fix 트랙 실행
- 한 것: **근인 확정(DB 실측)** = backfill 이 02 헤더·예시 구간을 row≥3 으로 적재 → 전 기수 94행 유령 카드(r3 "수납총액" 안내행 = 업체명 "0"·0원·건수 포함 / r5 "00유통" 110만 예시행 = 이월 카드), clearRow 헤더보호(row<6 거부)로 **삭제 구조적 불가** = 신고 재현. 휴힐링 r8 은 7/9 에 이미 _cleared — 초기 가설(미러 미반영)은 기각. 수리: #527(backfill 시작행 신형6/구형5 + repair 스크립트, 머지·배포 success) → VPS repair dry-run 94행 검증 → execute → **잔여 0 · 이용호 live=실계약 5건(시트 실측 ₩750,002 와 일치)**. 본 PR = isContractHeaderZoneJunk 읽기 가드 + 정합 테스트 4(총 10)
- 결정: mirror 무재시도(유령 일반형)는 R3-3(contracts 쓰기 정본 전환)이 구조 해소 — 이 fix 비접촉(§0.5). 03 DB관리 backfill 시작행(row4)은 유사 사고 여부 미검증 — db 트랙(R3-4) 확인 권장
- 다음: feat/contract-termination(계약해지 — 사유·반환·soft delete). 이용호 안내는 belie/Cowork(휴힐링 정리 확인 + 유령 카드 소멸)
- SoR: docs/plans/active/contract-delete-ghost.md, PR #527 코멘트(증빙)

### 2026-07-12 · Claude Code · [병렬트랙 C] 완주 — 관리자 Drive 토큰 서버 주입 (#524, 배포 success·200)
- 의도: 9기 생성 때 admin "기수 생성" 버튼 전원 실패(VPS .env 에 ADMIN_DRIVE_REFRESH_TOKEN
  미설정, ADR-0015) → 10기부터 버튼으로 되게 (Dev3-C: deploy.yml + docs/playbooks)
- 한 것: #524 머지·배포 success·health 200. deploy.yml 주입 스텝 **다중 키 일반화**(INJECT_KEYS,
  #481 패턴 불변 — stdin→원격 600 임시파일·awk 제자리 교체·값 미출력·rc=255 재시도) +
  ADMIN_DRIVE_REFRESH_TOKEN 추가 + 플레이북 "Secret 추가 절차" 일반화. **배포 실로그 실증**:
  DATABASE_URL "주입 OK — 키 존재 확인(값 미출력)" / ADMIN 토큰 "::warning:: 미설정 — 스킵".
  §3.5 준수: #523(계약 PR) 머지·배포 종료 대기 → 리베이스 + check.sh 재통과 → 직렬 머지
- 다음: **belie — GitHub Settings→Secrets→Actions 에 ADMIN_DRIVE_REFRESH_TOKEN 등록**
  (발급: `node scripts/get-admin-drive-token.mjs`) → 다음 배포에서 자동 주입("키 존재 확인" 로그)
  → admin 기수 생성 테스트 기수 1개 생성→삭제 왕복 확인 (남은 수용 항목 2개)
- SoR: .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md "Secret 추가 절차", PR #524

### 2026-07-12 · Claude Code · [병렬트랙 A 보충] plan 문서 소유 명시 + gcal plan §5 완료 기록 회수
- 의도: ①B트랙 docs/** 선언과의 경계 명시 ②로컬 메인 pull 차단 마지막 원인 해소(gcal plan 로컬 수정)
- 구역 보충: `docs/plans/active/{contract-delete-ghost,contract-termination}.md` = A트랙 소유 — 트랙별 plan 문서(생성·completed 이동)는 그 코드 트랙 몫. B 의 docs/** 선언과 상충 시 이 두 파일만 예외
- 한 것: google-calendar-sync.md §5 를 ✅완료(2026-07-06 Cowork 실측)로 갱신 — HANDOFF 가 "최신 정본"으로 지목한 로컬 워킹트리 수정분 회수(#511 포함 예정이었으나 누락). gcal 트랙 파일이지만 1회성 회수 — 이후 gcal 문서는 gcal 트랙/B 몫
- 다음: 로컬 메인 pull 재개(잔여 차단 3종 전부 해소: worklog·CLAUDE.md=#523, gcal plan=본 PR) → A트랙 fix/contract-delete-ghost 착수
- SoR: docs/plans/active/google-calendar-sync.md §5, CLAUDE.md §3.5

### 2026-07-12 · Claude Code · [병렬트랙 C] 관리자 Drive 토큰 서버 주입 (chore/deploy-env-admin-token)
- 의도: 9기 생성 때 admin "기수 생성" 버튼 전원 실패(VPS .env 에 ADMIN_DRIVE_REFRESH_TOKEN
  미설정, ADR-0015) → 10기부터 버튼으로 되게. Dev3-C 트랙(구역: deploy.yml + docs/playbooks —
  .github 은 공용부지만 이 트랙 전용 대상이라 예외 선언)
- 한 것: deploy.yml 주입 스텝을 #481 패턴 그대로 **다중 키 일반화**(INJECT_KEYS 루프 —
  stdin→원격 600 임시파일, awk ENVIRON 제자리 교체, 값 미출력, rc=255 재시도, 미설정=경고+스킵,
  주입 후 키 존재 검증 로그) + ADMIN_DRIVE_REFRESH_TOKEN 추가. 플레이북 "Secret 추가 절차" 일반화.
  검증: YAML 파싱 + bash -n 4스텝 + ssh 스텁 전체 시뮬레이션 7케이스(교체/추가/멱등/접두유사키/
  스킵경고/특수문자) 초록
- 다음: **belie — GitHub Settings→Secrets→Actions 에 ADMIN_DRIVE_REFRESH_TOKEN 등록**(값은
  `node scripts/get-admin-drive-token.mjs` 재발급 또는 기존 보관분). 등록 후 배포 1회 → 주입 확인
  → admin 기수 생성 테스트 기수 1개 생성→삭제 왕복 검증
- SoR: .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md "Secret 추가 절차", ADR-0015

### 2026-07-12 · Claude Code · [병렬트랙 B] R3-0 재지시 = 중복 판정 → 로드맵 등재·D3 답변됨 (#525)
- 의도: Dev3-B 지시 "R3-0 쓰기 정본 전환 플랜 등재(docs/db-write-flip-plan)" — 착수 전 §3 0.5 대조
- 한 것: db-write-flip.md = #515 기등재 + R3-1 로그 반영 확인, 지시 ①인벤토리~⑤가드 전 항목 기충족 → **재등재 안 함**(검증 로그만 추가). 실변경 = db-first-unlimited-roadmap.md 레포 등재(R2 플랜 죽은 링크 해소) + D3 답변됨(시트 미러 유지). 겸사겸사(CLAUDE.md §3.5 박제·워크로그 유니온)는 #523(A트랙 계약 PR)이 선행 이행 — 리베이스 no-op 확인
- 결정: 로드맵 파일 등재 = R3-0 이 "belie 판단 대기"로 남긴 건을 이번 오케스트레이터 지시로 확정 처리
- 다음: R3-2~5 는 오케스트레이터 지시 대기. 메인 체크아웃 #491 고착(pull 차단) 정리 필요
- SoR: docs/plans/active/db-write-flip.md(Log), PR #525

### 2026-07-12 · Claude Code · gcal 읽기 경로 45열 시트 grid limits 내성 (fix/gcal-event-ids-grid-limits)
- 의도: #521 카나리아 실측 버그 — 04 가 45열(AT 미생성)인 시트에서 gcal 읽기 400 → upsert 무음실패·[다시 올리기] 500·토글 초기상태 실패
- 한 것: readCell·readGcalStates 에 "exceeds grid limits" 400 → 빈 맵/기본 ON 처리(400+메시지 보수 가드, 그 외 에러는 전파) + 단위테스트 6종(tests/repo/gcal-event-ids-grid.test.ts) + 플랜 §2 등재
- 결정: 읽기 경로에 그리드 확장(쓰기) 안 붙임 — 확장은 setGcalEventId 만. 컬럼 없음=매핑·마커 없음(의미 동치)
- 다음: 배포 후 연습 시트(45열 상태) 회귀 확인 — 레지스트리 수정은 belie 승인 필요, 코드 리뷰·테스트 수준 검증으로 갈음
- SoR: docs/plans/active/google-calendar-sync.md §2

### 2026-07-12 · Claude Code · [병렬트랙 B] Dev3-B(260712~) 구역 선언 — docs/ 전용 (playbooks 제외)
- 의도: Dev3 병렬 배치 B트랙 시작 — CLAUDE.md §3.5 규칙 1(트랙 선언). 코드 파일 수정 금지 트랙
- 구역: `docs/**` 단 ①`docs/playbooks/**` 제외(C트랙 소유 — C 선언 준수) ②SSOT 4문서(design/components·design/tokens·domains/data-model·domains/sheet-structure)는 §3.5 공용부(계약) — 수정 필요 시 단독 PR 선행 ③`docs/worklog.md`는 전 트랙 공유 append(§3.5 예외)
- 겹침 점검: A트랙(수납 lib·app)·C트랙(deploy.yml+playbooks)과 겹침 없음(2026-07-12 확인). 워크로그 이본 유니온 병합·아카이브·헤더 복원은 A트랙 선행 계약 PR이 이미 수행 — 중복 착수 회피(§3 0.5)
- 다음: B트랙 작업 스펙 수령 후 착수. 머지는 §3.5 규칙 3(직렬 머지 + §6.8 배포 관찰)
- SoR: CLAUDE.md §3.5

### 2026-07-12 · Claude Code · [병렬트랙 A] Dev3-A(260712~) 구역 선언 — 수납(계약수납) 트랙
- 의도: Dev3 병렬 배치 A트랙 시작 — 7/10 이용호 신고 트랙(fix/contract-delete-ghost → feat/contract-termination) 실행. CLAUDE.md §3.5 규칙 1(트랙 선언)
- 구역: `lib/service/contract-payment.ts` · `lib/repo/contract-payment.ts` · `lib/repo/db/`(contracts read) · `app/(app)` 실무/수납 화면 (A트랙 전용)
- 겹침 점검: 기존 선언 = C트랙(deploy.yml + docs/playbooks) — 겹침 없음(2026-07-12 확인). B트랙 미선언 — B는 선언 시 이 구역을 피할 것
- 한 것(선행 계약 PR): CLAUDE.md §0.5·§3.5 를 master 에 박제 + 워크로그 이본 병합(로컬 Cowork 전용 항목 + master 전용 항목 유니온, 40개 규칙으로 최고(最古) 3건 아카이브) — 이 항목이 그 PR 에 포함
- 다음: fix/contract-delete-ghost(수납 화면 DB read 유령 행) → feat/contract-termination(계약해지). 머지는 §3.5 규칙 3(직렬)
- SoR: docs/plans/active/contract-termination.md(feat PR 이 생성), CLAUDE.md §3.5

### 2026-07-12 · Claude Code · [병렬트랙 C] Dev3-C(260712~) 구역 선언 — deploy.yml + docs/playbooks
- 의도: Dev3 병렬 배치(260712~) C트랙 시작 — CLAUDE.md §3.5 규칙 1(트랙 선언)
- 구역: `.github/workflows/deploy.yml` + `docs/playbooks/**` (C트랙 전용)
- ⚠️ 예외 선언: `.github/`은 §3.5 기준 공용부(계약)이지만 deploy.yml 이 이 트랙의 전용 대상이므로
  이번 배치에 한해 C트랙 단독 소유. 다른 트랙은 배치 기간 중 위 구역 수정 금지(필요 시 C에 위임)
- 겹침 점검: 로컬·origin/master 워크로그에 기존 [병렬트랙] 선언 없음 — 겹침 없음(2026-07-12 확인).
  Dev3-B 트랙은 세션 존재만 확인, 구역 미선언 — B는 선언 시 이 구역을 피할 것
- 다음: C트랙 작업 스펙 수령 후 착수. 머지는 §3.5 규칙 3(직렬 머지 + §6.8 배포 관찰)

### 2026-07-12 · Claude Code · 🐛 gcal 미팅 동기화 카나리아 — 성공경로 확인 + 45열 시트 버그 발견
- 의도: belie "미팅이 구글캘린더에 보이는지 직접 실험" — 동기화 엔진 첫 라이브 E2E 검증
- 한 것: belie 승인 하에 김믿음 행에 연습 시트 임시 연결 → 실계정으로 미팅 작성·삭제 E2E.
  **성공경로 확인**: 토글 ON 경유 시 이벤트 생성(제목·시각·장소·메모 정확, eventId 맵 기록)
  + 앱에서 미팅 삭제 → 구글 이벤트도 삭제. 실험 후 레지스트리·미팅·연결 전부 원상복구
- 사고(버그): **04 탭이 45열(A~AS)인 시트는 미팅 동기화 전멸** — gcal-event-ids 읽기
  (readCell/readGcalStates)가 AT(46열)를 ensureGridColumns 없이 읽어 "exceeds grid limits"
  400 → 생성/수정 훅 무음 실패 + [다시 올리기] 500(빈 응답). 실측 재현 완료(연습 시트).
  쓰기(setGcalEventId)만 그리드 확장 → 토글 ON 1회가 우회책(그리드 46열로 확장됨)
- 다음: **fix 필요** — 읽기 경로에서 grid 초과=빈 맵 처리(또는 ensureGridColumns).
  다른 실사용 시트 04 탭 열수 전수조사 권장(45열 시트 = 전부 동일 증상)
- SoR: lib/repo/gcal-event-ids.ts(readCell·readGcalStates), docs/plans/completed/gcal-per-user-identity.md
### 2026-07-11 · Claude Code · gcal 귀속 수정 라이브 카나리아 통과 → plan completed (#519 마감)
- 의도: belie "카나리아를 자체적으로 돌려봐" — #519(gcal 귀속·localhost 복귀 수정) 수용기준 마지막 항목을 에이전트가 직접 검증
- 한 것: 운영자 Chrome 실세션으로 2케이스 실측. ①임퍼스네이션: 표시=화면의 수강생 상태(connected:false·impersonated:true), 카드 "본인 로그인에서만" + POST/DELETE/resync 전부 403 ②본인 실연결: OAuth 동의 완주 → **salesptlog.online/calendar 복귀(localhost 0회)**, connected:true·본인 계정 귀속·캘린더 목록 실로드. 레지스트리 마스터 행 S(토큰)·T(settings) 저장 실측 후 연결해제+스크립트로 원상복구(재실측 둘 다 빈 값)
- 결정: 수용기준 전항목 충족 → plan 을 completed 로 이동
- 다음: gcal 후속(동기화 엔진 QA·다시 올리기 실사용 검증)은 별도 트랙
- SoR: docs/plans/completed/gcal-per-user-identity.md

### 2026-07-10 · Cowork(Fable) · 병렬 작업 규약 도입 (CLAUDE.md §3.5) + 첫 병렬 배치 3트랙
- 의도: 사용자 요청 — 오케스트레이터/스텝게이트 방식 중 우리 하네스에 없는 것만 도입해 병렬 개발
- 한 것: CLAUDE.md §3.5 신설 — ①트랙 선언(worklog에 구역 명시, 겹치면 순차) ②구역 소유+계약 먼저(공용부 변경은 단독 PR 선행) ③병렬 구현·직렬 머지(머지는 한 번에 하나+리베이스). 기존 하네스와 중복되는 것(AGENTS.md·문서 재편·tmux)은 기각
- 결정: 오케스트레이터 = Cowork 세션(프롬프트 생산·게이트 검증), 머지 게이트 = 기존 §6.8 그대로
- 다음: 첫 병렬 배치 — A트랙(수납: fix/contract-delete-ghost→feat/contract-termination), B트랙(R3-0 docs), C트랙(chore/deploy-env-admin-token). 구역 안 겹침 확인됨
- SoR: CLAUDE.md §3.5

### 2026-07-10 · Cowork(Fable) · 이용호 신고: 계약 삭제 불능(휴힐링) + 계약해지 기능 스펙 확정
- 의도: 8기 이용호 신고 ①휴힐링 계약 삭제 안 됨(환불+수임비 0 처리 후) ②계약 해지 경우의 수 없음
- 한 것: 레지스트리·이용호 시트 실측(계약 5건·수임비 ₩750,002 — 0원 계약이 건수에 잔존). 유력 가설 = R2-4 이후 화면은 DB read인데 삭제가 DB 미러에 미반영(유령 행 — A1-5 전례 부류). fix/contract-delete-ghost + feat/contract-termination 프롬프트 전달
- 결정(사용자 스펙): 실무/수납 각 계약에 [계약해지] — 사유 필수, 반환(없음/일부/전액+금액), 해지 상태 보존 또는 삭제 선택. **매출 = 수임비+수납 − 반환액(삭제여도 반환분만 차감)** → 삭제 = soft delete(숨김·데이터 보존)로 구현해야 규칙 성립. 해지 계약의 건수 반영 기본값 = 제외+"해지 N건" 별도 표시(단일 상수로 변경 용이하게 — belie 미확정 항목)
- 다음: fix 먼저 → feat. 완료 후 이용호 안내(휴힐링 정리 + 해지 기능 사용법)
- SoR: docs/plans/active/contract-termination.md(feat PR이 생성)

### 2026-07-10 · Claude Code · gcal 귀속 사고 수정 완주 (#519) — 임퍼스네이션 오귀속·localhost 복귀
- 의도: 실사용 사고 2건 — ①임퍼스네이션 화면마다 "연결됨"+마스터 행에 연결 저장 ②연결 후 localhost 복귀(수강생 실패 오인)
- 한 것: #519 머지·배포 success·200. 진단 확정: 6라우트 전부 세션 기준(표시까지) — 훅·다중행은 원래 안전.
  수정: gcalActorFrom(순수·4테스트) — 표시=active(그 수강생)/조작=본인만(403·selfonly), 카드 3상태
  임퍼스네이션 비활성+안내, appBaseUrl(AUTH_URL) 단일 기준으로 callback 복귀 localhost 제거,
  [다시 올리기] 힌트 토스트. 오염 정리: 마스터 행26 T(settings) 비움(S토큰은 원래 빈값 — 실토큰 오염 없었음).
- 결정: (프라이버시) 수강생 실이메일·이름을 커밋/PR/테스트에 넣지 않는다 — 분류기 차단 계기,
  픽스처는 example.com, 문서는 익명 표기(식별정보는 레지스트리에만). 이번 PR 아멘드로 소급 적용.
- 다음: 라이브 카나리아(belie 1분) — 실계정 연결→salesptlog.online 복귀+연결됨 뱃지+임퍼스네이션 selfonly 확인.
  통과 시 plan gcal-per-user-identity → completed 이동.
- SoR: docs/plans/active/gcal-per-user-identity.md, PR #519

### 2026-07-09 · Claude Code · R3-1 컨택 4지표 쓰기 정본 전환 (feat/db-write-daily) — 첫 R3 코드 PR
- 의도: belie "1,2,3 순차/논스톱"의 ②. R3-1=sales 컨택 4지표 저장을 시트→DB 정본으로 뒤집기(파일럿만)
- 한 것: `chooseWriteSource`(daily-source.ts, 읽기 게이트 대칭·isDbReadPilot 재사용) + `writeSalesRowsToDb`
  (client.ts **트랜잭션 원자 upsert**, 실패=throw 저장실패·시트폴백 금지) + `sales-write.ts`(persistSalesRows
  게이트 + fireSheetMirror 시트 비동기 미러 3회 백오프) + sales.ts `{mirror:false}` 옵션(DB 재미러 차단).
  contact.ts saveContactMetrics 를 persistSalesRows 로 위임(추출로 502→500줄). check.sh 초록(유닛 384)
- 결정: **스코프 = 4채널 배치 저장만**. 단일셀 writer(writeProductionCell E집계·decrement H)는 R2 유지
  (이미 R2 async DB미러 신뢰 중 → 비회귀). DB payload=R2 미러와 동일 → DB 읽기 동일값. 적대적 리뷰 진행
- 다음: **⚠️ 라이브 학생 저장경로** — ①(detached 배포)이 health 200 확인된 뒤 머지·배포 관찰. 롤백=chooseWriteSource 게이트 뒤집기 즉시 R2. 후속 R3-2(미팅)
- SoR: docs/plans/active/db-write-flip.md §6 R3-1, lib/service/sales-write.ts

### 2026-07-09 · Claude Code · 🛡️ 배포 원격 스크립트 detached 실행 (chore/deploy-detached-remote)
- 의도: belie "1,2,3 순차 진행"의 ①. 2026-07-09 사이트다운 인시던트(연결끊김→`.next` 손상→502) 하네스 재발방지
- 한 것: deploy.yml "Deploy on VPS" 스텝의 **실행 래퍼만** 교체($REMOTE 본문 불변). 동기 `ssh "$REMOTE"` → 원격 `.deploy/` 에 스크립트 업로드 후 `setsid ... </dev/null >/dev/null 2>&1 &` **detached 실행** + 상태파일(`<run>.status`) **재접속 폴링**(최대 25분) + 전체로그 덤프. `flock` 로 VPS 상 배포 직렬화. ssh_do(rc=255만 7×20s 재시도, stdin 파일 재오픈). YAML 파싱·`bash -n` 4스텝 초록 + 적대적 리뷰(따옴표/errexit/detach/race 4차원)
- 결정: **배포 성공/실패 정본 = 원격 `.status` 코드**(러너 연결상태 아님). 연결이 swap 도중 끊겨도 배포는 완주 → 사이트다운 원천 차단. 문서 반영: deploy-vps.md §0, CLAUDE.md §6.8
- 다음: ②R3-1(컨택 쓰기 뒤집기). ⚠️ **첫 배포가 이 래퍼의 실전 첫 테스트** — 머지 후 run 관찰 필수(래퍼 버그 시에도 $REMOTE 원자 swap 이 사이트 보호). belie 최우선=provider 도달성 장애 해소(③)
- SoR: .github/workflows/deploy.yml, docs/playbooks/deploy-vps.md §0, docs/incidents/2026-07-09-deploy-connection-drop-site-down.md

### 2026-07-09 · Claude Code · 🚨 배포 연결끊김으로 사이트 다운→복구 + #490 닫기·#516 살림
- 의도: R3-0 후 belie "겸사겸사 #490 처리". #490 판정·정리 + 그 과정의 인시던트
- 한 것: **#490 닫기**(finalize-cohort9.mjs 이미 #11로 master·수리 실행완료·CONFLICTING). 유일 고유콘텐츠(setup-sheets #VALUE! 재발방지)는 **#516 으로 살림**(머지·배포). 그런데 **#516 배포가 도달성장애로 실행중간 끊겨 `.next` 손상→크래시루프→502 사이트다운**. `gh run rerun --failed` 재빌드로 **복구(health 200·pm2 uptime 안정)**
- 결정: **인시던트 박제** docs/incidents/2026-07-09-deploy-connection-drop-site-down.md. 근본원인=rc=255 도달성장애가 원격 스크립트를 swap 부근에서 끊음(deploy.yml 은 원자스왑 설계인데도 연결 끊기면 깨짐). **도달성장애가 이제 사이트다운 리스크로 격상** → 위 detached chore 로 재발방지
- 다음: **belie 최우선 — provider 도달성장애 해소**(배포마다 재확인 성가심 지속). 위 detached 로 사이트다운은 차단됨
- SoR: docs/incidents/2026-07-09-deploy-connection-drop-site-down.md, .github/workflows/deploy.yml

### 2026-07-09 · Claude Code · R3-0 쓰기 정본 전환 설계 등재 (docs) — R3 착수
- 의도: gcal 트랙 종료 후 belie "R3 착수". R3 프롬프트는 세션 압축돼 있어 세션 기록에서 원문 복원(못받은 것 아님). R3-0=쓰기 정본 전환 설계 문서(docs PR)
- 한 것: docs/plans/active/db-write-flip.md 신규 — 쓰기경로 인벤토리(7탭: sales·meetings·todos·contracts·company_archive·db·carryover, dual-write 미러 훅=R3 정본 대상)·전환 패턴(DB 동기 정본+시트 비동기 미러, 실패=사용자에러·폴백금지)·드리프트 감시·**탭별 롤백 스위치**·가드 유지(§2.5·편집기간, 은퇴는 R4)·PR 분할(R3-1~5). db-migration-pilot §0 에 D3(미러 유지) 답변 확정
- 결정: **⚠️ 불일치 발견** — R2 완료 플랜들이 `db-first-unlimited-roadmap.md` 를 관련문서로 참조하나 **그 파일은 부재(죽은 링크)**. R3 SoR 는 db-write-flip.md + db-migration-pilot.md 로 확정. 로드맵 파일 생성은 스코프 밖(belie 판단 대기)
- 다음: R3-1(feat/db-write-daily — sales 컨택 4지표 쓰기 뒤집기, 첫 코드 PR). R3-1 프롬프트는 세션 기록에 있음(복원 가능)
- SoR: docs/plans/active/db-write-flip.md, db-migration-pilot.md §0

### 2026-07-09 · Claude Code · gcal-2b 일정별 토글+다시올리기+계정표시 완주(#514) — gcal 트랙 종료
- 의도: gcal-2a 라이브검증 후 gcal 그룹 마지막 PR. 자동 담기 위에 "원하는 일정만 빼는" 개별 토글 + [다시 올리기] + 계정 표시. Changelog-Done 으로 gcal 새소식 공개
- 한 것: #514 머지·배포 success·health 200, VPS=master=`c1cba7e`. GcalItemToggle(제어형·낙관적·stopPropagation) + 카드 개정 + gcal-sync(toggleSchedule/removeOne/resyncAll) + gcal-event-ids(readGcalStates 배치·keepOnlyMarkers) + gcal-schedule-read + /api/gcal/{toggle,resync,states}. 제외 마커 "-"(upsert 존중). check.sh 380 초록
- 결정: **적대적 리뷰 2R로 결함 6종 수정** — CRITICAL 무한 리페치 루프(`?? []` 새배열→매렌더 재발화, 모듈상수로 안정화) / MAJOR 멀티계정 제외마커 유실(removeAll preserveMarkers+keepOnlyMarkers) / MAJOR 행삭제 마커잔존→행재사용 오염(2R 회귀, 전체비움) / resync O(N)·pushed 과다·states 낙관값 덮음
- 다음: **belie 브라우저 카나리아**(토글 OFF→구글에서 사라짐/ON→재등록, [다시 올리기], 계정 표시, 미팅만/투두만 있는 날 렌더 정상=루프 없음). belie 잔여: 레지스트리 66~70행 삭제(시트 UI), DATABASE_URL 비번 로테이션
- SoR: docs/plans/active/google-calendar-sync.md §2·§4·§6 PR-3b

### 2026-07-09 · Claude Code · gcal-2a 일정 자동 담기 엔진 완주(#513) — 배포·health 200
- 의도: gcal-1 카나리아 통과(belie vigilantback@gmail.com "연결됨") 후 gcal-2 착수. belie 결정으로 **2a(엔진)/2b(토글) 분할**. 2a = 연결 시 미팅·투두·일반이벤트를 구글에 단방향 자동 등록
- 한 것: #513 머지·배포 success(첫 시도)·health 200, VPS=master=`722e0ce`. 신규 gcal-client(v3 insert/patch/delete+salesptId dedup)·gcal-event-ids(meetings AT·todos O 사용자별 맵, 셀 뮤텍스)·gcal-sync(멱등 reconcile, fire-and-forget). 훅=contact.ts(미팅 CRUD·revert)+todos.ts. **미팅/투두 시트 쓰기 무접촉 설계**(AT/O 가 split-write 범위 밖 → meetings.ts/todos.ts/config 무변경, 사고 반경 0). 매핑 10테스트+380 초록
- 결정: 적대적 리뷰 2라운드로 **결함 7종** 잡아 수정(자정 end<start 무성손실→다음날 롤오버 / 재시도 중복삽입→salesptId 멱등 / 멀티계정 삭제 고아·행재사용→전사용자삭제+셀폐기 / revive 자식 누락 / lost-update→뮤텍스 / 뮤텍스 unhandledRejection). 자손 cascade·개별토글·다시올리기·계정표시는 gcal-2b
- 검증(라이브, VPS 1회성 스크립트): 연결된 토큰으로 구글 캘린더 왕복 확인 — 삽입✅·salesptId 멱등조회✅·patch(16:30KST=07:30UTC, 정상)✅·삭제·정리✅. 토큰 복호화·유효 확인. **실사용 발견: 강구수(gusutaepyeong)도 실제 연결**(설정 kgusu891024 커스텀 캘린더). belie(beliefkimkim)=vigilantback 캘린더
- 다음: gcal-2b(feat/gcal-toggle-resync). **belie 확인 필요: 레지스트리 유령행 5개**(이메일 없이 S=평문/T=`2026-08-01` — gcal 컬럼에 엉뚱한 값, gcal 처리엔 무해=이메일없어 앱이 안 건드림, 레지스트리 위생만). DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/google-calendar-sync.md §3·§6 PR-3a, gcal_event_ids=sheet-structure §3(AT)/§5-2(O)

### 2026-07-09 · Claude Code · gcal-1 개정 완주(#512) — 유형 토글 폐기, 배포·health 200
- 의도: 사용자 2026-07-09 설계 변경 — 대상 유형 토글 3종(미팅/실무/일반) 폐기 → 일정별 개별 토글(기본 ON). 이미 머지된 gcal-1(#511)의 개정 PR
- 한 것: #512 머지·배포 success(첫 시도, 도달성 장애 없음)·공개 health 200, VPS=master=`00bce6f`. GcalSettings/SettingsPatch/카드/타입주석에서 토글 3종 제거→calendarId 만, 하위호환(옛 토글키 Zod strip)+parseGcalSettings 5테스트, SoR §0·§2·§4·§8+문서 6종 동기화. 적대적 리뷰 워크플로 3축→확인 결함 3건(스테일 주석·요약카드) 수정 후 머지
- 결정: [다시 올리기]·계정 표시·일정별 개별 토글은 **gcal-2(엔진 필요)로 확정 미룸**. gcal-connect plan 은 라이브 카나리아(belie)까지 active 유지. GCP 사전작업은 belie 이미 완료(7/6~7, #477/#479)
- 다음: belie 라이브 카나리아(연결→"연결됨"→캘린더 선택→해제). 이후 gcal-2(feat/gcal-sync-engine) 착수. DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/gcal-connect.md, google-calendar-sync.md §6 PR-2

### 2026-07-09 · Claude Code · gcal-1 구글 캘린더 연결 완주(#511) + VPS 배포·health 200
- 의도: gcal-1(OAuth 연결/해제 + refresh token AES-256-GCM 암호화 + 연동 카드) PR 완주 → 배포까지(§6.8)
- 한 것: #511 머지(레지스트리 S/T 컬럼 append, gcal-crypto 7테스트, 3라우트, 카드 3상태). 배포는 **GH러너→VPS:22 도달성 장애(#495 계열) 연속 실패(#510 2회·#511 초기)** → `gh run rerun --failed` **새 러너에서 성공**. VPS=origin/master=`d644567`, 공개 health 200. (PC-SSH 수동배포는 오토모드 가드가 차단 → 파이프라인 재시도로 정상 완주, 수동 불필요)
- 결정: 도달성 장애는 provider-edge — rerun 우회 가능하나 재발성이라 belie 가 provider 방화벽 점검 필요. GCP 사전작업은 이미 belie 완료(7/6~7, #477/#479) — 직전 보고에서 잘못 미완으로 표기했던 것 정정
- 다음: gcal-1 설계 개정(유형 토글 폐기, 아래 항목), 이후 라이브 카나리아(belie), DATABASE_URL 비번 로테이션(보류)
- SoR: docs/plans/active/gcal-connect.md, docs/plans/active/google-calendar-sync.md §6

### 2026-07-09 · Cowork(Fable) · gcal 설계 변경: 유형 토글 3종 폐기 → 일정별 개별 토글(기본 ON)
- 의도: 사용자 요청 — 캘린더 탭에서 일정마다 연동 토글, 토글 상태 따라 구글 이벤트 자동 생성/삭제
- 한 것: 구조 확정(**개별 토글만 + 디폴트 ON** — 유형 토글 미팅/실무/일반 제거, 사용자 선택). gcal-1·gcal-2 프롬프트 개정판 전달(개별 토글은 엔진 필요 → gcal-2에 배치, gcal-1 카드에서 토글 3종 제거)
- 결정: 저장 구조 = gcal_event_ids 사용자별 값 eventId(켜짐)|"-"(껐음, 제외 마커 — 수정 훅·[다시 올리기]가 되살리지 않음), 키 없음=기본 ON. 연결 해제 시 기존 이벤트 잔존 원칙 유지(개별 토글 OFF만 구글에서 삭제). SoR §0·§2·§4·§8 갱신은 gcal-1 PR에 포함
- 다음: gcal-1 착수 가능(R2 완주됨) → gcal-2 → R3-0
- SoR: docs/plans/active/google-calendar-sync.md

### 2026-07-09 · Claude Code · R2-7b 대시보드 서빙 DB 전환 완주 (#509) — R2 읽기 전환 트랙 종료
- 의도: R2-7a 그림자 대조로 검증(51/52)된 대시보드 DB 집계를 실제 서빙으로 전환
- 한 것: #509 머지·배포 success 2.6분·health 200. loadDashboard 2경로(파일럿=loadDashboardFromDb 시트왕복0, 비파일럿=시트 무변경 리팩터)+assembleView 공용. 안전밸브 2중(DB실패→시트강등+Sentry / 역방향 그림자 reverseShadowCompare=서빙후 시트 async 대조 diff시 경보). 358테스트·비파일럿 불변
- 결정: 검증2(능동 시나리오)는 속도지시(세션내 수동 라이브검증 금지)와 상충 → 배포후 라이브 카나리아+역방향 그림자 감시+강등 안전밸브로 대체(검증1 실데이터 전케이스 커버로 등가). **R2 트랙 완주: 컨택·일정·수납·DB생산·캘린더·대시보드 6화면 전부 파일럿 시트 read 0**
- 다음: gcal-1(feat/gcal-connect)→gcal-2 → R3-0(쓰기 전환). 배포후 대시보드 p50/p95 관찰(#509 코멘트). 보안: DATABASE_URL 노출 비번교체 belie 대기
- SoR: docs/plans/completed/db-read-dashboard.md, docs/plans/completed/db-dashboard-aggregates.md

### 2026-07-09 · Claude Code · R2-7a diff 근인 A·C 완전 해결 (#508) — 51/52 정확일치
- 의도: #507 그림자 대조가 잡은 diff 3근인을 완전 해소(사용자 지시 "A·C 완전히 해결")
- 한 것: #508 머지·배포 success. **시트 수식 FORMULA 렌더로 직접 규명** → A(로직) 수정: R1:U6 R4미팅예약=상태∈{예약,완료,계약}·이월제외, R5미팅완료=상태∈{완료,계약}·이월제외, 활동량 미팅항=미팅완료(by미팅날짜)×2(sales.meetingReservation stale 폐기). C(데이터): mymk1005 실데이터가 A1-5 수렴때 유령 오마킹→_cleared 11행 해제+재backfill로 Σ생산0→33(시트일치). **재대조: 52명중 diff0=51, 규명예외1(zzzddz01=시트 02↔04 계약상태 불일치, 집계로직 무관)**
- 결정: 활동량 정확산식 확정=생산×1+컨택×1.5+미팅완료×2(이월제외). 미팅 퍼널 카운트는 stale sales 아니라 미팅카드 실시간+이월제외. R2-7b 게이트("diff0 또는 규명예외만") 충족
- 다음: R2-7b(서빙 전환) — 검증1(전수배치 완료=이 결과)+검증2(연습 능동시나리오) → 전환. 그 후 gcal-1→2. **보안: DATABASE_URL 세션로그 노출건 belie 비번교체 대기**
- SoR: PR #508 코멘트(전수대조표), docs/plans/active/db-dashboard-aggregates.md

### 2026-07-09 · Cowork(Fable) · 스코프 확정(R3까지) + R4 알림 예약 + gcal 재개
- 의도: 사용자 결정 — 이번 스코프는 R3까지, R4는 아레나 시즌1 종료(8/1) 후. 접어둔 기능(gcal) 재개
- 한 것: R4 착수 준비 알림 예약(7/25 09:00, scheduled task r4-kickoff-reminder — R3 상태 확인+D2 리마인드 포함). gcal-1(feat/gcal-connect)·gcal-2(feat/gcal-sync-engine) 프롬프트 전달. 메모리(project-db-first-roadmap) 갱신
- 결정: gcal 순서 = R2-7 마무리(미팅예약 로직 수정 + mymk1005 sales 재backfill + R2-7b) **후** 순차 — #507이 찾은 diff 3근인 중 C는 실사용자 화면 영향이라 gcal보다 우선. DATABASE_URL 노출 건은 belie에게 비번 교체 재권고(결정 대기)
- 다음: R2-7 마무리 → R2-7b → gcal-1 → gcal-2 → R3-0. 9기 클레임 안내(내일 7/10)
- SoR: docs/plans/active/google-calendar-sync.md, docs/plans/active/db-first-unlimited-roadmap.md

### 2026-07-09 · Claude Code · R2-7a 대시보드 그림자 대조 완주(#507) — diff 3근인 발견, R2-7b 게이트 미충족
- 의도: 대시보드 시트수식 4종(R1:U6·N·H·B21) raw 재계산 + 그림자 대조(응답은 시트값). 재계산 스펙은 워크플로(4설계→4적대검증)로 확정
- 한 것: #507 머지·배포 success·health 200. dashboard-aggregates.ts(순수4함수+shadowCompare fire-and-forget)+dashboard-parity.mjs(전수배치)+정합9테스트. 배포후 전수대조: **52명 중 diff0=35, diff발생=17(48건)** — 그림자가 정확히 3근인 노출
- 결정(diff 근인): **A[로직·수정확정]** 미팅예약(R1:U6 R4)=Σsales 아니라 상태='예약' count(sangjun 시트6 vs 카드수9 실측). **B[로직·A연동]** 활동량(H) 미팅항이 A와 같은 오차(주3 +6=미팅 +3×2) → A수정후 재대조로 확정. **C[데이터·R2-1 라이브영향⚠️]** mymk1005(A1-5) DB sales 27행 전부 값0(시트엔 실데이터) = backfill sales-0 공백(#488계열) → 파일럿이라 컨택화면이 0 표시 중일 수 있음, sales 재backfill 필요
- ⚠️ **보안사고**: SSH 명령 export \$(grep..) 빈결과→export단독→셸 env 덤프로 **DATABASE_URL 값 세션로그 노출**. Supabase 비번 교체 권장. 이후 node가 .env 직접로드(셸덤프 방지)
- 다음: A 수정(미팅예약=상태예약)→재대조로 B확인 · C 영향사용자 식별+sales 재backfill · diff0 확인후에만 R2-7b. R3 파이프라인은 R2-7b 후
- SoR: docs/plans/active/db-dashboard-aggregates.md, PR #507 코멘트(대조표·진단)

### 2026-07-09 · Claude Code · R2-4b·R2-5·R2-6 완주 + R2-7a 착수 (탭 전환 6개 완료)
- 의도: R2 읽기 전환 파이프라인 계속 — 업체정보 카드(4b)·DB생산(5)·캘린더(6) DB 전환 후 대시보드(7a) 착수
- 한 것: #502(R2-4b 업체정보 06)·#504(R2-5 DB생산 4섹션)·#506(R2-6 캘린더 미팅+투두) 전부 머지·배포 success·health 200. **파일럿 기수는 컨택·일정·수납·DB생산·캘린더 6탭 전부 시트 read 0회.** #498 배포 캐시로 배포 2.5~2.7분 유지. R2-7a(대시보드)는 재계산 스펙을 워크플로(4 설계→4 적대적 검증)로 확정 중
- 결정: (1) R2-5 직접생산 "생산중"(종료일 빈) 행 — 배열 파서 neo 감지 밀림 → dual-write 필드명은 Zod, backfill 열문자만 파서(형태별 분기). (2) R2-6 캘린더는 투두 read 도 있었음(프롬프트 예상=미팅만) → todos=meetings 쌍둥이라 새 스키마 아님. (3) **교훈: 같은 워크트리에서 백그라운드 git 커밋 + 포그라운드 브랜치 전환 동시 실행 금지** — R2-6 docs 이동 커밋이 R2-7a 브랜치에 얹히는 사고(무해 복구, R2-7a PR이 함께 태움). 워크트리 git 작업은 직렬화
- 다음: R2-7a 워크플로 스펙 확정 후 집계+그림자 대조+전수 배치 스크립트 구현. R2-7b(검증 절차 통과 조건 — 세션 내 완주 가능)
- SoR: docs/plans/completed/db-read-{company-archive,production,calendar}.md, docs/plans/active/db-dashboard-aggregates.md

### 2026-07-09 · Claude Code · 대시보드 캡처 6장 (기능설명 '대시보드 깊게 읽기' 편) [콘텐츠]
- 의도: 카페 연재 2단계(기능설명) 대시보드 편 이미지 — 연습 계정·실렌더·스크롤 전 구간
- 한 것: dev(stub=practice@salespt.local)+Playwright(412px·DPR2), tall-viewport 전체 1샷 +
  섹션 5샷(제목 기준 카드 bbox±12px) → screens/에 대시보드_{전체,A_상단,B_생산성지표,
  C_퍼널차트,D_주차추이,E_채널성과}.png. Next dev 도구 버튼(N) 제거 후 재촬영, 육안 검증 2장.
- 결정: 전체샷은 fullPage 대신 **뷰포트=콘텐츠 높이** 방식(고정 하단 STEP 탭이 자연 위치).
  캡처 스크립트 = scratchpad(shot/capture-dashboard.js) — 재사용 시 복사.
- 다음: 마커·프레임은 belie(Cowork 콘텐츠 세션)가 씌움. 사고 부기: 메인 체크아웃 npm ci 가
  좀비 dev 서버(내 3986)에 잠겨 실패→프로세스 종료 후 복구(node_modules 최신화 부수효과).
- SoR: 경영일지 앱관련 카페글쓰기/screens/, _기능설명_보류(2단계)/

### 2026-07-08 · Cowork(Fable) · 비판적 사고 프로토콜 박제 (CLAUDE.md §3 0.5단계) — ※헤더 복원
- 의도: 지시-목적 불일치·중복 요청·안전장치 과부족을 실행 전에 걸러내고, 상호 납득으로 완급 조절되는 개발(사용자 지시)
- 한 것: CLAUDE.md §3에 0.5단계 추가 + Cowork 메모리(feedback-critical-thinking) 박제. 내용 = 실행 전 ①목적 정합 ②더 나은 방법·중복·악수 ③안전장치 과부족 점검 → 납득 안 되면 질문, 반박은 쉬운 말+대안, 재확인 시 수용
- 결정: R2-7b "3일 그림자 관찰" → 전수 배치 대조+능동 시나리오 배터리로 개정(이 프로토콜의 선례 — 사용자 비판이 설계를 개선)
- 다음: CLAUDE.md·worklog 변경분은 다음 docs PR에 편승 커밋. 떠 있는 세션엔 지침 추가 한 줄 프롬프트(워크로그 도입 때와 동일 방식)
- SoR: CLAUDE.md §3 0.5, 메모리 feedback-critical-thinking

### 2026-07-08 · Cowork(Fable) · D3 결정 확정(시트 자동 미러 유지) + R3 프롬프트 시리즈 전달
- 의도: R2 후속 R3(쓰기 정본 전환) 착수 준비 — 로드맵 D3 결정을 사용자에게 받음
- 한 것: **D3 = 자동 미러 유지** (DB 정본 전환 후에도 시트에 사본 자동 기록 — 트레이너/운영 열람·롤백 안전망).
  R3-0(플랜 docs)~R3-5(기수 생성 DB화) 프롬프트 시리즈 전달. R2-2~R2-7b 프롬프트는 이미 전달됨(순차 실행 중)
- 결정: D3 확정 → R3-0 docs PR 이 로드맵 D3 항목을 답변됨으로 갱신할 것. R3 전 기간 §2.5 보존 가드·편집기간
  가드 유지(가드 은퇴는 R4 재정의와 함께). R3-5(기수 생성)는 chore/deploy-env-admin-token 선행 필요
- 다음: R2 시리즈 완주 관찰 → R3-0 착수. 9기 7/10 클레임 안내는 여전히 대기
- SoR: docs/plans/active/db-first-unlimited-roadmap.md(R3·D3)

### 2026-07-08 · Claude Code · R2-4 실무/수납 DB 전환 완주 (#500) — R2 파일럿 읽기 4탭 완료
- 의도: R2 트랙 4호 — 02 계약수납 전체 스캔(최중량 read) 제거, 이월 필드 정합 사수
- 한 것: #500 머지·배포 success 2.6분·health 200. contracts payload 3형태 흡수(rowToCP 재사용), 이월 픽스처 정합 5테스트, sheets_calls 2→0(resolveLayout 포함). plan 2건(R2-3·R2-4) completed 이동 docs PR 진행
- 결정: company_archive(06)=R2-4b 분리(작음 — read-daily 함수 1개). R2-5(DB생산) 사전조사 완료: loadDBOverview 4 read → db 탭 미러 1쿼리+섹션 파서 재사용이면 됨(패턴 동일)
- 다음: R2-4b, R2-5 [작업] 대기. 속도 후 수치(#491·#496·#499·#500 코멘트, api_timing 쌓이면). 컨택·일정·수납 3탭 = 파일럿 시트 read 0회 상태
- SoR: docs/plans/completed/db-read-payments.md, lib/repo/db/read-daily.ts

### 2026-07-08 · Claude Code · R2-3 일정탭 DB 전환(#499) + 배포 캐시(#498) 완주, R2-4 PR 오픈(#500)
- 의도: R2 트랙 3호(일정·계약 탭) + 배포 시간 단축 chore 를 한 파이프라인으로(캐시 실측에 배포 재활용)
- 한 것: **#498** npm ci 스킵 게이트+빌드 캐시 보존 — 실측 기준선 4.86분 → 1회차 3.4분(-30%) → 2회차 **2.5분(-49%)**, clean=true 탈출구 검증(4.9분 회귀+강제 로그), playbook 절차 추가. **#499** loadWeekMeetings DB 전환(readMeetingsFromDb 재사용, 새 repo 함수 0 = R2-2 설계 검증, funnel=weekFunnelFromRows 동치) — 시트 3→0회, 배포 success·health 200. **#500**(R2-4 실무/수납) PR 오픈 — contracts payload 3형태(backfill 열문자 C..AK/전체 객체/append 부분+이명 meetingId·원본행id) 흡수, 이월 필드 정합 5테스트, company_archive 는 R2-4b 분리(사유=plan)
- 결정: 배포는 이제 캐시 경로가 기본(2.5분대), 빌드 이상하면 clean=true 1회(playbook). contracts 는 미러 사이트 2곳이라 payload 형태가 3개 — 이후 탭 전환 시 미러 사이트별 payload 형태 수부터 셀 것
- 다음: #500 머지·배포 관찰(진행 중), R2-4b(06 company_archive), R2-5(DB생산 탭) 사전조사, 속도 후 수치(#491·#496·#499·#500 코멘트)
- SoR: docs/plans/active/db-read-payments.md, docs/plans/active/db-read-schedule.md(완료 이동 예정), PR #498 코멘트(실측표)

### 2026-07-08 · Claude Code · R2-2 컨택 미팅·현수막 읽기 DB 전환 완주 (#496)
- 의도: R2 읽기 전환 2호 — loadDay 잔여 시트 왕복(findByDate 미팅카드·readBanners 주문합) 제거 → 파일럿 컨택 탭 **시트 read 0회**
- 한 것: #496 머지(36c6dc7)·배포 conclusion=success·health 200. lib/repo/db/read-daily.ts 신설(readMeetingsFromDb·readBannerOrderQtyFromDb), loadDay DB 3쿼리 병렬+전체 시트 fallback, 정합 8테스트, plan completed 이동 후속 docs PR 진행. sheets_calls 5→2(R2-1)→0(본 PR, 캐시 히트 시)
- 결정: **payload 두 형태 공존 발견** — dual-write=필드명 키, backfill=열문자 키·문자열화(직렬날짜 "46042"·"true"). 변환기(meetingFromDbPayload)가 필드명 우선→열문자를 행 배열 복원해 rowToMeeting 재사용으로 흡수. **R2-3 등 이후 모든 DB read 는 이 이중 형태를 반드시 고려**(read-daily.ts 참조). 미팅 카드 순서는 예약시각 정렬(결정적, 시트 행순과 다름 — 중립)
- 다음: R2-3(일정·계약 loadWeekMeetings·캘린더 — readMeetingsFromDb 재사용만 하면 됨), #491·#496 속도 후 수치(파일럿 api_timing 쌓이면 PostHog HogQL→PR 코멘트), 대기열 gcal-connect→sync-engine
- SoR: docs/plans/completed/db-read-meetings-banners.md, lib/repo/db/read-daily.ts

### 2026-07-08 · Claude Code · R2-1.5 아레나 backfill 수렴 완료 — PC 직행 SSH(승인) 경로
- 의도: "끝까지 완료" — GH 차단으로 대기 중이던 아레나 backfill 을 수렴시켜 R2-1.5 종결
- 한 것: belie 승인 후 PC→VPS 직접 SSH 로 backfill execute 2회 → DB 대조: **전 탭 기준값
  (dry-run 1,083행) 이상, 미달 0** (m162/c229/t27=일치/s437/db247/ca78, 전체 1,467행 ≥
  목표 1,370). 증빙 = PR #492 코멘트. 반복 run 의 스킵 경고는 읽기측 429 노이즈로 판명.
- 결정: **진단 정정 — fail2ban 아님**(VPS 실측: fail2ban 미설치·ufw inactive·거부 로그 0)
  → GH러너 차단은 **호스팅 제공사 네트워크 엣지**. 서버측 조치 불필요, #495 재시도가 정답.
- 다음: p50/p95 후 수치(아레나 유입 후 PostHog → PR #492 코멘트). GH 경로 복구는 다음
  deploy success 로 자동 판정. R2-2(meetings·banners 읽기 전환) 착수 가능.
- SoR: docs/plans/active/db-pilot-arena.md

### 2026-07-08 · Cowork · 사용법 시리즈 재기획 실행 (워크플로우 순서로 재배치) [콘텐츠]
- 의도: (belie) 탭별 how-to 전에 영업 워크플로우를 먼저 가르치고 탭 개념 매핑 + 앱 STEP 순서대로(DB생산 먼저) 재정렬
- 한 것: 기획 v2 확정(`_사용법시리즈_기획_상세.md`). 12편 폴더/파일/제목/다음편링크 일괄 재번호: **02=워크플로우·탭지도(신설), 03=DB생산(STEP1), 04=컨택관리(구02)**, 05 미팅잡기·06 미팅결과(4케이스 상세)·07 실무수납·08 캘린더·09~12 유지. 구08 대시보드는 `_기능설명_보류(2단계)/`로 이관. 표지 6장(02·04·05·06·07·08) 재렌더, EP2 이미지 신규 2종(탭지도 개념도·대시보드 목표판) 제작·검증. 인벤토리 정합 확인(프리픽스=폴더번호, 마커수=본문)
- 결정: EP6 미팅결과는 완료·계약·변경·취소 4케이스 각각 상세(+되돌리기·추가미팅). 대시보드 '심화 읽는 법'은 **2단계 기능설명 시리즈**로 분리(사용법 12편 유지). 연재 순서 = 사용법→기능설명
- 다음: 재배치된 04~08 화면 마커/legend가 새 번호와 맞는지 최종 확인(마커 이미지 자체는 화면 동일이라 유효), 기능설명 시리즈 목차, 게시는 운영세션
- SoR: `경영일지 앱관련 카페글쓰기/사용법/_사용법시리즈_기획_상세.md`, 메모리 feedback-usage-series-writing

### 2026-07-24 · Codex DevC · DB 자동 비용 원장 정합 R5 구현
- 의도: `03 DB관리` 자동 비용을 월별·전체·카테고리 비용 원장에 읽기 전용 시스템 행으로 노출하고, DB-primary + sheet fallback에서 같은 금액·인식 규칙을 사용
- 한 것: 직접생산 신규 I:O 생산중/비정상 날짜 parser 보존, `loadDBOverview` 기반 매입·직접생산·현수막 원장 투영, system/readOnly·인식 상태/메모·선택 범위·DB/추가/합계·카테고리 금액/건수/비중 계약 추가, 108만원·월 경계·ongoing·unallocated·수동/반복 합산 회귀 추가
- 결정: 유효 기간은 양끝 포함 일할, 종료일 누락/비정상은 시작일 전액 1회, 시작일 누락/비정상 양수 예산은 전체·카테고리에 미배분 1회(월 제외). 시스템 카테고리는 편집 목록과 분리해 쓰기 표면을 만들지 않음
- 검증: targeted 3 files/26 tests PASS, typecheck PASS(전체 check/build 및 독립 VERIFY 전 checkpoint)
- SoR: `docs/plans/active/expense-db-cost-ledger-parity-r5.md`
- 확정: 승인된 11파일만 변경, DevD 두 테스트 SHA-256 불변, `git diff --check` PASS

### 2026-07-25 · Codex DevC · DB 자동 비용 원장 R5 통합 검증 checkpoint
- 한 것: DevD 독립 계약 테스트 2파일을 SHA-256 일치 상태로 인수하고, 0원 사용자 카테고리도 `categoryTotals`에 identity/0원/0건/0%로 남기는 P1 계약 누락을 구현에서 보완
- 검증: DevD 14/14, 전체 targeted 5파일 40/40, `scripts/check.sh` 전체 824/824·structural 10/10·lint/typecheck·500줄·doc-drift PASS, Next production build 69/69, `git diff --check` PASS 예정
- 안전: 시스템 카테고리는 편집 가능한 `categories`에 넣지 않고 모든 DB 행은 system/readOnly로 유지. 대시보드 산술 파일과 운영 데이터·시트 쓰기는 변경 없음
- 다음: normal hook 통합 커밋 후 DevD exact-SHA 독립 VERIFY
- SoR: `docs/plans/active/expense-db-cost-ledger-parity-r5.md`
- 최종 diff: 승인된 11파일만 변경, DevD 두 테스트 SHA-256 불변, `git diff --check` PASS

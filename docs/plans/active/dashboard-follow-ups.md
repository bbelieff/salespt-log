> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 「오늘 챙길 일」 카드(#3 재컨택 할 일+D-day · #4 멈춘 업체 알림) 목업·구현 계획과 수용 기준.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `components/dashboard/DashboardFollowUps.tsx`, `lib/analytics/dashboard-follow-ups.ts`, `lib/query/{contact,contract-payment,db-sheet}-hooks.ts`, `components/ui/LoadingProvider.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇을 세는지 · 어디로 이동하는지 · 목업을 어떻게 여는지
> - **관련 문서**: [components.md §9](../../design/components.md#9-dashboard) · [data-model.md DB관리시트](../../domains/data-model.md)

# 대시보드 「오늘 챙길 일」 (2026-10-12)

## 구현·운영 배포 승인 — 2026-10-13 19:03 KST
- 사용자 “만들어서 배포해”로 A 구현부터 운영 확인까지 승인. 후속 “3분할 생산성지표/오늘할일+전체진행건/주간목표” 적용. 최초부터 모든 카드 표시.
- PC1024px 이상은 세 칸 고정. 모바일은 8주까지 목표 먼저, 9주부터 챙길 일 먼저. 실제 교육 주차(상한 없음), 조회 주차와 무관. 원 크기 유지·좁은 칸은 줄바꿈.
- 이 절이 아래 과거 위치/승인 대기/삽입 한 줄 기준보다 우선. A 단독 출시, B 문장·C 채널표·D/F·취소한#1131 제외.
- base/last-good d4bc80a0, 전용 feat/dashboard-follow-ups-card. 수정 목업 0e43227 기반 A 재사용, 공유 파일은 최신 master에 A 부분만 이식.
- 담당: 총괄 구현·실화면·배포, 독립 source_release_review 읽기 검토. Muse주간4% 1단계, 핵심작업 직접 수행.
- 필수 check.sh·build·PC/모바일 및8/9주경계·동일head독립검증·CI·squash(Changelog본문)·Deploy/health/live.

## 교육 주차별 우선순위 — 2026-10-13 14:53 KST 사용자 결정
- belie: “8주차까지는 주간목표우선, 이후는 오늘할일 우선”.
- 8주차까지 주간목표를 먼저, 9주차부터 오늘 챙길 일을 먼저 배치한다. 두 카드 모두 유지하고 주간목표 원 크기는 줄이지 않는다. PC·모바일 공통.
- 기준은 수강생의 실제 교육 주차. 기존 dashboard/page.tsx의 courseStartISO + todayKST + weekIndexOf 계산을 재사용한다. 화면에서 과거 주를 조회하는 동작과 자동 배치 기준을 혼동하지 않는다. 최대 교육 주수로 제한한 courseWeek 대신 실제 actualWeek로 8/9주 경계를 판단한다.
- 남은 검증: 8주차 마지막 날→9주차 첫날, 8주 과정 종료 후, PC·모바일 배치와 기존 조회/저장 보존. 시작일 누락·로딩 상태는 기존 계정 처리 기준을 확인하여 화면이 불필요하게 이동하지 않도록 설계한다.
- 이 결정이 과거 고정 카드 위치·전 기간 주간목표 우선 가정보다 우선한다. 현재는 설계 기록 반영; 해당 조건부 목업/구현/배포는 미실행.
## 범위
- **2026-10-13 결정:** 멈춤 기준 **7일** 확정. 주간목표 원 크기를 보존하고 주변 밀도 개선(B 수정 목업과 공통). 수정 목업 가지 `feat/pluuug-revision-mockup`; 최종 화면 승인 대기, 구현 PR 착수 기록 아님.
- 수정 목업 실측: PC1366×768 주간목표 높이208.8px/하단857.6px, 모바일390×844 높이222.8px/하단1089.4px. 원 소스 변경 없음(화면 실측 PC54/모바일48). 공간을 줄였어도 기존 「첫 화면 목표 전체」는 충족하지 않는다. 변경 배치 승인 시 이 위치를 함께 확인받고, 승인 전 생산 구현에 들어가지 않는다.
- 포함: #3 할 일 D-day(밀림·오늘·7일 안), 결과 안 적은 지난 미팅, 다시 연락할 DB, #4 멈춘 업체(다음 할 일 없이 7일 이상, 이월 포함).
- 제외: #2, #5(수납 지연 줄·회차별 정산 — 반려). 서버·API·DB·시트 변경 없음.
- belie 기본안: 카드 위치 = 생산성 카드와 전체 진행건 사이, 멈춤 기준 7일·이월 포함.

## 검토 반영(스펙 리뷰 major 전부)
1. 보조 조회(월 미팅·DB관리시트)는 `meta.background` → 전역 오버레이 제외, 카드 스켈레톤만. 계약·할 일 뒤에 시작, 5분 신선.
2. 예정일자가 비었거나 틀린 할 일 제외. 계약을 못 찾은 할 일은 칩·총건수에서 빼고 회색 안내만(`/payment?focus=` 단독 폴백 삭제).
3. 다시 연락: 다음 연락일 이후 상담 기록이 있으면 제외.
4. 멈춤 = 「다음 할 일 없이 마지막 일정 7일 이상」, 문구 「마지막 일정 M/D」(완료 시각 필드 없음 — 완료 Todo 는 예정일로 셈). 업체 단위(가장 오래 멈춘 진행 1건), 기관명이 어느 진행과도 맞지 않는 미완료 할 일이 있는 계약 제외.
5. 무효화: 미팅 뮤테이션 5종 → `['month']` + `cpKey`(죽은 `['payments']` 교체), 계약 핵심필드 수정·행 삭제 → `['todos']` + `['month']`.
6. 결과 4종 목록은 `isDbSheetFollowUpResult`(Set) 한 곳, 별칭 `@/util/*`.
7. DB관리시트 503 「지원하지 않음」은 DB 칩만 숨김(문구 짝은 `tests/components/db-sheet-hooks.test.ts`가 지킴).
8. `tests/browser/weekly-goals-browser.mjs`에 새 조회 route 추가.
9. 목업이 실제 도착 화면(PaymentPage·SchedulePage·DbSheetPage)까지 그린다.
10. PC 목록은 위쪽 공간이 모자라면 아래로 편다. components.md 카드 7종.

## 목업
- `npm run build`(폰트) 후 `node tests/browser/dashboard-followups-server.mjs` → 출력 주소. (Codex 셸에서는 README §5 「목업 서버」처럼 백그라운드로 띄운다 — 앞에서 돌리면 watch 때문에 셸이 멈춘다)
- `/?scenario=some|many|empty|error|unsupported`, `?slow=1`. 목록 한 줄을 누르면 실제 도착 화면이 열린다.

## 수용 기준
- [ ] 카드가 생산성과 전체 진행건 사이에 1개. page.tsx 변경은 삽입 1줄·import·주석.
- [ ] 0건 칩 미렌더, 총건수 = 7일 안 제외 5종 합, 문구 우선순위.
- [ ] 전부 성공·0건이면 칭찬 한 줄, 일부 실패면 안내 + 다시 시도.
- [ ] 도착: 할 일 강조 링 · 미팅 3초 링 · DbDetail 열림(목업 375/1280 확인).
- [ ] 375px 칩 ≥44px·가로 넘침 없음, PC 목록 펼침 전후 그리드 높이 동일.
- [ ] check.sh 초록.

## 위험·한계(실측·판독)
- 조회 부하: 대시보드 방문마다 `/api/db-sheet` 1회 + 월 미팅 1~3회가 는다. `/api/db-sheet`는 `findUserByEmail(fresh)`로 레지스트리를 캐시 없이 읽고(REGISTRY_DB_READ 꺼짐·DB 없음이면 Sheets 폴백), 월 조회는 전체 미팅·할 일을 읽어 월로 거른다. 완화: 5분 신선·계약/할 일 뒤 시작·무효화로만 갱신. 배포 후 withApiTiming p95 측정은 미실시 — 느리면 경량 엔드포인트 별도 카드.
- 할 일에 완료 시각이 없어 완료 Todo 는 예정일을 「마지막 일정」으로 쓴다.
- 첫 화면 목표 노출(weekly-goals 2026-09-11): 카드가 주간 목표 위에 놓여 목표가 아래로 밀린다. 목업 실측 카드 높이 — PC 1280/1600: 95px(칩 1줄), 0건 39px · 375px: 177px(칩 2줄), 0건 46px · 360px: 칩 6종 모두면 3줄. weekly-goals-browser.mjs 는 route 만 추가했고 실행은 못 함(QA_TOOLS_DIR playwright 없음) → belie 결정 대상.

## 승인 기록
- 목업 기준 SHA: (커밋 후 기입) · belie 승인: (대기)

## Codex 인계 — 승인 후 할 일 (2026-10-12)

> 기준: 가지 `feat/dashboard-followups` 커밋 `ecf241c2`(base `origin/master` b51d04b8, push 됨, PR 없음). 이 커밋에 A~F가 섞여 있다.
> 승인 페이지: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG (A는 ①·②). 답이 없으면 권장안(기본)으로 간다. 아래 `경로:줄`은 모두 `ecf241c2` 기준이다.

### 1. 지금 상태 (2026-10-12 실측)
- **실제 제품 코드다(목업용 가짜 연결 없음)**. 카드는 이미 있는 GET 4종을 그대로 읽는다. 서버·DB·시트·API 변경은 없다. 승인 뒤 「가짜를 진짜로 바꾸는」 일도 없다.
  - 카드 `components/dashboard/DashboardFollowUps.tsx`: 보조 조회는 계약·할 일 뒤에 시작하고 5분 동안 신선하다(:86-90). 로딩 스켈레톤 :133-143, 503 「지원 안 함」이면 DB 칩만 숨김 :91, 일부/전부 실패 :145-164·:218-223, 연결 끊긴 할 일 안내 :215-217, PC 목록 위/아래 배치 :56-79.
  - 계산 `lib/analytics/dashboard-follow-ups.ts`: `STALL_DAYS=7`(:19), 할 일 :84-112(잘못된 날짜 제외 :90, 계약 못 찾음=칩 제외 :96), 미팅 :117-150, 다시 연락 :158-174(다음 연락일 이후 상담하면 제외 :162-163), 멈춘 업체 :187-239(업체 단위, 기관 불일치 할 일이 있는 계약 제외 :204), 문구 :249-256.
  - 공용 변경: `payment-work-status.ts:36-71`(활동 색인을 `institution-view.ts`에서 옮기고 `done` 추가, `institution-view.ts:3,73,84` 호출만 바뀜). `LoadingProvider.tsx:65-71,114`(`meta.background` 쿼리는 전역 오버레이 제외). `contact-hooks.ts:130-158`(`useMonthsMeetings`), `:205-208`(`['month']`+`cpKey`, 죽은 `['payments']` 교체) — 호출 :279·:301·:332·:351·:368. `contract-payment-hooks.ts:46-49`(`['todos']`+`['month']`) — 호출 :155·:230. `db-sheet-hooks.ts`(신규, `['db-sheet']` 한 곳). `lib/types/db-sheet.ts:9-10`(`isDbSheetFollowUpResult`) ← `model.ts:1,29`. `ContactDbLeads.tsx:5,8`.
  - 배치 `app/(app)/dashboard/page.tsx`: import :20, 주석 :149-152, 삽입 :163. 같은 파일 :142-147은 C, :166 `headline`은 B다.
- **목업 전용(운영 무영향)**: `tests/browser/dashboard-followups-server.mjs`·`-fixture.tsx`. 합성 「샘플」 데이터이고, 실제 결제·일정·DB관리시트 페이지를 그린다. B·C 연결 줄이 섞여 있다(예: server :9-15·:17·:139-168·:183-185·:188-190·:197-208·:272-279, fixture :19-22·:58).
- **이번에 다시 돌린 검사(ecf241c2, 로컬)**:
  - PASS: A 시험 7파일 59건(아래 §5 첫 줄, `payment-institution-view`·`input-flow` 회귀 포함), `tests/structural` 15파일 92건, `tsc --noEmit` exit 0, A 소스 12개 eslint exit 0, `scripts/doc-drift.sh` PASSED.
  - NOT_RUN: 전체 `check.sh`, `npm run build`, 도착 화면 수용 기준 3개(이 문서 「수용 기준」의 빈 칸).
- **목업 실측(Playwright+Chrome, B 문장 포함·실제 TopHeader)**:

  | 폭×높이 | 카드 높이 some/empty | 주간목표 아래 끝 some/empty | 첫 화면 한계 |
  |---|---|---|---|
  | 1024×768 | 124/39(칩 2줄) | 971/886 | 768 |
  | 1366×768 | 95/39 | 925/869 | 768 |
  | 1600×900 | 95/39 | 662/607(윗줄 오른쪽이라 무관) | 900 |
  | 390×844 | 177/46(칩 44px) | 1171/1041 | 784 |

  모든 폭에서 가로 넘침은 없었다. 카드를 빼고 B 문장까지 빼면 1366에서 768 근처로 추정된다(경계선이고 master는 측정하지 않음).
  → **이 카드가 들어가면 1366×768·390×844에서 주간 목표가 첫 화면 밖으로 밀린다.**
- `tests/browser/weekly-goals-browser.mjs`는 route만 추가했다(:76-79). 실행하면 첫 화면 검사(:345-349)에 닿기 전에 :113에서 멈춘다. `getByLabel('이번 주 PT과제')` 시간 초과다. 편집기가 `GoalTaskRows`로 바뀌었고(`components/weekly-goals/WeeklyGoalEditor.tsx:173`, 이 가지에서 안 건드림), 기존 시험이 낡은 것으로 추정한다.
  - 도구: `QA_TOOLS_DIR=C:/Users/Public/Documents/ESTsoft/CreatorTemp/weekly-goals-qa-tools`. 반드시 `channel:"chrome"`으로 실행한다(headless-shell 1243 미설치).
- 아직 안 한 것: belie 승인 · A만 떼어 가지 만들기 · PR · CI · 머지 · 배포 · 운영 확인.

### 2. belie 결정 연결 (기본이면 코드 변경 0)
| 결정 | 기본(권장) | 기본이 아니면 바꿀 곳 |
|---|---|---|
| ① 카드 위치 | 생산성과 전체 진행건 사이 = `page.tsx:163` 그대로 | 「휴대폰은 재무 바로 아래」면 다음을 바꾼다. ① `page.tsx:147` 다음 줄에 `<div className="pc:hidden"><DashboardFollowUps todayISO={today} /></div>`를 넣는다. ② :163을 `<div className="hidden pc:block"><DashboardFollowUps todayISO={today} /></div>`로 바꾼다. ③ :149-152 주석과 `components.md:1065·1075`에 「모바일: 재무 아래 / PC: 생산성 아래」를 적는다. ④ 이 문서 수용 기준 「카드 1개」를 「보이는 카드 1개」로 고친다. DOM에 카드가 2개라서 브라우저 확인은 `:visible` 하나만 센다(캐시 키가 같아 조회는 늘지 않는다). 375·390 스크린샷을 PR과 보고에 붙인다. |
| ② 멈춤 기준 | 7일 · 이월 포함 = `dashboard-follow-ups.ts:19` | **N일**: 먼저 :19 `STALL_DAYS=N`을 바꾼다. 문구 :254와 `DashboardFollowUps.tsx:50`은 따라 바뀐다. 시험 `dashboard-follow-ups.test.ts:133-138`은 `buildStalledWork(…, TODAY, 7)`로 7을 직접 넘긴다. 시험 :191 문구도 고친다. 그다음 `components.md:1076`, 목업 기대값 주석 `server.mjs:76`을 고친다. N>9면 고운상사가 빠지고, N>10이면 푸른제작도 빠진다. **이월 제외**: :199 반복에 `.filter((cp) => !isCarryoverContract(cp, courseStartISO))`를 더한다(`lib/types/contract-status.ts:8-16`). `courseStartISO`는 `summarizeFollowUps`→`DashboardFollowUps` prop→`page.tsx:163`에서 `me.data?.courseStartISO ?? ""`로 넘긴다. 빈 값이면 `구분==="이월"` 깃발만 본다. 시험 :151-163의 기대값을 `[]`로 뒤집는다. ADR-0034(전체 진행건은 이월 포함)와 범위가 달라진다는 점을 PR에 적는다. |
| (번호 없음) 주간목표 첫 화면 규칙(2026-09-11, `docs/plans/completed/weekly-goals-polish.md:3`) | ①을 승인하면 「대시보드에서 목표가 첫 화면 아래로 내려가도 된다」로 기록한다 | 「목표는 첫 화면 유지」면 ①의 두 안 모두 해결이 안 된다(둘 다 목표 위). 이때는 카드를 `WeeklyGoalSummary`(:166) 뒤로 옮기는 **새 목업 → 재승인**을 먼저 한다. ≥1600에서는 래퍼가 `contents`라 `min-[1600px]:col-span-*` 설계가 따로 필요하다. B 문장만으로도 목표가 내려가므로 B도 머지 전에 B만 넣은 상태를 잰다(README §3 「목표 첫 화면 측정」, B plan 인계 §2). |

### 3. 남은 일 (순서대로)
1. 승인 답에서 ①·②·첫 화면 규칙을 확인한다. 이 문서 「승인 기록」에 목업 SHA `ecf241c2`, 승인 시각, 근거를 적는다.
2. **순서 확인**: B·C가 master에 들어갔는지 본다. `git fetch origin && git log origin/master --oneline -- components/ui/CardHeadline.tsx components/dashboard/ChannelProfitBreakdown.tsx`. A는 B→C 다음 마지막 대시보드 PR이다(§4).
3. **작업 자리**: 자기가 만든 항목 worktree만 머지·배포 뒤 정리한다. 남의 worktree는 건드리지 않는다. 상한(12)은 `<main>/wt`만 세는 경고다(check.sh:64-89). 새 자리는 절대경로로 만든다.
   ```powershell
   $main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
   $wt   = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/follow-ups-card-<MMDD>"
   git -C $main fetch origin
   $bak = git -C $main log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
   git -C $main worktree add $wt -b feat/dashboard-follow-ups-card origin/master
   Set-Location $wt; npm ci
   ```
4. **겹침 확인**: `gh pr list --state open --json number,files --jq '.[] | select(any(.files[]; .path|test("institution-view|contact-hooks|contract-payment-hooks|LoadingProvider|db-sheet/_components/model"))) | .number'`. 실무/수납 트랙과 겹치면 나중 머지 쪽이 rebase한다. `docs/worklog.md` 맨 위에 `[병렬트랙]` 구역(§6 파일 목록)을 선언한다.
5. **A 전용 파일 복사**: 먼저 `git diff b51d04b8 origin/master -- <아래 목록>`이 비었는지 본다. 비었으면 `git checkout ecf241c2 -- <목록>`을 한다.
   - 목록: `components/dashboard/DashboardFollowUps.tsx lib/analytics/dashboard-follow-ups.ts lib/analytics/payment-work-status.ts "app/(app)/payment/_lib/institution-view.ts" lib/query/db-sheet-hooks.ts lib/query/contact-hooks.ts lib/query/contract-payment-hooks.ts components/ui/LoadingProvider.tsx "app/(app)/db-sheet/_components/ContactDbLeads.tsx" "app/(app)/db-sheet/_components/model.ts" tests/components/dashboard-follow-ups.test.ts tests/components/dashboard-follow-ups-card.test.ts tests/components/follow-ups-factories.ts tests/components/follow-ups-invalidation.test.ts tests/components/db-sheet-hooks.test.ts tests/components/payment-work-status.test.ts tests/browser/weekly-goals-browser.mjs`
   - **이 plan 파일은 목록에 없다.** `git checkout ecf241c2 --`로 가져오면 이 인계 절이 없는 옛 판이 온다. plan은 README §4대로 `git checkout $bak -- docs/plans/active/dashboard-follow-ups.md`로 따로 가져온다.
6. **공용 파일은 A 부분만 옮긴다**:
   - `page.tsx` :20·:149-152·:163. B·C가 머지됐다면 `git diff origin/master ecf241c2 -- "app/(app)/dashboard/page.tsx"`가 이 세 곳만 보일 때 통째로 checkout한다.
   - `lib/types/db-sheet.ts` :8-10. E가 아직 안 들어갔으면 이 3줄만 넣는다.
   - `docs/design/components.md` :1065(DashboardFollowUps 부분), :1069(7종), :1075-1079. `docs/domains/data-model.md` :753.
   - 목업 서버·fixture(`tests/browser/dashboard-followups-server.mjs`·`-fixture.tsx`)는 README §3 「일부만 승인할 때」 규칙을 따른다: A·B·C가 모두 승인됐고 B·C 파일(`dashboard-headlines-matrix.tsx`·`dashboard-channel-profit-{data.mjs,scenario.ts}`)이 master에 있을 때만 통째로 넣는다. 아니면 이 PR에서 빼고, 화면 확인은 README §5 「PR head에서 합성 화면 찍기」로 한다. tsconfig `include: **/*.tsx`라서, B·C 파일 없이 넣으면 tsc가 깨진다.
7. 결정이 기본이 아니면 §2대로 바꾼다.
8. `docs/design/preview.html`에 「오늘 챙길 일」 정적 예시(칩 3개 + 펼친 목록 2줄)를 더한다. CLAUDE §6.5 「디자인 변경 시 preview 갱신」 규칙인데 A는 이것이 빠졌다.
9. **(결정: 하지 않는다)** `/api/db-sheet` GET에는 `withApiTiming`이 없다(`app/api/db-sheet/route.ts:18-24`). 승인 범위 밖의 관측 전용 PR을 직렬 큐에 하나 더 늘리지 않는다. 그래서 §6의 「db-sheet p95」는 **NOT_RUN(계측 없음)** 으로 기록한다. 느리다는 신호(belie 체감·Sentry)가 오면 그때 별도 카드로 낸다.
10. §5 검사를 모두 초록으로 만든다. 목업으로 320·375·1024·1280·1600을 다시 찍고(서버·fixture가 이 PR에 없으면 README §5 임시 checkout 방식, 정확한 PR head), 도착 화면 3종을 확인한다(할 일 강조 링 · 미팅 3초 링 · DbDetail 열림). 이 문서 「수용 기준」 칸을 증거와 함께 체크한다. `weekly-goals-browser.mjs`가 :113에서 여전히 멈추면 첫 화면 검사는 NOT_RUN과 그 이유를 적고, 낡은 시험 수정은 별도 카드로 낸다.
11. 독립 검증: README §4 「독립 검증」의 방법·템플릿으로 다른 세션에 맡긴다. 공용 계약(LoadingProvider·무효화)을 바꾸므로 필수다. **현재 PR head에 대한 PASS 없이는 머지하지 않는다.**
12. 커밋 → push → PR → CI 초록.
    - 커밋 제목: `feat(dashboard): 오늘 챙길 일 카드(밀린 할 일·미팅 결과·다시 연락·멈춘 업체)`
    - 본문: `Changelog: 대시보드에서 밀린 할 일·결과를 안 적은 미팅·다시 연락할 DB·멈춘 업체를 한눈에 보고 바로 그 화면으로 갈 수 있어요.`
13. 직렬 머지(§3.5·§6.8)를 한다. 직전에 `git rev-parse origin/master`를 기록하고 squash 머지한다. Deploy run을 끝까지 보고 §6을 확인한다.
14. worklog 항목을 쓴다. 이 문서를 `docs/plans/completed/`로 옮기는 것은 다음 항목 PR에 함께 넣거나 마지막 문서 PR 1개로 묶는다(README §6-6). 문서만 PR도 pre-commit이 check.sh를 돌리므로 `npm ci`는 필요하고 build는 생략한다. 자기 worktree는 README §5 「worktree 정리」 명령으로 정리한다.

### 4. PR 나누기·머지 순서
- A = **단독 feat PR** `feat/dashboard-follow-ups-card`. 서버·DB·저장값이 없어서 되돌리기는 squash 1개 `git revert`로 끝난다.
- 권장 순서는 **B → C → A**다(B·C 인계와 같다). A가 마지막이라 목업 서버·fixture를 통째로 가져간다. B·C가 늦어지면 A를 먼저 내도 된다. 이때 서버·fixture는 빼고, `page.tsx`는 A 부분만 넣는다. 서버·fixture는 마지막 대시보드 PR이 가져간다(B·C 중 하나라도 승인되지 않으면 커밋하지 않는다 — README §3).
- E와는 `lib/types/db-sheet.ts`(다른 줄)·`data-model.md`(이웃 줄)만 겹친다. 순서는 상관없고, 나중 쪽이 rebase한 뒤 check.sh를 다시 돌린다.
- F(#1 고유번호)가 들어오면 「연결 끊긴 할 일」(`dashboard-follow-ups.ts:94-96`)은 고유번호로 붙인다. 그래서 A를 F보다 먼저 내는 것이 기본이다. **A가 늦어져 F PR-2가 먼저 머지되면**, A는 rebase할 때 F의 `contractForTodo`·`contractJoinKeys`·`slotActivityFor`(`lib/util/company-id.ts`, `lib/analytics/payment-work-status.ts`)로 할 일·멈춤 조인을 바꾼다(F plan §6-6 「A가 아직 master에 없을 때」).
- D와 PR #1131(세션 리플레이 제외)은 파일 겹침이 없다. 다만 머지는 한 번에 하나만 하고, 배포 관찰이 끝나기 전에는 다음 PR을 머지하지 않는다.

### 5. 검증 명령 (새 워크트리에서, PowerShell)
```powershell
npx --no -- vitest run tests/components/dashboard-follow-ups.test.ts tests/components/dashboard-follow-ups-card.test.ts tests/components/follow-ups-invalidation.test.ts tests/components/payment-work-status.test.ts tests/components/db-sheet-hooks.test.ts tests/components/payment-institution-view.test.ts tests/components/input-flow.test.ts
npx --no -- vitest run tests/structural
npm run typecheck; npm run lint; & "C:/Program Files/Git/bin/bash.exe" scripts/doc-drift.sh
& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh      # 맨 bash·npm run check 는 WSL 로 가므로 쓰지 않는다
npm run build                                   # app 코드 변경 → production build 필수(workflow.md)
git grep -n -F '"payments"' -- lib/query/contact-hooks.ts   # 0줄
git diff origin/master...HEAD --stat           # §3-5·6 목록 밖 파일이 없어야(B·C·D·E 섞임 방지)
# 목업: README §5 「목업 서버」대로 PORT 4519 로 백그라운드 실행(서버·fixture가 이 PR에 없으면 「PR head에서 합성 화면 찍기」)
#   → /dashboard?scenario=some|many|empty|error|unsupported, ?slow=1
$env:QA_TOOLS_DIR='C:/Users/Public/Documents/ESTsoft/CreatorTemp/weekly-goals-qa-tools'; $env:WEEKLY_GOALS_EVIDENCE_DIR='<임시폴더>'; node tests/browser/weekly-goals-browser.mjs
```
- vitest는 건수가 아니라 실패 0으로 판정한다(위 59건은 `ecf241c2` 기준 — 나눈 PR에서 새로 센다).
- some 기대값은 칩 밀린 1·오늘 1·미팅 2·다시 연락 2·멈춘 업체 3·7일 안 1, 총 9건이고 연결 끊긴 할 일 안내가 1줄 나온다(`server.mjs:76`).
- empty는 「오늘 챙길 일이 없어요 👏」, error는 「일부 항목을 불러오지 못했어요 · 다시 시도」, unsupported는 DB 칩만 사라진다.

### 6. 배포 뒤 운영 확인 (실데이터 쓰기 없음)
- 배포: `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion,headSha`가 success이고 머지 SHA와 같다. `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online`이 200이다.
- 화면(로그인된 belie 세션, **보기·이동만** — 완료 체크·결과 저장·상담 기록 버튼을 누르지 않는다):
  - 휴대폰과 PC에서 카드가 ①에서 고른 자리에 1장 보인다.
  - 처음 열 때 전역 오버레이가 두 번 뜨지 않는다. 카드만 스켈레톤 → 칩 순서로 보인다.
  - 칩을 누르면 목록이 열리고, 한 줄을 누르면 그 화면·그 업체로 간다. 뒤로 가면 대시보드가 그대로다.
  - 첫 화면에서 주간 목표 위치를 승인 내용과 대조한다.
- 조회: 개발자도구 Network에서 대시보드를 열 때 계약·할 일이 끝난 뒤 `/api/meetings/month/*` 1~3회와 `/api/db-sheet` 1회만 더 생기는지 본다.
- 성능(읽기 전용): PostHog `api_timing`에서 route `api/meetings/month/[yyyymm]:GET`의 배포 전후 24시간 건수와 p95를 본다. db-sheet p95는 계측이 없어 **NOT_RUN**이다(§3-9). 느리면 경량 「최근 미처리 미팅」 엔드포인트를 별도 카드로 낸다.
- 오류: Sentry에 `DashboardFollowUps`·`dashboard-follow-ups`·`db-sheet-hooks` 관련 새 오류가 0건인지 본다.
- PostHog·Sentry 접속 수단은 이 인계에 없다. 실제로 연결된 읽기 도구가 있을 때만 보고, 없으면 두 줄 모두 **NOT_RUN(접속 수단 없음)** 으로 적는다(README §6).

### 7. 위험
1. **주간목표 첫 화면 규칙과 충돌**(§1 실측): ①의 두 안 모두 목표를 밀어낸다. §2 셋째 줄 결정을 꼭 기록한다.
2. **1024~1279 PC는 칩이 2줄**이다(카드 124px). 스펙의 「닫힌 상태 약 90px 이하」는 이 폭에서 틀리다. 퍼널 카드가 같이 늘어나는지 1024 스크린샷으로 확인한다.
3. **처음 켤 때 멈춘 업체가 많이 뜰 수 있다**. 오래된 계약에 History가 없으면 「계약 후 N일」로 잡힌다. 목업 `many`로 미리 보였고, 숫자는 `STALL_DAYS` 한 곳에서 바꾼다.
4. **조회 부하**: `/api/db-sheet`는 방문마다 레지스트리를 캐시 없이 읽는다(Sheets 폴백 가능). 월 조회는 미팅·할 일 전체를 읽는다. 이를 5분 신선·늦은 시작·무효화로 완화했다. db-sheet는 계측이 없고 이번에 넣지 않는다(§3-9 결정).
5. **완료 시각이 없다**: 완료한 할 일은 예정일을 「마지막 일정」으로 쓴다. 문구도 「마지막 일정」으로 맞췄다.
6. **연결 끊긴 할 일**(업체명·계약일 변경)은 칩에서 빠지고 안내만 남는다. F 전까지는 한계다.
7. **알려진 엇갈림(그대로 둠)**:
   - `buildWorkStatusItems`(`payment-work-status.ts:93,100`)는 History·완료한 할 일까지 「할 일 있음」으로 센다(`todoKeys`가 기록종류·완료를 거르지 않는다). 그래서 「전체 진행건」의 진행대기/진행 분류와 멈춤 판정이 드물게 다를 수 있다. 기관명은 둘 다 양끝 공백만 무시해서 같다.
   - `lib/query/contract-link-hooks.ts:62`에도 죽은 `["payments"]` 키가 남아 있다. 해는 없다.
8. 모바일에서 캐시 없이 새 탭으로 도착하면 결제 상세가 자동으로 안 펼쳐질 수 있다. 기존 `DashboardWorkStatus` 링크와 같은 한계다.
9. jsdom 시험에서 「Cannot update a component (LoadingProvider) while rendering…」 경고가 나온다. 일반 쿼리 대조군(`Foreground`)에서도 나오므로 기존 LoadingProvider 동작으로 추정하며, 시험은 통과한다.
10. **가지 나누기 실수**: 공용 파일에서 B·C·E 줄을 같이 가져오면 PR에 다른 기능이 섞인다. 반대로 A 줄을 빠뜨리면 doc-drift·tsc가 깨진다. `--stat`을 §3-5·6 목록과 대조한다.

## 2026-10-13 현재 승인 범위
- 병렬 운영 적용 승인. 영업이익 문장은 제외. 주간목표 원 크기 유지·생산→유입→컨택완료→미팅완료→계약 화살표·PT과제 날짜 아래 한 줄.
- 최신 2열 대시보드 A와 동일 PR에서 검증. 별도 카드 문구 추가 없음.

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 재무 묶음·주간 목표 카드 맨 위 쉬운 말 한 줄(belie #8) 목업·구현 계획과 수용 기준.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `components/ui/CardHeadline.tsx`, `components/dashboard/finance-headline.ts`·`DashboardFinance.tsx`·`DashboardSkeleton.tsx`, `components/weekly-goals/goal-headline.ts`·`WeeklyGoalSummary.tsx`, `app/(app)/dashboard/page.tsx`(prop 1개)
> - **읽고 나면 알 수 있는 것**: 어떤 문장이 언제 나오는지 · 목업을 어떻게 여는지 · 무엇을 일부러 넣지 않았는지
> - **관련 문서**: [components.md §9 「대시보드 한 줄 문장」](../../design/components.md#9-dashboard) · [tokens.md 카드 한 줄 문장 tone](../../design/tokens.md) · [dashboard-follow-ups.md](./dashboard-follow-ups.md)(같은 브랜치 #3·#4)

# 대시보드 카드 한 줄 문장 (2026-10-12, belie #8)

## 교육 주차별 우선순위 — 2026-10-13 14:53 KST 사용자 결정
- belie: “8주차까지는 주간목표우선, 이후는 오늘할일 우선”.
- 8주차까지 주간목표를 먼저, 9주차부터 오늘 챙길 일을 먼저 배치한다. 두 카드 모두 유지하고 주간목표 원 크기는 줄이지 않는다. PC·모바일 공통.
- 기준은 수강생의 실제 교육 주차. 기존 dashboard/page.tsx의 courseStartISO + todayKST + weekIndexOf 계산을 재사용한다. 화면에서 과거 주를 조회하는 동작과 자동 배치 기준을 혼동하지 않는다. 최대 교육 주수로 제한한 courseWeek 대신 실제 actualWeek로 8/9주 경계를 판단한다.
- 남은 검증: 8주차 마지막 날→9주차 첫날, 8주 과정 종료 후, PC·모바일 배치와 기존 조회/저장 보존. 시작일 누락·로딩 상태는 기존 계정 처리 기준을 확인하여 화면이 불필요하게 이동하지 않도록 설계한다.
- 이 결정이 과거 고정 카드 위치·전 기간 주간목표 우선 가정보다 우선한다. 현재는 설계 기록 반영; 해당 조건부 목업/구현/배포는 미실행.
## 범위
- **2026-10-13 결정(이하 기존 재무 문장 명세보다 우선):** 영업이익 문장과 예약 공간은 현재 제외한다. 주간 목표 원의 소스 규격(모바일 48px/PC 64px)을 보존하고 날짜·PT과제·주변 간격을 압축한다. 기존 밀도 CSS 적용 화면 실측은 모바일48px/PC54px이며 원 자체는 줄이지 않았다. 재무 숫자·기간 필터·채널별 표는 유지. 변경 목업 가지 `feat/pluuug-revision-mockup`, 최종 목업 승인 대기이며 구현 PR 허용이 아니다. 재무 문장 소스는 후속 PR에 포함하지 않는다.
- 포함: ① 재무 묶음 기간 칩 아래 영업이익 문장(기간을 따라 바뀜) ② 주간 목표 카드 제목 아래 남은 목표 문장(지난 주는 과거형).
- 제외(belie 기본안): 매출 목표 문장(저장된 매출 목표 값 없음 → 실제 영업이익 문장으로 대신), 생산성·진행건·차트 문장, 카드별 가이드 링크(주제별 가이드 페이지 없음). 서버·API·DB·시트·Zod 변경 없음.
- 문구표·우선순위 정본 = components.md §9 「대시보드 한 줄 문장」.

## 스펙 리뷰 반영
1. (major) 재무 문장 자리는 불러오는 중(회색 줄)·문장 없음에도 `mb-2 min-h-5`로 항상 붙어 있다 → 3칸 위치가 불러오는 중→완료에서 그대로(목업 `?slow=1` 실측 390px: 3칸 top 316→316). `DashboardSkeleton` 자리도 h-5.
2. 영업이익 = 매출 − 비용을 한 번 반올림(칸과 같은 식) — 칸 숫자와 1원도 다르지 않다(반올림 표 테스트).
3. useMemo 없이 렌더마다 계산, `aria-live="polite"` 자리는 갈아끼우지 않는다(같은 노드 테스트).
4. 「전체」 접두어 「지금까지」 vs 「전체 기간에」 — 목업 `/headlines` 맨 위에 나란히(belie 선택 대기, 상수 `ALL_PERIOD_PREFIX` 한 곳).
5. 주간 목표: 주차 이동은 「불러오는 중…」 뒤 그 주 문장, 같은 주 재조회 동안은 이전 문장 유지(placeholderData 없음 — 코드 변경 없음).
6. tokens.md 음수 영업이익 red-600 → violet-600 정정 + CardHeadline tone 표, preview.html 예시.
7. 테스트는 `.ts` + createElement, 날짜는 가짜 시계로 고정, 진행형·과거형 둘 다 단언.
8. 가이드 근거 정정: `(app)` 페이지 라우트 9개(payment/news 포함).

## 목업
- `npm run build`(폰트) 후 `node tests/browser/dashboard-followups-server.mjs` → 출력 주소. (Codex 셸에서는 README §5 「목업 서버」처럼 백그라운드로 띄운다)
- `/dashboard?finance=profit|loss|cost-only|none|refund|ledger-fail|big` (줄임 `?loss=1` `?big=1`), `?goals=remaining|done|unset|zero` (줄임 `?goalDone=1`), `?slow=1`(재무 불러오는 중 확인). refund 는 「이번 달」 칩, 지난 주 과거형은 카드 ◀.
- `/headlines` — 모든 문구 상태 승인표(실제 CardHeadline + FinanceSummaryBoxes / GoalRings, 320·390·넓게 폭 전환).

## 수용 기준
- [x] 재무 문장 금액 = 영업이익 칸 금액(음수는 절대값), 칩 전환 즉시 접두어 변경(지금까지/N월에/이번 주에/고른 기간에, 날짜 덜 고르면 지금까지).
- [x] 경비장부 실패 → 「매출 N원을 올렸어요」 또는 문장 없음, 반환 > 매출 → 보라 반환 문장, 불러오는 중·실패에 문장 없음.
- [x] 주간 목표 문장 4종 + 과거형, 칸별 「N 남음/초과」 줄 없음, 카드 클릭 이동 그대로(`/weekly-goals?date=…&returnTo=%2Fdashboard`).
- [x] 트레이너 보기·compact 요약 변화 없음(`headline` opt-in).
- [x] 목업 실측: 320px 가로 넘침 0, 문장 2줄 이하(8자리 금액은 두 줄 — 목업 서버 `big` 주석과 같음), 390px 7자리 한 줄, 1024·1600 같은 줄 카드 바닥선 일치·PT과제 바닥 유지.
- [ ] belie 목업 승인(접두어 선택 포함) → check.sh 초록 → 커밋.

## 머지·트랙
- **이 절의 옛 문장(「한 브랜치라 직렬 머지 1회」)은 인계 README §4가 대체한다.** 가지 `feat/dashboard-followups`는 보관용이고 통째로 머지·rebase·force-push하지 않는다. B는 최신 origin/master에서 새 가지 `feat/dashboard-card-headlines`로 단독 PR을 낸다(아래 인계 §3·§4).
- B는 #3·#4(오늘 챙길 일, A)·영업이익 상세 채널 표(C)와 `page.tsx`·`DashboardFinance.tsx`·`DashboardSkeleton.tsx`를 함께 만졌다 — 각 변경은 앵커 단위 작은 수정이라 줄 단위로 나눠 옮긴다.
- `docs/plans/active/student-dashboard-followup.md`(STUDENT-DASHBOARD-260913, 2026-09-13)가 같은 구역을 아직 소유 선언 중 — 완료 여부 확인 후 completed 이동은 총괄 판단.

## 커밋 메시지(feat, §6.5)
- `Changelog: 대시보드를 열면 이번에 얼마 남겼는지, 주간 목표까지 얼마 남았는지 한 줄로 바로 알 수 있어요.`
- 전: 숫자 칸과 링을 하나씩 읽어야 이번 달에 남긴 돈이나 남은 목표를 알 수 있었어요. / 후: 카드 맨 위 한 줄이 「10월에 594,520원을 남겼어요」, 「계약 목표까지 1건 남았어요」처럼 바로 알려 줘요.

## 롤백
- 커밋 revert(서버·데이터 변경 없음).

## 승인 기록
- 목업 기준 SHA: (커밋 후 기입) · belie 승인: (대기)

## Codex 인계 — 승인 후 할 일 (2026-10-12)

> 기준: 가지 `feat/dashboard-followups` 커밋 `ecf241c2`(base `origin/master` b51d04b8, push 됨, PR 없음). 이 절의 `경로:줄`은 모두 이 커밋 기준이다.
> 승인 자료: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG (02번 장이 B, 「정할 것 ③」). 위 「승인 기록」의 목업 기준 SHA = `ecf241c2`.

### 1. 지금 상태 (실제 코드 vs 목업)
- **실제 코드 — 운영 경로에 그대로 쓰인다.** 새 조회·API·service·repo·DB·시트·Zod 변경은 없다. 이미 화면이 받는 값만 쓴다.
  - `components/ui/CardHeadline.tsx:34-54`: 표시 전용. 문장이 없거나 불러오는 중이어도 `<p data-card-headline>` 자리를 남긴다. 이모지는 `aria-hidden`이고 tone 4색은 `:18-23`.
  - `components/dashboard/finance-headline.ts`: `:21` `ALL_PERIOD_PREFIX="지금까지"`, `:34-39` 접두어, `:41-55` 분기. `:50` 영업이익 = `Math.round(revenue - cost)`로, 칸 `FinanceSummaryBoxes.tsx:259`와 같은 식이다.
  - `components/dashboard/DashboardFinance.tsx`: `:81-85` loading·headline을 렌더마다 계산한다(useMemo 없음). `:104-106` 실패가 아니면 자리를 늘 붙여 두고 `aria-live="polite"`를 단다.
  - `components/dashboard/DashboardSkeleton.tsx:26`: 문장 자리 `h-5`.
  - `components/weekly-goals/goal-headline.ts`: `:14` 우선순위, `:25-39` 분기.
  - `components/weekly-goals/WeeklyGoalSummary.tsx`: `:18` opt-in prop, `:36-38`, `:71`.
  - `app/(app)/dashboard/page.tsx:166`: `headline`. 대시보드만 켠다. `TrainerGoalOverview.tsx:23`과 compact 요약은 이 prop을 넘기지 않는다.
- **목업 전용(합성 데이터)**: `tests/browser/dashboard-headlines-matrix.tsx`(`/headlines` 승인표, 다른 파일 의존 없이 단독). `tests/browser/dashboard-followups-server.mjs:9-13,142-166,183-185`·`dashboard-followups-fixture.tsx:19-20,58`은 A·C와 같이 쓴다.
- **문서**:
  - `docs/design/components.md` — `:49`·`:71` 끝 문장, `:1064`, `:1081-1097`, `:1147-1148`, `:1301`, `:1677`.
  - `docs/design/tokens.md` — 영업이익 줄을 보라로 정정, 「카드 한 줄 문장 tone」 표.
  - `docs/design/preview.html` — 문장 `<p>` 2개, 손실 상자 red→violet.
- **이번 인계 때 다시 확인(ecf241c2, 2026-10-12)**: 아래 §5의 vitest 9개 파일·112개 테스트 통과. B 소스 7개는 `npx eslint` 0건. check.sh 전체·`npm run build`·브라우저 실측은 다시 돌리지 않았다. 위 「스펙 리뷰 반영」 1과 「수용 기준」의 316→316, 320/390/1024/1600 숫자는 제작자 기록이다.
- belie 승인은 **아직 없다**.

### 2. 결정 고리 (기본 = 권장안. 기본이면 코드 변경 0)
| 결정 | 기본 | 기본이 아닐 때 고칠 곳 |
|---|---|---|
| ③ 「매출 목표까지 N원」 문장 | 넣지 않고 실제 영업이익 문장을 쓴다. 변경 없음 | B를 넓히지 않는다. B는 그대로 배포한다. 「이번 달 매출 목표」 입력칸은 새 plan(예: `docs/plans/active/dashboard-revenue-goal.md`)에서 설계 → 목업 → 승인을 따로 밟는다. 새 저장값이 생기므로 Zod·API·repo·SSOT까지 바뀐다. 그때 연결할 자리: `finance-headline.ts:23-31` 입력에 `revenueGoal?: number \| null`를 추가하고, `period === "month"`일 때만 `:51` 앞에 목표 문장 분기를 넣는다. |
| 「전체」 칩 접두어(위 「스펙 리뷰 반영」 4) — **승인 페이지에 이 질문이 빠져 있다** | 「지금까지」 | 「전체 기간에」로 바꾸려면: `finance-headline.ts:21` 상수를 바꾼다. 기대 문자열은 `git grep -n "지금까지" -- tests/components components docs/design/components.md`로 찾는다(`finance-headline.test.ts:16,17,26,32,36,40,44,48,52,56,61,72,78`, `dashboard-finance-headline.test.ts:78,91,98,111`, `components.md:1087`). `dashboard-headlines-matrix.tsx:78-91`의 비교표는 지우거나 위아래를 바꾼다. 계산은 그대로다. |
| (A와 공통) 주간목표 첫 화면 규칙 — A plan 인계 §2 셋째 줄 | 「목표가 첫 화면 아래로 내려가도 된다」 → B 변경 없음 | 「목표는 첫 화면 유지」를 고르면 **B 머지 전에 B만 넣은 상태를 잰다**(README §3 「목표 첫 화면 측정」): B PR head에서 README §5 「PR head에서 합성 화면 찍기」로 `/dashboard?finance=profit&goals=remaining`을 1366×768·390×844로 열고 `section[aria-label="주간 목표"]`의 `getBoundingClientRect().bottom`을 잰다. 한계 768(1366×768)·784(390×844, `tests/browser/weekly-goals-browser.mjs:346`). 둘 다 이하면 B 그대로. 하나라도 넘으면 **B도 A와 함께 새 목업 → 재승인**(재무 문장 +약 28px, 목표 문장 1줄이 원인 — §7). 숫자·head SHA를 「승인 기록」에 적는다 |
| 주간 목표 하나 고르는 규칙 — 승인 페이지 02번은 「가장 가까운 목표 하나」라고 적었지만 **코드는 고정 순서다** | 코드대로: 계약 → 미팅완료 → 컨택완료 → 유입 → 생산 중 첫 미달 | 「남은 수가 가장 적은 목표」로 바꾸려면 `goal-headline.ts:33`을 고친다. 미달 키 중 `goal − actual`이 가장 작은 것을 고르고, 같으면 `GOAL_HEADLINE_PRIORITY` 순서로 정한다. 같이 고칠 곳: `goal-headline.test.ts:27-42` 기대값, `components.md:1091-1092`, `dashboard-headlines-matrix.tsx:99` 제목. 목업 기본 장면(계약 2/1·미팅 3/2)은 두 규칙 모두 「계약 목표까지 1건」이라 화면으로는 구분되지 않는다. 승인 회신 때 총괄이 쉬운 말로 한 줄 확인한다. |

### 3. 승인 뒤 순서
1. AGENTS.md·CLAUDE.md·`docs/development/workflow.md`·이 plan을 읽고, `docs/worklog.md` 맨 위 5~10개를 본다. 스펙 원본 `docs/plans/active/pluuug-handoff/specs/B-headlines.json`은 `.gitignore:13`(`*.json`)에 걸려 **이 worktree에만 있다**. 읽기만 하고 커밋하지 않는다.
2. belie 회신을 받으면 위 「승인 기록」에 적는다: SHA `ecf241c2`, 승인 페이지 URL, 회신 원문·시각, 결정 3개의 답(답이 없으면 기본).
3. 기본이 아닌 답만 §2대로 고친다.
4. B 단독 PR 가지를 만든다(§4 권장).
   ```powershell
   $main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
   $wt   = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-headlines-<YYMMDD>"
   git -C $main fetch origin
   $bak = git -C $main log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
   git -C $main worktree add $wt -b feat/dashboard-card-headlines origin/master
   Set-Location $wt; npm ci
   git diff b51d04b8 origin/master -- components/weekly-goals/WeeklyGoalSummary.tsx components/dashboard/DashboardSkeleton.tsx tests/components/weekly-summary-presentation.test.ts   # 비어 있어야 통째 복사가 안전
   git checkout ecf241c2 -- components/ui/CardHeadline.tsx components/dashboard/finance-headline.ts components/weekly-goals/goal-headline.ts components/weekly-goals/WeeklyGoalSummary.tsx components/dashboard/DashboardSkeleton.tsx tests/components/card-headline.test.ts tests/components/finance-headline.test.ts tests/components/goal-headline.test.ts tests/components/dashboard-finance-headline.test.ts tests/components/weekly-summary-presentation.test.ts tests/browser/dashboard-headlines-matrix.tsx
   git checkout $bak -- docs/plans/active/dashboard-card-headlines.md   # plan 은 README §4 대로 백업 커밋에서(ecf241c2 판에는 이 인계 절이 없다)
   ```
   공용 파일은 `git diff b51d04b8 ecf241c2 -- <파일>`을 보며 **B 줄만** 손으로 옮긴다.
   - `DashboardFinance.tsx`: 옮길 줄 — `:10` 주석, `:30`·`:32` import, `:81-85`, `:102-106`, `:112`(`loading ?`). C 줄(`:11-12`, `:15`, `:33-34`, `:36-46`, `:57-67`, `:74-75`, `:78`의 `bucketOf`, `:126-135`)은 옮기지 않는다.
   - `page.tsx`: `:166`의 `headline` 한 단어만. A 줄(`:20`, `:163`)과 C 줄(`:142-147`)은 빼고, `:149-152` 주석의 A 문구도 옮기지 않는다.
   - `components.md`는 §1의 B 줄만 옮긴다.
   - `tokens.md`: 영업이익 줄과 tone 표만. 「남은 돈 (채널 표)」 줄은 C다.
   - `preview.html`: 문장 `<p>` 2개와 손실 상자 `bg-violet-50 text-violet-600`만. 채널 표 블록은 C다.
   - `docs/worklog.md` 맨 위에 B 항목을 더한다. 겹친 소유 선언 `docs/plans/active/student-dashboard-followup.md`(STUDENT-DASHBOARD-260913)는 이미 #962(`3cab4f95`)로 master에 들어갔다. 같은 PR에서 `git mv`로 `docs/plans/completed/`에 옮긴다(§3.5 구역 해제).
   - 목업 서버·fixture(`dashboard-followups-server.mjs`·`-fixture.tsx`)는 B PR에 **넣지 않는다**. fixture가 C 파일(`./dashboard-channel-profit-scenario`)을 import하고, tsconfig `include: **/*.tsx`라 넣으면 타입검사가 깨진다. 언제 누가 커밋하는지는 README §3 「일부만 승인할 때」.
   - **브라우저 증거는 B PR head에서 찍는다**(결정 변경이 있으면 `ecf241c2`와 head가 다르다 — workflow.md:41 「정확한 PR head 대조」). 방법 = README §5 「PR head에서 합성 화면 찍기」: 커밋해 head 고정 → 서버·fixture·C 목업 데이터 2개를 `ecf241c2`에서 임시로 꺼냄(matrix는 이미 이 PR에 있다) → 찍기 → `git restore --staged`·삭제로 원상복구 → `git status --porcelain`이 빈 것 확인 → push. 결정이 모두 기본이면 §5 동일성 diff가 비어 있다는 것도 함께 적는다.
5. §5 검증: check.sh 초록, `npm run build`(화면 코드 변경). 브라우저 확인은 320·390·1024·1600(PR head). 「목표 유지」를 골랐으면 §2의 첫 화면 측정도.
6. 커밋 제목은 `feat(dashboard): add one-line headlines to finance and weekly goal cards`. 본문은 위 「커밋 메시지」의 `Changelog:`와 전/후 두 줄을 그대로 쓴다. `Changelog-Anchor`는 생략해도 된다. 승인 사실(A~F 공통)을 이 PR의 worklog 항목에 함께 쓴다(README §3 — B가 첫 머지 PR일 때).
7. PR → CI 초록 → 작성자와 다른 검증자(README §4 「독립 검증」 템플릿)가 head·수용 기준·승인본을 대조해 **현재 head PASS** → 직렬 큐에서 병합 직전 `git rev-parse origin/master`(last-good)를 기록하고 squash merge.
8. §6 운영 확인 → worklog·PR에 SHA·run id 기록 → 이 plan의 completed 이동은 다음 항목 PR에 함께 넣거나 마지막 문서 PR로 묶는다(README §6-6) → 자기 worktree를 README §5 「worktree 정리」 명령으로 정리한다(`rm -rf`는 이 PC에서 느리고 260자 경로에서 실패한다).

### 4. PR 나누기·병합 순서
- **권장: B 단독 PR을 먼저 머지한다.**
  - 화면만 바뀐다(서버·데이터 0).
  - 다른 항목이 B에 기대지 않는다. `CardHeadline`·`finance-headline`·`goal-headline`은 B 파일과 B 문서에서만 쓰인다(레포 검색 실측).
  - 결정 3개가 모두 기본이면 코드 변경이 0이다.
  - Changelog 한 줄이 기능 하나와 맞는다.
- **겹치는 파일**: `DashboardFinance.tsx`(C), `page.tsx`(A·C), `tokens.md`·`preview.html`(C), `components.md`(A·C·D·E), `docs/worklog.md`(전부), 목업 서버·fixture(A·C). 순서는 B → C → A이고 D·E·F는 독립이다. 머지는 한 번에 하나만 한다(§3.5).
- 목업 서버·fixture는 마지막에 머지되는 대시보드 PR(A 또는 C)이 함께 가져간다(README §3 「일부만 승인할 때」 — B·C 중 하나라도 빠지면 커밋하지 않는다). 승인표 `dashboard-headlines-matrix.tsx`는 B PR에 들어간다(단독 파일).
- 옛 「대안: A·B·C를 대시보드 PR 하나로 묶기」는 **README §4(항목별 PR·직렬 머지)가 대체한다. 묶지 않는다.**

### 5. 검증 명령 (B worktree에서, PowerShell)
```powershell
# B 단위 + 회귀 (ecf241c2에서 2026-10-12 9개 파일·112개 통과 — 나눈 PR에서는 건수가 달라진다. 실패 0으로 판정하고 건수는 새로 적는다)
npx vitest run tests/components/card-headline.test.ts tests/components/finance-headline.test.ts tests/components/goal-headline.test.ts tests/components/dashboard-finance-headline.test.ts tests/components/weekly-summary-presentation.test.ts tests/components/desktop-fluid.test.ts tests/components/weekly-summary-navigation.test.ts tests/components/finance-three-columns.test.ts tests/components/dashboard-chart-carousel.test.ts
npx eslint components/ui/CardHeadline.tsx components/dashboard/finance-headline.ts components/dashboard/DashboardFinance.tsx components/dashboard/DashboardSkeleton.tsx components/weekly-goals/goal-headline.ts components/weekly-goals/WeeklyGoalSummary.tsx "app/(app)/dashboard/page.tsx"
& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh      # 맨 bash·npm run check 는 WSL 로 가므로 쓰지 않는다
npm run build
# 단독 PR 동일성 — 출력이 비어 있어야 한다(결정 변경이 있었다면 그 줄만 차이)
git diff ecf241c2 -- components/ui/CardHeadline.tsx components/dashboard/finance-headline.ts components/weekly-goals/goal-headline.ts components/weekly-goals/WeeklyGoalSummary.tsx components/dashboard/DashboardSkeleton.tsx
```
브라우저(B PR head — §3-4 마지막 항목·README §5 「PR head에서 합성 화면 찍기」, `.next` 빌드가 있어야 한다): README §5 「목업 서버」처럼 `$env:PORT="4610"`으로 백그라운드 실행한다. 포트는 3000·3100을 피한다.
- `/headlines`: 320·390·넓게 버튼마다 모든 문구를 본다.
- 320폭 `/dashboard?finance=big`: `document.documentElement.scrollWidth <= innerWidth`가 true여야 한다. 문장 줄 수는 2 이하다.
  `(p=>Math.round(p.getBoundingClientRect().height/parseFloat(getComputedStyle(p).lineHeight)))(document.querySelector('section[aria-label="매출·비용·영업이익"] [data-card-headline]'))`
  `getClientRects().length`는 블록이라 늘 1이니 쓰지 않는다.
- 390폭 `/dashboard?finance=profit`: 같은 식의 값이 1이어야 한다.
- 390폭 `/dashboard?slow=1`: 아래 값을 불러오는 중과 다 불러온 뒤 한 번씩 재서 차가 1px 이하여야 한다.
  `document.querySelector('section[aria-label="매출·비용·영업이익"] [data-card-headline]').nextElementSibling.getBoundingClientRect().top`
- 1024·1600: 같은 줄 카드의 bottom 차가 1px 이하이고 PT과제 상자가 바닥에 붙어 있어야 한다. 주간 목표 ◀를 누르면 과거형(「…못 미쳤어요」)이 보여야 한다.

### 6. 배포 뒤 운영 확인 (실데이터 쓰기 없음)
- `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion,status,headSha`: success이고 headSha가 squash SHA와 같아야 한다.
- `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online` → 200. 200만으로 새 버전이 성공했다고 쓰지 않는다.
- 화면 확인은 belie 본인 계정으로 한다(Codex가 로그인하지 않는다). 대시보드를 열면:
  - 재무 문장 금액 = 영업이익 칸 금액.
  - 「이번 달」을 누르면 「N월에」로 바뀐다.
  - 주간 목표 카드 맨 위에 문장 1줄이 있고, 링 아래 「N 남음」 줄은 없다.
  - 트레이너 보기의 학생 주간 목표에는 문장이 없다.
  B는 새 요청을 만들지 않는다. 대시보드를 열 때 생기는 쓰기는 기존 `GET /api/dashboard` 동작(원장 반복 지출 생성)뿐이다.
- VPS `/opt/salespt-log`에는 수동으로 들어가지 않는다(전역 운영 규칙). 문제가 생기면 `git revert <squash-sha>` → push → 재배포·health 확인(CLAUDE §6.8). 데이터 변경이 없어 되돌리기만 하면 된다.

### 7. 위험
- 승인 페이지 문구와 코드가 다르다: 「가장 가까운 목표」 ↔ 고정 순서. 「전체」 접두어 질문도 빠졌다. 둘 다 §2에서 다룬다.
- 첫 화면이 밀린다. 재무 묶음은 약 28px(문장 20px + `mb-2`), 주간 목표 카드는 문장 한 줄만큼 길어진다. A 카드(휴대폰 약 177px)와 합치면 주간 목표가 더 내려간다. 2026-09-11 「주간 목표 첫 화면」 기준은 A 결정 ①과 함께 본다. belie가 「목표 유지」를 고르면 B도 머지 전에 잰다(§2).
- 320폭 8자리 금액은 두 줄이다. 다 불러온 뒤 약 19px 늘어난다(`min-h-5`는 한 줄분). 수용 기준(「320px 가로 넘침 0, 문장 2줄 이하」)이 허용한 범위다.
- 경비장부 조회가 실패하면 칸은 추가 비용을 0으로 계산하고(`DashboardFinance.tsx:75`) 문장은 매출만 말한다. 기존 동작이라 이번에 고치지 않는다. 금액 칸은 카운트업하고 문장은 처음부터 최종값이라 약 1초 동안 다르게 보인다.
- 재무 「이번 주」는 월~일, 주간 목표는 금~목이다. 기존에도 있던 차이다.
- origin/master가 b51d04b8 이후 움직였으면 공용 파일에서 충돌할 수 있다. §3-4의 diff 확인을 먼저 한다.
- C의 채널 표 문장(`ChannelProfitBreakdown`)은 `CardHeadline`이 아닌 별도 서식이다. 통일은 이번 범위 밖이다.
- polite 자리가 불러오는 중부터 붙어 있어서 첫 로드 때 문장이 한 번 읽힌다. 의도한 동작이다.

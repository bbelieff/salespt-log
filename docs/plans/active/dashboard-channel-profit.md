> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업이익 칸을 누르면 보이는 「채널별 남은 돈」 표(belie #7 계약별 이익 → 채널 단위) 목업·구현 계획과 수용 기준.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `components/dashboard/ChannelProfitBreakdown.tsx`·`channel-profit.ts`·`DashboardFinance.tsx`·`FinanceSummaryBoxes.tsx`(prop 1개)·`ChannelPerformance.tsx`(CH_COLOR export), `lib/util/finance-period.ts`·`contract-link.ts`, `lib/service/contract-channel.ts`·`termination-count.ts`·`dashboard.ts`, `lib/types/dashboard.ts`, `app/(app)/dashboard/page.tsx`(prop 3개)
> - **읽고 나면 알 수 있는 것**: 표가 어떤 숫자로 맞춰지는지 · 계약이 어느 줄로 가는지 · 목업을 어떻게 여는지 · 무엇을 일부러 안 했는지
> - **관련 문서**: [components.md §9-2](../../design/components.md) · [data-model.md 대시보드 view](../../domains/data-model.md) · [ADR-0034](../../decisions/0034-revenue-all-contracts-by-period.md) · [dashboard-card-headlines.md](./dashboard-card-headlines.md)(#8, 같은 재무 묶음) · [dashboard-follow-ups.md](./dashboard-follow-ups.md)

# 영업이익 상세 「채널별 남은 돈」 (2026-10-12, belie #7)

## 범위
- **2026-10-13 결정:** 영업이익 상세 안의 채널표 위치 OK([4]). 재무 묶음 상단 영업이익 문장은 제외([3], B). 채널표의 계산·범위는 유지. 수정 목업 확인 후 항목별 구현 단계로 진행하며 이 선택만으로 전체 머지 승인을 뜻하지 않는다.
- 포함: 영업이익 상세 패널(기존 「기간 · 계약 N건 | 이익률」 줄 아래)에 문장 한 줄 + 채널 표(매입DB·직접생산·현수막·콜·지·기·소 × 매출·비용·남은 돈)
  + 보조 줄(영업기록 없음 › / 채널 모름 / 확인 중) + 추가 비용 › + 합계 「영업이익」. 위 기간 칩(전체·이번 달·이번 주·직접 설정)을 따른다.
- belie 기본안: 표는 패널 안(채널별 성과 카드·카드 순서·높이 무변), 문장도 패널 안에만. 현금 기준(발생주의 #6 보류).
- 제외: 계약 한 건마다의 이익 목록(DB 비용 행에 계약·미팅 연결 키가 없어 정직하게 나눌 수 없다), 채널 줄 눌러 거르기(화면 없음).
- 서버: `GET /api/dashboard` 에 optional `contractChannels: { key, channel }[]` 하나. 이미 읽은 계약·미팅 배열로 만든다(새 DB·시트 읽기 0,
  KPI·channelMatrix·costBreakdown 무변 — ADR-0034 §6). 쓰기 경로·스키마·마이그레이션 없음. 금액 계산은 모두 화면에서 기존 기간 함수로.

## 스펙 리뷰 반영
1. (major) 키 = `contractChannelKey`(@/util/contract-link, 서버·화면 공용): AK 가 있으면 `행|ak:AK`(이름·계약일을 고쳐도 유지), 없으면 `행|계약일|업체명`.
   응답에 없는 계약 = 「확인 중」(링크 없음, 「영업기록 없음」으로 몰지 않음) + 어긋난 묶음마다 대시보드 다시 불러오기 **1번만**
   (GET /api/dashboard 가 원장 반복 지출을 만드는 쓰기를 포함 — 반복 금지). 그래도 없으면 「확인 못 함」.
2. (major) 「영업기록 없음 ›」은 `manual:` 계약만(/payment 의 「영업기록 없음 ＋」로 연결 가능). AK 빈 값·못 찾은 미팅은 「채널 모름」(링크 없이 설명).
3. 빈 기간 = 매출·DB 비용·추가 비용이 **모두 0**일 때만. 추가 비용을 못 읽었으면(null) 표와 「확인 못 했어요」를 보인다.
4. 채널 줄은 CHANNEL_ORDER 고정(칩 바꿔도 안 움직임), 문장이 고른 줄만 `bg-blue-50`. 문장 「{채널}에 쓴 돈의 N.N배를 벌었어요」(받침 표 불필요).
5. 금액: 만원으로 먼저 반올림 후 0 이 아닐 때만 「−」, 1억 이상 「1.9억」, 전체 금액은 title + sr-only, 숫자 칸 `pl-1.5`.
6. termination-count 는 공용 조회(contractMeetingResolver) 전에 manual 을 건너뛴다(unknown 이벤트 방지) — 테스트 추가.
7. `channel: Channel | null`, 응답에서 업체명·계약일 제거. lib/types/dashboard.ts:47 「만원」 주석 → 원. tokens.md 영업이익 보라는 #8 이 이미 정정(남은 돈 행만 추가).
8. 목업 스위치 `?staleChannels=1` `?renamed=1` `?stuck=1` `?channels=large` `?channels=empty&ledgerFail=1`.
9. jsdom 테스트 `vi.mock("next/link")`. preview.html 예시 추가.

## 병합 순서·겹침 (§3.5)
- `lib/types/dashboard.ts`(공용 계약)는 다른 트랙과 겹치면 **타입만 먼저 단독 PR**. 같은 브랜치(#3·#4·#8)와는 `DashboardFinance.tsx`·`page.tsx`·docs 를 함께 고쳤다(작은 고정점 편집).
- 업체 고유번호(#1)가 생기면 `contractChannelKey` 한 곳만 바꾼다. 유입 경로(#10)가 생기면 채널 출처는 그 값을 먼저, 미팅 채널은 대체값(코드 미반영 — 메모).
- 선택(이번 범위 밖): 계약 추가·수정·해지·삭제 뮤테이션이 `['dashboard']` 도 무효화하면 「확인 중」이 덜 생긴다(`lib/query/contract-payment-hooks.ts` 는 다른 트랙이 고치는 중이라 손대지 않음).

## 목업
- `npm run build`(폰트) 후 `node tests/browser/dashboard-followups-server.mjs` → 출력 주소. 영업이익 칸을 누른다. (Codex 셸에서는 README §5 「목업 서버」처럼 백그라운드로 띄운다)
- `/dashboard?channels=demo`(기본 묶음) · `?channels=large`(1억 넘는 칸·−9,500만, 320px 폭) · `?channels=loss`(모든 채널 적자) · `?channels=empty`(빈 기간)
- 플래그(같이 써도 됨): `&ledgerFail=1`(원장 503) · `&noChannels=1`(옛 응답 — 표 없음) · `&staleChannels=1`(새 계약 → 확인 중 → 1번 다시 불러와 매입DB로) ·
  `&renamed=1`(AK 있는 계약은 채널 유지, AK 없는 계약은 확인 중 → 채널 모름) · `&stuck=1`(다시 불러와도 옛 응답 → 「확인 못 함」)
- `?channels` 가 없으면 A·B 목업 응답 그대로(응답에 contractChannels 없음 → 표 없음).
- 데이터: `tests/browser/dashboard-channel-profit-data.mjs`(오늘 KST 기준 오프셋, 업체명 「가상상사A~J」), 쿠키: `dashboard-channel-profit-scenario.ts`.

## 수용 기준(목업 실측 2026-10-12)
- [x] 기간 4종에서 표 합계(원) = 매출·비용·영업이익 칸 — 전체 18,600,000/9,300,000/9,300,000, 이번 달·이번 주·직접 설정(09/12~10/02)도 일치
- [x] 칩 전환 중 /api/* 요청 0건 · 어긋남 시 /api/dashboard 1건만 추가, 정상 시 0건
- [x] manual → 영업기록 없음 › (/payment 도착, 그 계약에만 「영업기록 없음 ＋」), AK 빈 값 → 채널 모름(링크 없음), 이월·해지 포함(해지 반환은 해지일 기간·그 채널)
- [x] 320·360px(`large`)에서 `scrollWidth == innerWidth`, 숫자 줄바꿈 없음 · 1024·1600 표 `pc:max-w-lg`
- [x] 원장 실패 → 「확인 못 했어요」, 합계 비용 = DB 비용 · 빈 기간 + 원장 실패 → 표 보임 · 옛 응답 → 표·문장 없음
- [x] 패널을 열기 전 화면 무변(채널별 성과 「8주 누적」 그대로) · 패널 글에 「이월」「시즌」 없음 · `fin-profit-table` 없음
- [ ] check.sh 전체(오케스트레이터 몫 — 이 작업은 대상 테스트·구조 테스트·tsc·eslint 만 실행)

## 커밋 메모(feat)
```
feat(dashboard): 영업이익 상세에 채널별 남은 돈 표

Changelog: 영업이익을 누르면 채널마다 번 돈·쓴 돈·남은 돈을 볼 수 있어요.
전: 영업이익이 얼마인지는 보였지만 어느 채널에서 남았는지는 따로 계산해야 했어요.
후: 영업이익 칸을 누르면 고른 기간의 채널별 매출·비용·남은 돈과 가장 잘 남긴 채널이 한눈에 보여요.
```

## 승인 기록
- 목업 기준 SHA: `ecf241c2`(base `b51d04b8`) · 승인 페이지 03장 · belie 승인: (대기) — 승인되면 README §3 블록 형식으로 채운다.

## Codex 인계 — 승인 후 할 일 (2026-10-12)

> 이 절만 읽고 이어서 할 수 있게 썼다. 기준 = 가지 `feat/dashboard-followups` 커밋 `ecf241c2`(origin/master `b51d04b8` 위 1커밋,
> push 됨·PR 없음, 워크트리 `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012`). 코드 줄 번호는 모두 이 커밋 기준이다.
> 파일은 가지 이름이 아니라 **SHA `ecf241c2`** 로 가져온다(가지는 인계 문서 커밋으로 움직인다). 이 plan 자체는 백업 커밋 `$bak`에서 가져온다(README §2·§4). 명령은 PowerShell 기준(README §5).
> 승인 페이지: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG (C 는 「03 영업이익 → 채널별 남은 돈」, 정할 것 ④).

### 1. 지금 상태 (실측)
- **실제 구현(목업용 가짜 아님 — 승인되면 이 코드가 그대로 나간다)**
  - 서버: `lib/service/contract-channel.ts`(:19 `contractMeetingResolver`, :34 `contractChannels`) ·
    `lib/service/dashboard.ts`(:254 입력 `meetings`, :300 응답 `contractChannels`, DB 경로 :369 · 시트 경로 :424 — 이미 읽은 배열만, 새 읽기 0, 475줄) ·
    `lib/service/termination-count.ts`(:51 공용 조회, :59 manual 건너뛰기 유지)
  - 공용: `lib/types/dashboard.ts`(:48 주석 「원」, :56 `DashboardContractChannel`, :74 `contractChannels?`) · `lib/util/contract-link.ts:35` `contractChannelKey` ·
    `lib/util/finance-period.ts`(:121 `periodDbCostByChannel`, :130 `periodDbCost` = 세 값 합, :139 `periodRevenueByBucket`)
  - 화면: `components/dashboard/channel-profit.ts`(:56 버킷, :68 어긋난 키, :73 표 계산, :109·:128 문장, :145 금액 표기) ·
    `ChannelProfitBreakdown.tsx`(표, :91 testid `fin-channel-profit`) · `DashboardFinance.tsx`(:36-44 props, :57-67 어긋나면 다시 불러오기 1번, :74 계산, :126-135 패널에 넘김) ·
    `FinanceSummaryBoxes.tsx`(:46 `profitDetail`, :384-392) · `ChannelPerformance.tsx:28` `CH_COLOR` export(화면 무변) · `app/(app)/dashboard/page.tsx:142-147`(props 3개)
- **가짜(목업 전용, 운영 무영향)**: `tests/browser/dashboard-channel-profit-data.mjs`(합성 계약 「가상상사A~J」, 날짜는 오늘 KST 오프셋) ·
  `tests/browser/dashboard-channel-profit-scenario.ts`(주소 → 쿠키) · 공용 목업의 C 연결 줄 `tests/browser/dashboard-followups-server.mjs:14-17,188-190`, `dashboard-followups-fixture.tsx:21-22`.
- **이번 인계 때 실제로 돌린 검사**: C 대상 vitest 10파일 86개 통과, `tests/structural` 15파일 92개 통과.
  tsc·lint·doc-drift·check.sh 전체는 이번에 다시 돌리지 않았다(워크로그 기록: tsc 0 · vitest 3,754 통과).
- **아직 안 한 것**: belie 승인 · 가지 나누기 · PR · CI · 머지 · 배포 · 운영 확인. 운영 DB·시트·이벤트는 건드리지 않았다.

### 2. belie 결정 연결
| 결정 | 기본(권장) | 기본이 아니면 |
|---|---|---|
| ④ 표 위치 | 영업이익 패널 안 → **코드 변경 없음** | 「채널별 성과 카드에 칸 추가」면 바로 구현하지 말고 **새 목업 → 재승인**(카드 높이·「8주 누적」 기준이 바뀌는 다른 설계다). 그때 할 일: ① `DashboardFinance.tsx:126-135` profitDetail 제거, 계산(:57-67·:74)은 옮김 ② `page.tsx:142-147` 의 props 3개를 `page.tsx:173-176` `ChannelPerformance` 로 ③ `ChannelPerformance.tsx` Props(:21-25)에 같은 3개 추가, 안에서 `useContractPayments`·`useDBOverview`(같은 쿼리 키 — 새 요청 없음) + `channelBucketOf`·`periodChannelProfit` 호출 ④ 기간 = [개강일, 오늘](머리글 :169 「{weeks}주 누적」·서버 비용 시즌 하한과 맞춤). 단 카드의 계약 수(:148 `m.계약`)는 이월 제외라 여전히 다르다는 점을 각주로 ⑤ 표(:198-244)에 매출·남은 돈 2열 — 320px 에서 넘치므로 % 표시(:224, :232)를 뺀다 ⑥ 영업기록 없음·채널 모름·확인 중·추가 비용·합계 줄은 표 아래로(빼면 합계 ≠ 영업이익) ⑦ `dashboard-finance-channels.test.ts` 를 ChannelPerformance 테스트로 옮기고 `components.md` §9-2·§9-7 을 다시 쓴다 |
| (승인 페이지 밖) 문장 위치 | 패널 안에만 | 「늘 보이게」라고 하면: 그 자리(`DashboardFinance.tsx:104-106`)에 이미 B 의 한 줄(CardHeadline)이 있다 → 두 번째 줄을 만들지 말고 B 문구에 합칠지 belie 에게 확인(약 20px 높아짐) |
| (사진 03 에 보임) 콜·지·기·소 줄 | 4채널 모두 표시 | 「빼 달라」면 줄을 지우지 않는다(Σ = 매출 칸이 깨짐). `channel-profit.ts:88` 의 4채널 목록에서 빼고 그 버킷을 보조 줄로 내리는 새 목업 → 재승인 |

이후 바뀔 자리(코드 미반영, 메모): 업체 고유번호(#1, F)가 생기면 `lib/util/contract-link.ts:35` `contractChannelKey` 한 곳만 바꾼다.
유입 경로(#10)가 계약까지 이어지면 `lib/service/contract-channel.ts:34-41` 에서 그 값을 먼저 쓰고 미팅 채널은 대체값으로 둔다.

### 3. 남은 일 (순서대로)
1. 승인 답에서 ④ 확인. 기본이면 그대로, 대안이면 §2 대로 목업 → 재승인 먼저(아래 단계 멈춤).
2. 겹침 확인: `gh pr list --state open --json number,title,files --jq '.[] | select(any(.files[]; .path=="lib/types/dashboard.ts")) | .number'`
   + `docs/worklog.md` 맨 위 `[병렬트랙]`. 겹치면 `lib/types/dashboard.ts` + data-model.md 해당 부분만 먼저 단독 PR(CLAUDE.md §3.5).
3. 새 워크트리(B 가 먼저 머지됐으면 그 master 위). 자기가 만든 항목 worktree만 머지·배포 뒤 정리한다. 남의 worktree는 건드리지 않는다. 상한(12)은 `<main>/wt`만 세는 경고다(check.sh:64-89).
   ```powershell
   $main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
   $wt   = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/channel-profit-<MMDD>"
   git -C $main fetch origin
   $bak = git -C $main log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
   git -C $main worktree add $wt -b feat/dashboard-channel-profit origin/master
   Set-Location $wt; npm ci
   ```
4. C 전용 파일은 통째로 가져온다(다른 항목 변경이 섞이지 않은 것 확인함). 먼저 `git diff b51d04b8 origin/master -- <같은 목록>`이 비었는지 본다.
   `git checkout ecf241c2 -- components/dashboard/ChannelProfitBreakdown.tsx components/dashboard/channel-profit.ts components/dashboard/FinanceSummaryBoxes.tsx components/dashboard/ChannelPerformance.tsx lib/service/contract-channel.ts lib/service/termination-count.ts lib/service/dashboard.ts lib/types/dashboard.ts lib/util/contract-link.ts lib/util/finance-period.ts tests/browser/dashboard-channel-profit-data.mjs tests/browser/dashboard-channel-profit-scenario.ts tests/components/channel-profit.test.ts tests/components/channel-profit-breakdown.test.ts tests/components/dashboard-finance-channels.test.ts tests/components/finance-three-columns.test.ts tests/service/contract-channel.test.ts tests/service/dashboard-db-channels.test.ts tests/service/termination-count.test.ts tests/service/dashboard-sheet-latency.test.ts tests/util/finance-period-channel.test.ts`
   - 이 plan 은 목록에 없다. `git checkout $bak -- docs/plans/active/dashboard-channel-profit.md` 로 따로 가져온다(`ecf241c2` 판에는 이 인계 절이 없다 — README §4).
5. 공용 파일은 C 부분만 손으로 옮긴다(`git diff b51d04b8 ecf241c2 -- <파일>` 보고):
   - `components/dashboard/DashboardFinance.tsx`: 머리 주석 #7 두 줄, `useEffect·useRef`·`DashboardContractChannel`·`ChannelProfitBreakdown`·`channel-profit` import, `Props`(:36-44), :57-67, :74 + deps `bucketOf`, :126-135. B 의 `CardHeadline`·`financeHeadline`·`loading`·`headline` 은 B 몫(C 코드는 B 심볼을 쓰지 않는다).
   - `app/(app)/dashboard/page.tsx:142-147`(props 3개만). A 의 `DashboardFollowUps`·B 의 `WeeklyGoalSummary headline` 은 빼고.
   - `docs/design/components.md` §9-2 의 `profitDetail` 줄(:1140)·DashboardFinance 설명(:1150)·`ChannelProfitBreakdown` 단락(:1155~)·영업이익 상세 줄(:1187), §9-7 끝 한 줄(:1273).
   - `docs/design/tokens.md` 「남은 돈 (채널 표)」 줄. 「영업이익 (=) violet-600」 정정 줄은 B 가 아직 master 에 없을 때만 C 가 싣는다.
   - `docs/design/preview.html` 「채널별 남은 돈」 예시 블록(:586~). `docs/domains/data-model.md` `DashboardCostBreakdown.비용` 주석·`DashboardContractChannel` 블록·`contractChannels?`·연결 규칙 단락·식별자 표 2행.
   - 목업 서버/fixture: README §3 「일부만 승인할 때」 규칙대로 — C 가 A·B·C 중 마지막 대시보드 PR 이고 A·B·C 가 모두 승인됐을 때만 두 파일을 통째로 넣는다(fixture 가 B 의 `dashboard-headlines-matrix.tsx` 를 import — fixture:20, tsc 대상). 아니면 넣지 않는다.
   - `docs/worklog.md` 맨 위에 이번 PR 항목 새로 쓰기.
6. **(결정: 이 PR 에서 한다 — 필수)** 「다시 불러오기 1번」 가드를 화면 단위(`DashboardFinance.tsx:62` `useRef`)에서 탭 단위(모듈 상수 `Set`)로 옮긴다.
   - 이유: 영구 어긋남(§7-1·2)이면 지금은 대시보드를 열 때마다 GET /api/dashboard 가 1번 더 나가고, 그 요청은 원장 반복 지출 생성(쓰기)을 다시 돈다.
   - 화면·문구 변화가 없는 내부 동작이라 변경 목업은 필요 없다. PR 본문에 「승인 목업과 같은 화면, 재조회 횟수만 줄임」이라고 적는다.
   - `dashboard-finance-channels.test.ts:129` 에 「다시 마운트해도 1번」 케이스를 추가한다. 시험끼리 모듈 상수가 새지 않게 초기화 방법(예: 시험 전용 reset export 또는 `vi.resetModules`)을 같이 정한다.
7. §5 검사 전부 초록 → 위 수용 기준 마지막 칸 체크. **정확한 PR head** 에서 320·360·1024·1600 을 다시 찍어 PR 에 첨부한다 — 서버·fixture 가 이 PR 에 없으면 README §5 「PR head에서 합성 화면 찍기」(커밋 → 임시 꺼냄 → 찍기 → 원상복구 → `git status --porcelain` 빈 것 확인).
8. 커밋(위 「커밋 메모」 그대로 — Changelog 포함) → push → PR(본문: Changelog·검증 증거·되돌리기) → CI 초록 → 작성자와 다른 검증자의 **현재 head PASS**(README §4 「독립 검증」 템플릿).
9. 직렬 머지(§3.5·§6.8): 머지 직전 `git rev-parse origin/master` 기록 → squash 머지 → 배포 run 끝까지 관찰 → §6.
10. worklog 마무리. 이 plan 의 completed 이동은 다음 항목 PR 에 함께 넣거나 마지막 문서 PR 로 묶는다(README §6-6). 자기 worktree 는 README §5 「worktree 정리」 명령으로 정리한다.

### 4. PR 나누기·머지 순서
- C = **단독 feat PR** `feat/dashboard-channel-profit`(Changelog 한 줄은 위 커밋 메모). DB 스키마·마이그레이션·쓰기 경로 없음.
- 권장 순서 **B(카드 한 줄 문장) → C**. 둘 다 `DashboardFinance.tsx`·tokens.md·components.md §9-2·preview.html 을 고친다. 기능 의존은 없어서 B 가 늦어지면 C 먼저 가도 된다(그때 tokens.md 보라 정정 줄을 C 가 싣고, 나중 PR 이 리베이스).
- A 와는 `page.tsx` 만 겹친다(다른 줄). 목업 서버/fixture 는 B 이후에만 master 에 들어갈 수 있다(§3-5).
- D·E·F·PR #1131(세션 리플레이 제외)과는 파일 겹침 없음 — 순서 무관. F(#1)는 C 이후에 와도 `contractChannelKey` 한 곳만 바꾸면 된다.

### 5. 검증 명령 (새 워크트리에서, PowerShell)
```powershell
npx --no -- vitest run tests/components/channel-profit.test.ts tests/components/channel-profit-breakdown.test.ts tests/components/dashboard-finance-channels.test.ts tests/components/finance-three-columns.test.ts tests/service/contract-channel.test.ts tests/service/dashboard-db-channels.test.ts tests/service/termination-count.test.ts tests/service/dashboard-sheet-latency.test.ts tests/util/finance-period-channel.test.ts tests/util/finance-period.test.ts
npx --no -- vitest run tests/structural        # layers · period-hardcode(util import 0) · sheets-request-path-guard
npx --no -- tsc --noEmit; npx --no -- next lint --quiet
& "C:/Program Files/Git/bin/bash.exe" scripts/doc-drift.sh   # ChannelProfitBreakdown · DashboardContractChannel 등재 확인
& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh       # 전체 게이트(500줄 포함 — dashboard.ts 475). 맨 bash·npm run check 금지(WSL)
git grep -n "fin-profit-table" -- components/dashboard/ChannelProfitBreakdown.tsx   # 0줄이어야
npm run build                                  # 그다음 목업은 README §5 「목업 서버」(백그라운드) — 서버·fixture 가 이 PR 에 없으면 「PR head에서 합성 화면 찍기」
```
- vitest 는 실패 0 으로 판정한다(86건은 `ecf241c2` 기준 — 나눈 PR 에서 건수를 새로 센다).
목업에서 볼 것: `/dashboard?channels=demo` 칩 4종 합계 = 위 세 칸 · `?channels=large` 320/360 `scrollWidth == innerWidth` ·
`?channels=empty&ledgerFail=1` 표 보임 · `?staleChannels=1` /api/dashboard 1건만 추가 · `?renamed=1` · `?stuck=1` 「확인 못 함」 · `?noChannels=1` 표 없음.

### 6. 배포 후 운영 확인 (실데이터 쓰기 없음)
- `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion,headSha` = success·머지 SHA. `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online` = 200.
- 화면: Codex 는 로그인하지 않는다. belie 가 자기 계정으로(또는 belie 가 이미 로그인해 둔 브라우저에서 읽기만) 대시보드 → 영업이익 칸 →
  표가 보이는지, 칩 4종에서 합계 줄 = 위 세 칸인지, 「확인 못 함」 줄이 없는지(있으면 §7-1·2 신호), 콘솔 오류 0.
- PostHog(읽기만): `dashboard_term_unknown`(`dashboard.ts:375,431`)이 배포 전 7일보다 늘지 않았는지 — termination-count 리팩터 회귀 감시.
  `api/dashboard:GET` 요청 수 ÷ 대시보드 조회 수가 배포 전과 비슷한지(1번 다시 불러오기가 매번 나가면 오른다), p95 지연 변화 없음.
- Sentry: `DashboardFinance`·`ChannelProfitBreakdown`·`contract-channel` 새 오류 0.
- PostHog·Sentry 접속 수단은 이 인계에 없다. 실제로 연결된 읽기 도구가 있을 때만 보고, 없으면 위 두 줄은 **NOT_RUN(접속 수단 없음)** 으로 적는다(README §6).
- 되돌리기: `git revert <squash-sha>` → push → 같은 배포·health 확인. 데이터·스키마 변경이 없고 응답 필드가 optional 이라 옛 화면·새 응답이 섞여도 안전.

### 7. 위험
1. **DB 경로 빈틈 백필**: `/api/contract-payment` 는 시트에만 있는 행을 섞어 줄 수 있는데(`lib/service/contract-payment.ts:87-96`) 대시보드는 DB 행만 읽는다(`dashboard.ts:349-352`).
   그 행은 「확인 못 함」으로 남고, 지금(`ecf241c2`) 가드가 화면 단위라 대시보드를 열 때마다 GET 1번이 더 나간다. 그 GET 은 원장 반복 지출 생성(`dashboard.ts:121`, 쓰기 트랜잭션)을 다시 돈다 → §3-6(이 PR 에서 탭 단위로 바꾼다. 그래도 탭을 새로 열 때마다 1번은 남는다).
2. **조회 주체 차이**: `/api/dashboard` 는 `requireStudentViewContext`+`sheetOverride`(`app/api/dashboard/route.ts:14-15`), `/api/contract-payment` 는 `getWritableUserEmail`(`app/api/contract-payment/route.ts:29`).
   보는 시트가 다르면 모든 계약이 「확인 못 함」. 엉뚱한 채널로 붙지는 않는다(원래 있던 불일치).
3. **5분 캐시**(`lib/query/dashboard-hooks.ts:25`): 계약 추가·수정·해지 뮤테이션은 `cpKey` 만 무효화한다(`lib/query/contract-payment-hooks.ts:77,93,114,133,154,176,212,229`) → 1번 다시 불러오기에 기댄다. 미팅 채널만 바꾸면 키가 같아 최대 5분 옛 채널.
4. 시트 경로(옛 기수)는 미팅을 개강부터 84일만 읽는다(`dashboard.ts:439-450`) → 그 전 계약은 「채널 모름」.
5. 만원 반올림 때문에 칸 합과 합계 줄이 1~2만 다를 수 있다(각주·sr-only 전체 금액). 원 단위 정본은 위 세 칸.
6. 콜·지·기·소 매출이 다시 보인다 — 2026-05-08 belie 가 「콜·지·기·소 수임비 별도 박스」를 뺐다(`docs/design/components.md:1265`, `dashboard.ts:21`). 승인 페이지 사진 03 에 이 줄이 있으므로 승인 = 수용으로 본다.
7. 영업이익 칸을 눌러야 보인다(④ 기본안의 대가). `dashboard.ts` 475줄 — 더 늘면 `assembleView` 매핑을 `contract-channel.ts` 로.
8. 가지 나누기 실수: 공용 파일에서 C 부분을 빠뜨리면 doc-drift·tsc 가 깨지고, B·A 부분을 같이 가져오면 C PR 에 다른 기능이 섞인다 → `git diff origin/master...HEAD --stat` 을 §3-4·5 목록과 대조.

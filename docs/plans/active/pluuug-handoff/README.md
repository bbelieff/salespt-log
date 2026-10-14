> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 플러그(Pluuug) 배울점 A~F(목업 완료, belie 승인 대기)와 PR #1131을 Codex/GPT가 처음부터 이어받아 백업 → 승인 → 항목별 PR → 배포 → 운영 확인까지 끝내도록 쓴 총괄 인계서.
> - **누가 읽나요**: 이 작업을 이어받는 Codex/GPT 총괄 세션(맥락 0), 훑어보는 belie
> - **어떤 기능·작업과 연결?**: 가지 `feat/dashboard-followups` 커밋 `ecf241c2` 전체(대시보드·업체정보·DB관리시트), 설계만 있는 F(업체 고유번호·변경 기록), PR #1131(세션 녹화 제외)
> - **읽고 나면 알 수 있는 것**: ① 지금 어디까지 왔고 무엇이 실제 코드인지 ② 인계 문서를 어떻게 보존하고 belie에게 무엇을 받아야 하는지 ③ 승인 뒤 어떤 순서·명령(PowerShell)으로 PR·검증·배포·확인하는지
> - **관련 문서**: 항목 정본 [A](../dashboard-follow-ups.md) · [B](../dashboard-card-headlines.md) · [C](../dashboard-channel-profit.md) · [D](../company-info-email.md) · [E](../db-sheet-supplier-summary.md) · [F](../records-follow-renames.md) · [workflow](../../../development/workflow.md) · [task-template](../../../development/task-template.md) · [deploy-vps](../../../playbooks/deploy-vps.md) · [총괄](../../../playbooks/codex-lead.md)·[제작](../../../playbooks/codex-worker.md)·[검증](../../../playbooks/codex-reviewer.md)

## 진행 현황 (대시보드용)
갱신: 2026-10-14 20:03 KST

| 항목 | 단계 | 다음 할 일 | 막힌 것·belie 결정 대기 |
|---|---|---|---|
| 표·날짜·하단 정렬 | PR 검증 중 | 최종 검사·빌드·독립 검증 | PC 하단 일치·7행 무스크롤·320/375/430 확인 |
| A 오늘 챙길 일 | 완료 | 후속 요청 시 확인 | #1135 22343edb·Deploy38422543949 성공·HTTP200·운영 팝업 확인 |
| B 카드 문장·주간목표 여백 | 완료 | 후속 요청 시 확인 | A와 함께 운영 반영, 2열·퍼널 화살표·과제 한 줄 |
| C 채널별 남은 돈 | 완료 | 후속 요청 시 확인 | #1137 625f14d2·Deploy 성공·HTTP200·운영 표 노출 확인 |
| D 업체정보 이메일 | 보류 | Draft #1136·시트 접근 및 빌드 환경 해결 후 재검 | 검사·CI·합성 화면 통과 / census 403 2·429 5와 빌드 OOM 미해결 |
| E 공급처별 보기·DB목록 상단 | 완료 | 후속 요청 시 확인 | #1134 d4bc80a0 배포 성공·health 200·운영 PC/모바일 확인 |
| F 업체 고유번호·지난 기록 | 설계 보완 중 | 복원 선택 팝업·진행건별 기록 보존 설계 확정 | 합쳐진 타임라인은 제외; 최종 설계 승인 대기 |
| #1131 보관함·메모 녹화 제외 | 완료 | 없음·사용자 요청으로 취소 종결 | PR 닫힘(2026-10-13 16:52 KST), 미병합·미배포 |
| #1132 공급처 유형·공급처 분리 | 완료 | 후속 요청 시 확인 | 4채널 입력 운영 반영, 7e23a587 |
| #1133 DB시트 틀고정·사업자명 너비 | 완료 | 후속 요청 시 확인 | 3cb67af4 배포 성공, 운영 너비 저장·틀고정·health 200 확인 |
| 사이드바 중복 로고 제거 | PR 검증 중 | 검사·화면·빌드·CI 확인 | 펼침/접힘에서 제거, 메인 로고 유지 |
| 대시보드 진행표 갱신 규칙 | 완료 | 단계 변경·작업 묶음 완료 때 이 표 갱신 | 없음 |
| 수강생 안내 최신화 | 설계 보완 중 | 공급처 유형·틀고정 설명과 화면 보충 | 기존 카페 순서 수정 증거 있음; 최신 기능 안내 미확인 |
| 과거 요청 완료 증거 재확인 | 보류 | 김재원 시트·로그인, 노션 권한·카카오 미리보기 확인 | 이번 점검 자료만으로 완료 판정 불가 |
| 사용자 요청 잔여 점검 | 완료 | 점검표에 따라 남은 작업 진행 | 제품 구현·외부 게시물 변경은 이번 점검에서 미실행 |

> 갱신 규칙(belie 요청): 작업 단계가 바뀔 때와 한 묶음을 마칠 때 이 절을 갱신한다. 단계는 설계 보완 중 / 목업 수정 중 / 승인 대기 / 승인됨·구현 대기 / PR 검증 중 / 배포 확인 중 / 완료 / 보류 중에서만 쓰고, 확인한 사실만 쉬운 말로 기록한다. 현재 작업본을 읽으므로 이 표만을 위한 커밋은 필요 없다. 새 worktree에서 이어갈 때도 같은 위치에 이 절을 둔다.
# 플러그 배울점 A~F — Codex 인계 (2026-10-12)

## 2026-10-13 수정 목업 — 이 절이 옛 기본값/코드 가져오기 안내보다 우선

- 사용자 결정: [1] 원 크기 유지/주간목표 압축, [2] 7일, [3] 영업이익 문장 제외, [4] 채널표 위치 OK, [5] 이메일 확장보기, [6][7] DB 목록 우선/배너에 탭/한 행 도구/공급처 접기/열 버튼 쉬운 이름, [8]-1 재계약 복원·새시작 팝업, [8]-2 진행건별 Todo·History 유지.
- 원본 `feat/dashboard-followups` @ `21df48d9`와 `ecf241c2`를 보존한다. 수정 목업 전용 가지는 **feat/pluuug-revision-mockup**, worktree `../pluuug-revision-mockup-261013`. 제품 구현용 가지가 아니며 통째로 머지하지 않는다.
- 승인 뒤 원본 코드만 복사하면 사용자 수정사항이 빠진다. 항목별로 **수정 목업 승인 SHA에서 해당 항목 파일만** 최신 master 기반 새 가지에 가져온다. plan도 수정 목업 승인 SHA 버전이 정본이다. 세부 생산 PR 순서·독립 검증·운영 쓰기 중단 규칙은 동일.
- [2][4][5] 선택 기록 완료. 변경된 A/B/E/F 목업 최종 승인 대기. #1131은 2026-10-13 사용자 요청으로 취소·PR 닫힘. 다시 승인 요청하거나 구현하지 않음. 현재 PR/merge/deploy/운영 DB 쓰기 없음.
- F는 자동 복원 가정이 바뀌었다. F plan §0의 2026-10-13 보완 규칙을 따라 계약 회차·옛 기록 폴백·보관함 경로의 설계를 보완한 뒤 구현한다. 기록을 하나로 합치는 PR이 아니다.

이 문서는 지도다. 항목별 줄 단위 절차는 각 plan 끝의 「Codex 인계 — 승인 후 할 일」 절(A~E)과 F 설계 문서에 있다. 여기서는 전체 순서·공통 규칙·belie와 주고받을 것만 적는다.
- 코드의 `경로:줄`은 커밋 `ecf241c2`를 직접 열어 확인한 값이다. 백업 커밋(§2)은 문서만 더하므로 이 값은 그대로 맞다. A~E가 master에 들어가면 줄이 밀리니 그때는 함수 이름으로 다시 찾는다.
- plan 문서끼리는 줄 번호 대신 **절 이름**으로 가리킨다(이 인계 작업으로 plan 줄이 바뀌었다).
- 명령은 모두 **PowerShell 7** 기준이다(§5 「환경」). plan에 남은 명령도 같은 규칙으로 읽는다.

## 0) 한눈에

belie(운영자, 비개발자)가 SaaS 플러그를 살펴보고 경영일지에 가져올 배울점 8개를 골랐다. 이를 항목 A~F로 나눠 **목업 단계까지** 만들었다.
- A~E는 실제 제품 코드에 합성 데이터(「샘플·가상」 업체)만 넣은 목업이다. 승인되면 이 코드를 그대로 낸다.
- F는 새 화면이 거의 없어 설명서 `mockups/records-follow-renames.html`(커밋 `ecf241c2`에만 있음)과 구현 설계서([F plan](../records-follow-renames.md))만 있고 코드는 0줄이다.
- A~E 코드는 모두 커밋 하나 `ecf241c2`에 섞여 있다. 이 커밋은 가지 `feat/dashboard-followups`에 있고, `origin/master` `b51d04b8` 바로 위다(push 됨, PR 없음).

**현재 단계 = 목업 승인 대기.** **다음 행동**: ① 인계 문서 백업 커밋(§2) ② belie에게 승인 페이지 https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG 를 보내고, 명시적 승인과 결정 ①~⑧·F 질문 2개의 답을 받는다(§3). 승인 전에는 구현·PR·머지·배포를 하지 않는다([workflow.md:25](../../../development/workflow.md)).

## 1) 배경과 belie 결정

| 플러그 # | 내용 | belie 결정 | 이 작업에서 |
|---|---|---|---|
| #1 | 업체 고유번호(이름을 고쳐도 기록이 따라옴) | 수락 | F |
| #2 | 업체별 통합 타임라인 | **기각** | 없음 |
| #3 | 재컨택 할 일 + D-day를 대시보드에, 누르면 그 화면으로 | 수락 | A |
| #4 | 멈춘 업체 알림 | 수락 | A |
| #5 | 분할 정산 회차 · 자동 「지연」 | **기각** | 없음(A에 수납 지연 줄 없음) |
| #6 | 발생주의(진행 기준) 매출 | **보류**(권장: 하지 않음) | 없음(C는 현금 기준) |
| #7 | 수익성 정보 강화 | 수락 | C(계약별 대신 채널별 — 비용이 채널에서 나가서) |
| #8 | 카드 맨 위 쉬운 한 줄 문장 | 수락 | B |
| #9 | 변경 기록 남기기 | 수락 | F |
| #10 | 유입 경로 | 수락 | E(DB관리시트 공급처만, 소개처별은 별도 트랙) |
| #11 | 업체정보 이메일 칸 | 수락 | D |

**기각·보류 항목을 되살리지 않는 이유.** belie가 기각한 범위다. 넣으면 승인받은 범위가 실질적으로 바뀌므로 승인 없는 구현이 된다(workflow.md:46, CLAUDE.md:35 「요청 밖 구현 금지」). 승인 페이지 01장은 「수납 지연 줄은 넣지 않았어요(#5 기각 반영)」라고 약속했다. F 수용 기준 A11은 「통합 타임라인·#5 화면 없음」이다(F plan §11 수용 기준). 비슷한 요청이 다시 오면 새 주문으로 받아 설계 → 목업 → 승인부터 밟는다.

## 2) 현재 상태

**기준·보존(실측 2026-10-12)**
- 원본 worktree: `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012`. `node_modules`·`.next` 있음 → 여기서 목업 서버를 바로 돌릴 수 있다.
- 메인 checkout `C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지`는 읽기 전용이다(AGENTS.md:23). 로컬 `master`가 옛 `218552d4`이므로 기준은 항상 `git fetch` 뒤의 `origin/master`로 잡는다.
- `mockups/records-follow-renames.html`(F 승인 자료)은 `ecf241c2`에 커밋돼 있다. master에는 `mockups/` 폴더가 없다(`git ls-tree origin/master` 실측).
- `specs/*.json` 6개는 `.gitignore:13`(`*.json`)에 걸려 git이 무시한다(`git check-ignore -v` 실측). 스펙과 plan이 다르면 **plan이 정본**이다(리뷰 반영본). 이 PC 밖으로 나가지 않는 참고 자료다.
- **원본 worktree와 가지는 F까지 다 끝날 때까지 지우지 않는다.** F 승인본(html)이 이 가지에만 있으므로, F가 끝난 뒤에도 가지 삭제는 belie에게 묻는다.

**인계 문서 백업 커밋(승인 요청 전에 1번 — 필수)**

이 README와 plan 6개(5개의 「Codex 인계」 절 + F plan 전체)는 아직 이 PC 작업본에만 있다(`git status`: plan 5개 `M`, F plan·`pluuug-handoff/` `??`). worktree를 잃으면 인계 내용이 통째로 사라지고, 나중 세션은 낡은 `ecf241c2`판 plan만 보게 된다. 그래서 승인 요청 전에 문서만 담은 커밋 1개를 `feat/dashboard-followups`의 `ecf241c2` 위에 만들고 **force 없이** push한다.

```powershell
$src = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012"
git -C $src rev-parse HEAD            # ecf241c2… 이어야 한다. 이미 백업 커밋이 있으면(아래 $bak 찾기로 확인) 이 절차를 건너뛴다
git -C $src status --short            # M 5개(plan) + ?? docs/plans/active/records-follow-renames.md + ?? docs/plans/active/pluuug-handoff/ 만
$docs = @(
  "docs/plans/active/dashboard-follow-ups.md","docs/plans/active/dashboard-card-headlines.md",
  "docs/plans/active/dashboard-channel-profit.md","docs/plans/active/company-info-email.md",
  "docs/plans/active/db-sheet-supplier-summary.md","docs/plans/active/records-follow-renames.md",
  "docs/plans/active/pluuug-handoff/README.md")
git -C $src add -- @docs
git -C $src diff --cached --name-only # 정확히 위 7개. specs/*.json 이 보이면 멈춘다(넣지 않는다)
git -C $src commit -m "docs(plans): back up Pluuug A-F handoff docs [handoff-backup]" -m "README + 6 plans only. Code stays at ecf241c2. specs/*.json are gitignored and not included."
git -C $src push origin feat/dashboard-followups   # force 금지. 거절되면 멈추고 원인을 보고한다
```
- 커밋 때 pre-commit 훅(메인의 `.githooks/pre-commit:31-34`)이 전체 `check.sh`를 돈다. 약 4~5분 걸린다. 같은 상태(`ecf241c2` + 이 문서들)에서 2026-10-12에 PASS했다(아래 「공통 검사」). 실패하면 `--no-verify`로 넘기지 말고 로그를 보고 원인부터 고친다.
- 백업 SHA는 문서에 적지 않고 매번 찾는다(README를 다시 고치면 또 커밋해야 하므로):
  ```powershell
  git -C <아무 worktree> fetch origin
  $bak = git -C <아무 worktree> log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
  ```
- 이후 plan은 항목 worktree에서 `git checkout $bak -- docs/plans/active/<plan>.md`로 가져온다(§4 가지 전략). `Copy-Item`은 쓰지 않는다.
- 코드 파일은 계속 `ecf241c2`에서 가져온다. 백업 커밋에는 코드가 없으므로 결과는 같다.

**이 README의 자리**
- master에 넣지 않는다. 항목 PR마다 같은 공용 문서를 고치면 충돌하고, 다 끝난 뒤에는 낡은 지도로 남기 때문이다.
- 정본 = 보관 가지 `feat/dashboard-followups`. 진행표(아래 표)를 고칠 때는 원본 worktree에서 이 README만 고쳐 문서 커밋을 하나 더 만들고(제목 끝 `[handoff-progress]`) 일반 push한다. 이 커밋도 pre-commit의 check.sh를 거친다.
- 항목이 끝나면 그 사실은 각 PR의 worklog 항목과 plan(completed로 이동)에 남는다. F까지 끝나면 마지막 worklog 항목에 「인계 지도 = `feat/dashboard-followups`의 `docs/plans/active/pluuug-handoff/README.md`」 한 줄을 남긴다.

| 항목 | 무엇 | plan · spec | 만든 것 | 실제 vs 목업 | 막힌 것 |
|---|---|---|---|---|---|
| **A** | 대시보드 「오늘 챙길 일」 카드: 밀린/오늘/7일 안 할 일, 결과 안 적은 미팅, 다시 연락할 DB, 멈춘 업체(#3·#4) | [plan](../dashboard-follow-ups.md) · `specs/A-followups-card.json` | `DashboardFollowUps.tsx`(269줄), 계산 `lib/analytics/dashboard-follow-ups.ts`(`STALL_DAYS=7` :19), 캐시 무효화, `LoadingProvider` background 제외, 시험 7파일 59건 PASS | 제품 코드. 기존 GET 4종만 읽고 서버·DB·시트 변경 0. 가짜는 목업 서버·fixture뿐 | 결정 ①② + 주간목표 첫 화면 규칙 확인. B·C 뒤 권장 |
| **B** | 재무 묶음·주간 목표 카드 맨 위 한 줄 문장(#8) | [plan](../dashboard-card-headlines.md) · `specs/B-headlines.json` | `CardHeadline.tsx`, `finance-headline.ts`(`ALL_PERIOD_PREFIX` :21), `goal-headline.ts`(순서 :14), 시험 9파일 112건 PASS | 제품 코드. 기존 훅 값만 사용, 새 요청 0 | 결정 ③ + 승인 페이지에 없는 질문 2개(§3) |
| **C** | 영업이익 칸 → 「채널별 남은 돈」 표(#7) | [plan](../dashboard-channel-profit.md) · `specs/C-channel-profit.json` | 서버 `contractChannels`(optional, 이미 읽은 배열만), `ChannelProfitBreakdown.tsx`, 시험 10파일 86건 PASS | 제품 코드. 목업은 데이터만 합성 | 결정 ④. B 뒤 권장. 「다시 불러오기 1번」 탭 단위 가드를 같은 PR에서(§4) |
| **D** | 업체정보 [대표자] 「이메일」 칸 + TXT + 메모 자동입력, 시트 미러 04 CE·06 BM(#11) | [plan](../company-info-email.md) · `specs/D-email-field.json` | 스키마 `lib/types/meeting.ts:104`, 화면 `company-info-defs.ts:114`, census 스크립트, 시험 16파일 165건 PASS | 제품 코드. 문서 결함 2개 + census 헤더 결함 1개 남음(D plan 인계 §1) | 결정 ⑤·⑧·칸 개수. **머지 직전 census exit 0** |
| **E** | DB관리시트 「공급처별 보기」: 공급처마다 DB→상담→미팅→계약(#10) | [plan](../db-sheet-supplier-summary.md) · `specs/E-inflow-source.json` | 서버 읽기 전용 `funnel` 투영, `SupplierSummary.tsx`, 토글 `page.tsx:35`, 시험 6파일 104건 PASS | 제품 코드. 목업은 PGlite 위에서 실제 route를 돌림 | 결정 ⑥⑦. F PR-5 전에 |
| **F** | 업체 고유번호 + 미팅 「지난 기록」 + 「지난 상담 기록」(#1·#9) | [plan](../records-follow-renames.md) · `specs/F-records-follow-renames.json` | 코드 0. 설계(PR 7개: 1·2·3·4·5·6a·6b) + 설명서 html | — | Q1·Q2 + 승인. A~E 뒤가 기본(예외 §4). 운영 DB 쓰기 단계마다 belie 「진행」 |
| **#1131** | 보관함·메모 붙여넣기를 PostHog 세션 녹화에서 제외 | 가지 `origin/fix/vault-no-recording` | 4파일(`git diff --stat` 실측). CI 초록은 이전 세션 보고, 이번 미재확인 | — | 자동 안전검사가 머지를 막음 → **belie의 명시적 머지 지시** 필요 |

- **공통 검사(2026-10-12, 원본 worktree = `ecf241c2` + 이 인계 문서, Git Bash로 전체 `scripts/check.sh` 실행)**: **PASS**. tsc 오류 0 · ESLint 0 · `tests/structural` 15파일 92건 · 그 밖 vitest 354파일 3,662건 통과(4파일 45건 skip) · 500줄 초과 0 · doc-drift PASSED. 경고 1개: 「워크트리 36개」(§5 「worktree 정리」 참고, 경고일 뿐).
- **NOT_RUN**: `npm run build`, 브라우저 수치 재측정. 각 plan의 브라우저 수치는 제작자 기록이다.

## 3) 승인 받기

**보내는 법.**
- 승인 페이지는 belie 소유 비공개 페이지다. belie는 열 수 있다(2026-10-12 확인, 버전 `1791746266-5ce4`). Codex가 직접 열거나 고칠 수 있는지는 미확인이다. **Codex는 이 페이지를 고치지 않는다.**
- 내용 정본은 이 레포에 있다: 각 plan, 목업 서버(§5), `ecf241c2`의 `mockups/records-follow-renames.html`.
- belie가 직접 눌러 보고 싶어 하면 이 PC에서 목업 서버를 띄운다. 그다음 실제로 열리는 `http://127.0.0.1:<port>/…` 주소와 확인할 것을 함께 준다. 열린 탭이 있다고 단정하지 않는다(workflow.md:24). 이 주소는 **이 PC 앞에서만** 열린다.
- 말투는 쉬운 말, 결론 먼저다. belie는 개발자가 아니므로 화면·버튼 이름으로 말하고, 선택지마다 「무엇인지·고르면 생기는 일·되돌릴 수 있는지」를 붙인다.

**변경 목업 전달법(대안을 골라 화면이 바뀔 때).**
1. 그 항목의 새 가지(§4)에서 변경 목업 코드를 만들고 커밋·push해 SHA를 고정한다(PR은 아직 열지 않는다).
2. 375×812·1280×800 스크린샷(바뀐 부분이 보이게, 필요하면 390×844·1366×768 추가)을 레포 밖 폴더(예: `$env:TEMP\pluuug-mockups\<항목>-<SHA 7자리>\`)에 찍는다.
3. 스크린샷 파일을 채팅에 첨부해 보낸다(첨부가 안 되면 파일 경로와 「이 PC에서 열어 보세요」를 준다). belie가 이 PC 앞에 있을 때만 로컬 주소도 준다.
4. 승인 버전은 「목업 파일 경로 + 커밋 SHA + 스크린샷 경로」로 plan 「승인 기록」에 적는다. 옛 승인본(artifact `1791746266-5ce4`, `ecf241c2`)은 지우거나 덮지 않는다.

**보낼 문안(그대로 써도 됨)**
```
belie님, 플러그 배울점 목업 6장이 승인을 기다리고 있어요.
링크: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG
권장안 그대로면 "목업 승인. 전부 권장안대로." 한 줄이면 돼요. 바꿀 것만 번호로 알려 주세요.
일부만 승인하셔도 돼요. 승인한 장만 진행하고 나머지는 기다려요.
페이지에 빠진 확인 4가지도 같이 봐 주세요.
1) 새 카드와 문장 때문에 대시보드 첫 화면에서 주간 목표 카드가 아래로 내려가요(노트북 1366×768, 휴대폰 390×844 실측).
   권장: 괜찮음. 안 되면 카드 자리를 다시 목업으로 보여 드릴게요.
2) 「전체」 기간 문장 앞머리 — 권장 "지금까지 …원을 남겼어요" / 대안 "전체 기간에 …원을 남겼어요".
3) 주간 목표 문장은 "가장 가까운 목표"가 아니에요. 계약 → 미팅 → 컨택 → 유입 → 생산 순서에서 처음 못 채운 목표를 말해요.
   권장: 이대로.
4) (이메일 칸) 화면 녹화(PostHog 세션 녹화)에 지금 연락처처럼 이메일 입력도 찍혀요.
   권장: 그대로(연락처와 같은 기준) / 원하시면 이메일 칸만 녹화에서 빼요(화면은 그대로, 나중에 되돌리기 쉬움).
따로 하나 더: 보관함·메모 붙여넣기를 화면 녹화에서 빼는 수정(PR #1131)이 준비돼 있어요. 머지할까요?
```

**결정 목록**: 답이 없으면 권장안으로 간다. 단 승인 자체는 belie가 명시적으로 해야 한다.

| 결정 | 항목 | 권장(코드 변경 0) | 대안을 고르면 |
|---|---|---|---|
| ① 카드 위치 | A | 생산성 아래·전체 진행건 위 (`page.tsx:163`) | 「휴대폰은 재무 바로 아래」 — A plan 인계 §2. 375·390 스크린샷을 붙인다 |
| ② 멈춤 기준 | A | 7일·이월 포함 (`dashboard-follow-ups.ts:19`) | N일 또는 이월 제외 — A plan 인계 §2 |
| (숨은) 주간목표 첫 화면 규칙 | A·B | 목표가 첫 화면 아래로 내려가도 된다고 기록 (`docs/plans/completed/weekly-goals-polish.md:3`) | 「목표는 첫 화면 유지」 → A는 **새 목업 → 재승인**부터. **B도 머지 전에 B만 넣은 상태를 잰다**(아래 「목표 첫 화면 측정」). 넘치면 B도 새 목업·재승인에 넣는다 |
| ③ 매출 목표 문장 | B | 넣지 않음, 영업이익 문장으로 | 별도 plan(새 저장값) — B는 그대로 낸다 |
| (숨은) 「전체」 접두어 | B | 「지금까지」 (`finance-headline.ts:21`) | 「전체 기간에」 — B plan 인계 §2 |
| (숨은) 목표 고르는 규칙 | B | 코드대로 고정 순서 (`goal-headline.ts:14,33`) | 「남은 수가 가장 적은 것」 — B plan 인계 §2 |
| ④ 표 위치 | C | 영업이익 패널 안 | 「채널별 성과 카드에」 → **새 목업 → 재승인** |
| ⑤ 기본보기에도 이메일 | D | 확장보기에만 | D plan 인계 §2 ⑤-B |
| 칸 개수 | D | 이메일 1칸 | 2칸 — D plan 인계 §2 칸-2(스키마·시트 열 CF·BN) |
| ⑧ 이메일 칸 녹화 제외 | D | 그대로(연락처와 같은 기준, `lib/analytics/index.ts:23` `SESSION_MASK_PII=false`) | 이메일 입력칸 className에 `ph-no-capture` 1줄(#1131 방식) — D plan 인계 §2 ⑧. 화면 변화 없음 → 변경 목업 불필요 |
| ⑥ 공급처별 비용 열 | E | 1차 제외(2차 카드) | 「지금 넣기」 → 변경 목업 먼저 |
| ⑦ 토글 위치 | E | 도구 줄 버튼(`db-sheet/page.tsx:35`) | 「목록 위 한 줄 띠」 → 변경 목업 먼저 |
| Q1 재계약 시 예전 기록 | F | 다시 붙인다(미팅에서 생긴 계약만) | F plan §0 |
| Q2 추가미팅 두 번째 계약 보관함 | F | 계약 카드마다 따로 | F plan §0 |
| PR #1131 머지 | 별도 | belie가 「머지」라고 할 때만 | 답이 없으면 그대로 둔다 |

- 화면이나 동작이 바뀌는 대안을 고르면 구현 전에 변경 목업을 보이고 다시 승인받는다(workflow.md:46).
  - 해당 대안: ① 대안, 「목표 유지」, ④·⑥·⑦ 대안, ⑤-B, 칸 2개. (⑧ 대안은 화면이 같으므로 해당 없음)
- 다시 묻는 것은 그 결정 하나뿐이다. 나머지 항목은 계속 진행한다.

**목표 첫 화면 측정(「목표는 첫 화면 유지」를 골랐을 때만, B 머지 전)**
- B PR head에서 §5 「PR head에서 합성 화면 찍기」로 목업 서버를 띄운다. `/dashboard?finance=profit&goals=remaining`을 1366×768과 390×844로 연다.
- 잴 값: `document.querySelector('section[aria-label="주간 목표"]').getBoundingClientRect().bottom`(스크롤 0에서). 한계는 1366×768 = 768, 390×844 = 784다(`tests/browser/weekly-goals-browser.mjs:346`과 같은 기준).
- 두 폭 모두 한계 이하면 B는 그대로 진행한다. 하나라도 넘으면 B도 A와 함께 새 목업 → 재승인 대상이다(예: 목표 문장 위치). 숫자와 head SHA를 B plan 「승인 기록」에 적는다.

**일부만 승인할 때(항목별 승인 규칙)**
- **승인된 항목만 진행한다.** 승인 안 된 항목은 PR을 만들지 않고 기다린다. 다른 항목은 계속한다.
- 대시보드 목업 서버·fixture(`tests/browser/dashboard-followups-server.mjs`·`-fixture.tsx`)는 B 파일(`dashboard-headlines-matrix.tsx`)과 C 파일(`dashboard-channel-profit-{data.mjs,scenario.ts}`)을 import한다(fixture:20·:22, server:17). 그래서:
  - A·B·C가 모두 승인되면 → 마지막에 머지되는 대시보드 PR이 server·fixture를 함께 커밋한다(기본: A).
  - A가 빠지면 → B·C 중 나중에 머지되는 PR이 커밋한다.
  - B 또는 C가 빠지면 → server·fixture는 **커밋하지 않는다**(빠진 항목의 파일을 끌고 오게 된다). 보관 가지에만 두고, 화면 확인은 §5의 임시 checkout 방식으로 한다.
  - 대시보드 PR이 하나도 없으면 커밋하지 않는다.
- A가 빠지면 F PR-2의 활동 조인은 F plan §6-6 「A가 없을 때」대로 한다. C가 빠지면 F plan §6-7을 건너뛴다.
- D가 빠지면 F PR-1은 D 없이 간다(§4의 D 보류 규칙과 같다). E가 빠지면 F PR-5·6a·6b는 E 없이 가고, E 하네스(`tests/browser/db-sheet-supplier-server.mjs`) 수정도 하지 않는다.

**승인 기록 남기기**: [task-template.md](../../../development/task-template.md) 「목업·승인」 필드를 따른다. 각 plan에 아래 블록을 채운다.
- 넣을 자리:
  - A·B — 기존 「승인 기록」 절.
  - C — 「Codex 인계」 바로 앞의 「승인 기록」 절(빈칸으로 만들어 둠).
  - D — 인계 §3-1에 따라 새 「승인 기록」(⑧ 답 포함).
  - E — 「수용 기준」의 「목업 belie 승인」 칸 체크.
  - F — §15.
```
## 승인 기록
- 목업 버전 / 링크 / 제품 기준 SHA: artifact 1791746266-5ce4 (NN번 장) · https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG · 목업 커밋 ecf241c2 · base b51d04b8
- 사용자 승인 시점·메시지 근거: 2026-10-?? HH:MM KST · "belie 회신 원문 요지"
- 승인 화면·동작·범위: 이 plan 「범위」 그대로 · 결정 ①=권장 … (이 항목 결정 전부)
- 목업/제품 차이·비지원 상태: 이 plan 「위험」 절 참조 · 승인 페이지 꼬리말의 「커밋 전」은 지금 ecf241c2
- 미승인·수정 요청: 없음 / (있으면 변경 목업 경로·SHA·스크린샷 경로, 과거 승인본 보존)
```
- **worklog 기록 자리**: 메인 checkout은 읽기 전용이고 worklog 공동 항목은 쓰지 않는다. 그래서 승인 사실은 **처음 머지되는 항목 PR(기본 B)의 worklog 항목 안에** 「승인(A~F 공통): 시각·근거·결정 답 요지」 한 줄로 함께 쓴다. 그 전까지는 각 plan 「승인 기록」이 정본이다.

## 4) 승인 후 순서

**전체 직렬 순서(권장)**

| 순번 | PR | 새 가지 | 앞에 끝나 있어야 하는 것 |
|---|---|---|---|
| 0 | #1131 | (기존) `fix/vault-no-recording` | belie의 「머지」. 현재 head CI 재확인. D와 `CompanyDocAutofillDialog.tsx`(다른 줄 :311 / D :35), F PR-4와 `CompanyVaultSection.tsx`(다른 줄 :229 / F :28-31)가 겹친다 — 나중에 머지하는 쪽이 rebase |
| 1 | B 한 줄 문장 | `feat/dashboard-card-headlines` | 승인(「목표 유지」를 골랐으면 §3 측정 통과) |
| 2 | C 채널별 남은 돈 | 구현·검증 중 | C 전용 PR·독립 검증 후 총괄 직렬 배포 | 위치 승인, channel-profit-release; 운영 미반영 |
| 3 | A 오늘 챙길 일 | `feat/dashboard-follow-ups-card` | B·C(목업 서버·fixture를 가져가므로 — §3 「일부만 승인할 때」). 늦어지면 A가 먼저 가고 서버·fixture는 마지막 대시보드 PR이 가져간다 |
| 4 | D 이메일 칸 | `feat/company-info-email` | 머지 직전 census exit 0. 보류되면 D만 멈추고 다음으로 간다(아래 「D 보류 규칙」) |
| 5 | E 공급처별 보기 | `feat/db-sheet-supplier-summary` | — (A와 `lib/types/db-sheet.ts` 다른 줄 겹침 → 나중 쪽 rebase) |
| 6~12 | F PR-1 → 2 → 3 → 4 → 5 → 6a → 6b | F plan §4 가지 이름(PR-1은 `chore/company-id-contract`) | PR-1은 D 뒤가 기본(D 보류 규칙). PR-2는 A·C 뒤가 기본 — A·C가 보류되면 F plan §6-6·§6-7 대안대로. **E는 F PR-5 전에**(PR-5가 `lib/repo/db/db-sheet.ts:114`를, 6a·6b가 같은 파일·pglite 시험을 고친다. PR-1과는 `lib/types/db-sheet.ts` 다른 줄만 겹쳐 나중 쪽이 rebase). 운영 DB 쓰기 단계마다 belie 「진행」(§7·F plan §4) |

- D·E는 A·B·C와 코드가 겹치지 않는다. 그래서 1~5 사이 어디에 끼워도 된다. 단 머지는 한 번에 하나다.
- **D 보류 규칙(README·D plan §4·F plan §5·§12 같은 문장)**: **D가 census로 보류되면 F PR-1부터 D 없이 진행한다. 이메일 유지 단언은 D가 나중에 rebase하면서 추가한다.** (D가 F PR-2보다 먼저 머지되면 F PR-2가 `tests/service/company-rename.test.ts`에 그 단언을 넣는다.)
- **직렬 규칙**(CLAUDE.md:47, :53, deploy-vps.md:14-19): PR 하나를 머지하면 배포 run success와 공개 health 200을 확인한다. 그다음 worklog를 쓰고 나서 다음 PR을 머지한다.
  - 다음 PR은 최신 `origin/master`에 rebase한다. 그 head에서 check.sh와 CI를 다시 통과시킨다(리베이스 전 CI 재사용 금지).
- **공용 계약 먼저**(CLAUDE.md:45): `lib/types`·`lib/config`·`scripts`·`.github`·SSOT를 건드리는 다른 열린 PR이 있으면 그 PR을 먼저 머지한다.
  - 같은 파일을 다른 PR과 동시에 고쳐야 하면, 그 계약 변경만 먼저 단독 PR로 낸다.
  - 예: C의 `lib/types/dashboard.ts`.

**가지 전략**
- `feat/dashboard-followups`는 **통째로 PR·머지하지 않는다.** 116파일에 A~E가 섞여 있고, 이 가지는 원본 보관용이다. rebase·force-push도 하지 않는다(문서 커밋만 위에 쌓는다).
- 항목마다 최신 `origin/master`에서 새 worktree와 가지를 만든다. 위치는 `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/<slug>`(AGENTS.md:25-26) 절대경로로 쓴다. 그 안에서 `npm ci`를 한다.
- **그 항목만 쓰는 코드 파일**: 먼저 `git diff b51d04b8 origin/master -- <파일들>`이 비었는지 본다. 비었으면 `git checkout ecf241c2 -- <파일들>`로 가져온다(가지 이름이 아니라 **SHA**로 — 가지는 문서 커밋으로 움직인다).
  - 목록은 각 plan 인계 절에 있다: A §3-5, B §3-4, C §3-4, D §3-4, E §2. 이 목록에는 plan 파일이 없다(아래).
  - diff가 비지 않았으면 master가 그 파일을 바꾼 것이다. 손이나 3-way로 옮긴다.
- **여러 항목이 같이 고친 파일**: `git diff b51d04b8 ecf241c2 -- <파일>`을 보고 그 항목 줄만 옮긴다. 손으로 고치거나, patch를 편집한 뒤 `git apply --3way`를 쓴다.

  | 공용 파일 | 줄 담당(ecf241c2) |
  |---|---|
  | `app/(app)/dashboard/page.tsx` | A :20·:149-152 주석·:163 / B :166 `headline` / C :142-147 |
  | `components/dashboard/DashboardFinance.tsx` | B 줄과 C 줄 — B plan 인계 §3-4·C plan 인계 §3-5 |
  | `lib/types/db-sheet.ts` | A :8-10 / E :4·:22-28 |
  | `docs/design/components.md`·`docs/domains/data-model.md`·`tokens.md`·`preview.html` | 각 plan의 해당 줄 목록 |
  | `tests/browser/dashboard-followups-server.mjs`·`-fixture.tsx` | A·B·C 공용 — §3 「일부만 승인할 때」 규칙대로 마지막 대시보드 PR이 통째로(tsconfig `include **/*.tsx`라 B·C 파일 없이 넣으면 tsc가 깨진다) |
  | `docs/worklog.md` | 공동 항목은 쓰지 않는다. 각 PR이 자기 항목을 새로 쓴다(D·E는 plan의 「워크로그 초안」). 승인 사실은 첫 머지 PR 항목에(§3) |

- **plan 문서는 백업 커밋에서 가져온다**: `git checkout $bak -- docs/plans/active/<plan>.md`(`$bak` 찾기 = §2).
  - `git checkout ecf241c2 -- <plan>`은 쓰지 않는다. 그러면 인계 절이 없는 옛 판이 온다. 그래서 각 plan의 checkout 목록에서 plan 경로를 뺐다.
  - 백업 커밋을 아직 못 만들었으면(§2 실패) 그때만 `Copy-Item "$src/docs/plans/active/<plan>.md" "$wt/docs/plans/active/"`로 작업본에서 복사한다.
- `git cherry-pick ecf241c2` 통째는 쓰지 않는다. 경로 checkout이 기본이다.
- PR을 열기 전에 `git diff origin/master...HEAD --stat`을 그 항목 파일 목록과 대조한다. 다른 항목 줄이 섞이거나 빠지면 doc-drift나 tsc가 깨진다.

**PR별 요약**: 상세 = 각 plan.
- 공통 게이트: check.sh → build → 합성 화면(§5, 정확한 PR head) → 다른 검증자 PASS(아래) → CI → squash → 배포·health.
- Changelog는 squash 본문에 넣는다(CLAUDE.md:72 — feat/fix만. docs/chore/refactor는 불필요).

| PR | 가져갈 것 | Changelog(squash 본문) | 이 PR만의 확인 |
|---|---|---|---|
| B | B plan 인계 §3-4 | `Changelog: 대시보드를 열면 이번에 얼마 남겼는지, 주간 목표까지 얼마 남았는지 한 줄로 바로 알 수 있어요.` + 전/후 (B plan 「커밋 메시지」) | 서버·fixture 넣지 않음. `student-dashboard-followup.md`를 completed로 `git mv`. 동일성 diff 비어야 함(B plan 인계 §5). 「목표 유지」면 §3 측정 |
| C | C plan 인계 §3-4·5 | `Changelog: 영업이익을 누르면 채널마다 번 돈·쓴 돈·남은 돈을 볼 수 있어요.` + 전/후 (C plan 「커밋 메시지」) | **필수(같은 PR)**: 「다시 불러오기 1번」 가드를 화면 단위(`DashboardFinance.tsx:62` `useRef`)에서 탭 단위(모듈 상수)로 + 「다시 마운트해도 1번」 시험(C plan 인계 §3-6). 화면 변화 없음. `fin-profit-table` 0줄 |
| A | A plan 인계 §3-5·6 | `Changelog: 대시보드에서 밀린 할 일·결과를 안 적은 미팅·다시 연락할 DB·멈춘 업체를 한눈에 보고 바로 그 화면으로 갈 수 있어요.` (A plan 인계 §3-12) | `preview.html`에 예시 추가(빠져 있음). `"payments"` 0줄. 도착 화면 3종(할 일 강조 링·미팅 3초 링·DbDetail 열림). `/api/db-sheet` `withApiTiming`은 **하지 않는다** — 배포 뒤 db-sheet p95는 NOT_RUN으로 기록(A plan 인계 §3-9) |
| D | D plan 인계 §3-4 PowerShell 목록 | `Changelog: 업체정보에 대표 이메일을 적어 두고 TXT로도 받을 수 있어요.` + 전/후 (D plan 인계 §3-8) | 문서 결함 2개(`components.md:1426`, `data-model.md:611`) 수정. census 헤더 규칙(D plan 인계 §1 결함 3: 빈 칸·「이메일」 통과, 다른 글자 보류) + 시험 3경우. ⑧ 답 반영. 머지 직전 registry 대조 + census exit 0 |
| E | E plan 인계 §2, §4-3 | `Changelog: DB관리시트에서 공급처마다 상담·미팅·계약까지 얼마나 이어졌는지 한눈에 비교할 수 있어요.` (E plan 인계 §4-8) | 투영 계약 변경 시험 3곳이 「약화 아님」을 PR에 적는다. A 코드 섞임 확인(`git grep -n isDbSheetFollowUpResult -- lib app`) |
| F PR-1 | F plan §5(타입·ADR 0035·이 plan) | 없음 — 가지 `chore/company-id-contract`, 커밋 `chore(types): …`. 사용자 변화 0, 새소식 숨김(`scripts/append-updates.mjs:88-94`) | 동작 변화 0 |
| F PR-2 | §6 | F plan §6 Changelog + `Changelog-Group: records-follow-renames` | PR-3을 바로 뒤에(§14 「파생 번호」 위험). **belie가 같은 날 PR-3 「진행」에 답할 수 있을 때만 머지**(F plan §4 ⑤) |
| F PR-3 | §7 | 없음(chore) | 머지 → 배포 → `DB Backfill (company id)` dry-run → belie 「진행」 → execute → 재실행 0. 중단 규칙 F plan §4 ①~④ |
| F PR-4 | §8 | F plan §8 Changelog + Group + `Changelog-Done` | 보관함 PIN·자동 저장 동작 불변. #1131과 `CompanyVaultSection.tsx` 겹침 |
| F PR-5 | §9 | F plan §9 Changelog | `tests/service/gcal-sync.test.ts:62` 기대값이 바뀌는 것은 의도(F plan §9-3). E가 먼저 머지돼 있어야 한다 |
| F PR-6a | §10 | 없음(chore) | 앱 코드 0줄. `DB Migrate` installed dry-run 대기 목록 = 0009 **하나** → belie 「진행」 → execute → seed. 중단 규칙 F plan §4 |
| F PR-6b | §11 | F plan §11 Changelog | **0009가 운영 DB에 있다는 확인 뒤에만** 머지. 배포 뒤 실행 앱 DB = migration DB 확인(F plan §11-4) |

**독립 검증(머지 게이트)**
- 모든 PR이 기능·계산·저장·공용 계약을 바꾸므로 작성자와 다른 검증자를 붙인다(workflow.md:16, [codex-reviewer](../../../playbooks/codex-reviewer.md)). **현재 PR head에 대한 검증 PASS 없이는 머지하지 않는다.**
- **검증자 만드는 법**(위에서부터 되는 것 하나):
  1. 새 Codex 세션: 이 PC에 Codex CLI가 있다(`C:\Users\Belief-desktop\AppData\Roaming\npm\codex.ps1`, 2026-10-12 실측). 비대화형 실행(`codex exec`)을 **읽기 전용 샌드박스**로 띄우고 아래 템플릿을 넘긴다. 정확한 플래그는 `codex exec --help`로 확인한다.
  2. Claude Code 세션: `C:\Users\Belief-desktop\.local\bin\claude.exe`(실측). `claude -p "<템플릿>"`처럼 비대화형으로 띄우고, 쓰기 권한을 주지 않는다. 플래그는 `claude --help`로 확인한다.
  3. Codex 자체의 하위 에이전트 기능이 있으면 그것(대화 맥락을 넘기지 말고 템플릿만).
  - Muse는 검증자로 쓰지 않는다(전역 위임 단계 어디에도 검증 판정이 없다).
  - 실제로 띄운 세션의 모델·도구·응답을 확인한다. 이름만 붙인 세션을 검증자라고 보고하지 않는다.
- **전달 템플릿**(빈 칸을 채워 그대로 보낸다):
  ```text
  [검증 요청] 과업 ID: PLUUUG-<항목>-PR<번호>
  너는 경영일지 검증 담당이다. AGENTS.md, CLAUDE.md, docs/playbooks/codex-reviewer.md 를 따른다.
  금지: 제품 코드·문서 수정, 커밋, push, 머지, 배포, 운영 DB·시트 쓰기, 로그인. checkout 은 읽기 전용, 재현은 격리.
  - 저장소 위치(읽기 전용): <검증용 worktree 절대경로 — 없으면 `git worktree add <경로> <head SHA>` 로 따로>
  - PR: #<번호>  head SHA: <40자>  base(origin/master): <40자>
  - 수용 기준: docs/plans/active/<plan>.md 「수용 기준」 + 「Codex 인계」 절(F 는 해당 PR 절)
  - 승인본: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG <NN>장(버전 1791746266-5ce4) · 목업 커밋 ecf241c2 · 결정 답: <①=… 등>
  - 이미 있는 증거(반복하지 말 것): check.sh <PASS·시각>, build <PASS>, CI <run id>, 스크린샷 <경로>
  - 볼 것: 승인본과 화면·동작 일치 / 계산·날짜·저장·권한·회귀 / PR diff 에 다른 항목 줄이 섞이거나 빠지지 않았는지
  - 반환처: 이 요청을 보낸 총괄 세션(응답 본문으로 돌려준다)
  반환 형식(이것만):
  판정: PASS | FAIL | NOT_RUN
  대상 head: <40자 SHA>
  범위: <확인한 것>
  결함: <위치 · 재현 · 기대값 · 영향> (없으면 "없음")
  NOT_RUN: <못 한 것과 이유>
  사용량: <실제 모델·입력/출력 토큰·시간, 없으면 "측정 불가">
  ```
- 판정 처리:
  - `PASS`이고 `대상 head`가 지금 PR head와 같을 때만 머지 단계로 간다.
  - `FAIL`이면 결함을 고친 새 head를 같은 템플릿으로 다시 보낸다.
  - head가 바뀌면(rebase 포함) 다시 받는다. rebase만 했으면 `git range-diff <옛base>..<옛head> <새base>..<새head>` 결과를 붙여 빠르게 재확인받는다.
  - `NOT_RUN`만 있으면 PASS가 아니다.
  - 판정 원문 요지·head·검증 세션의 실제 모델을 PR 본문과 plan에 남긴다.
- **검증자를 못 구했을 때**(위 1~3이 모두 막힘): 그 PR만 머지하지 않고 다른 항목 준비는 계속한다. belie에게 이렇게 묻는다.
  ```
  belie님, <항목 이름> 수정(PR #<번호>)은 자동 검사는 모두 통과했어요.
  규칙상 만든 쪽과 다른 검토자가 한 번 더 확인해야 반영할 수 있는데, 지금 제가 검토자 창을 따로 띄울 수 없어요.
  1) 권장: 새 Codex(또는 Claude) 창을 하나 열고, 제가 드리는 글을 그대로 붙여 넣어 주세요. 결과가 나오면 제가 이어서 반영·확인까지 해요.
  2) 검토자가 생길 때까지 이 수정은 반영하지 않고 기다려요. 다른 항목은 계속 진행해요.
  ```

**커밋**: PR마다 커밋 1개로 만든다. 제목은 conventional(`feat(scope): …`), 본문 첫 줄은 `Changelog:`이다(chore는 Changelog 없음).
- 머지 때 `gh pr merge <번호> --squash --body-file <메시지파일>`로 Changelog 줄이 squash 본문에 남게 한다.

## 5) 실행 방법

**환경(이 PC, 2026-10-12 실측)**
- 셸은 PowerShell 7.6(`$PSNativeCommandArgumentPassing = Windows`)이다. **PATH의 `bash`는 `C:\Users\Belief-desktop\AppData\Local\Microsoft\WindowsApps\bash.exe`(WSL 실행기)로 잡힌다.**
  - check.sh·doc-drift는 Git Bash로 돌린다: `& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh`, `& "C:/Program Files/Git/bin/bash.exe" scripts/doc-drift.sh`. 이 방법으로 2026-10-12 전체 check.sh PASS(§2).
  - **`npm run check`와 맨 `bash …`는 쓰지 않는다.** `npm run check`도 내부에서 `bash scripts/check.sh`를 불러 WSL로 간다(`package.json` scripts).
  - 환경변수는 `$env:PORT = "4519"`, 끄기는 `Remove-Item Env:PORT`. HTTP 확인은 `curl.exe -s -o NUL -w "%{http_code}" <주소>`(`curl`은 PowerShell 별칭일 수 있어 `.exe`를 붙인다). 줄 이음 `\`·`&&` 대신 배열 변수나 `;`를 쓴다. 폴더 이동은 `Set-Location`.
  - plan에 bash 문법이 남아 있으면 이 규칙으로 바꿔 읽는다.
- `gh`: `C:\Program Files\GitHub CLI\gh.exe`.
- `.env.local`은 메인 checkout에만 있다(D census용). 복사하지 않는다.
- 브라우저 QA 도구: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/weekly-goals-qa-tools`. Playwright는 `channel:"chrome"`만 동작한다(A plan 인계 §1).

**worktree 정리(옛 규칙 정정)**
- plan에 있던 「`git worktree list` 12개 = 상한이라 먼저 정리」는 현재 규칙과 다르다. 지금 규칙(CLAUDE.md:95-96): **자기가 만든 항목 worktree만 머지·배포 뒤 정리한다. 남의 worktree는 건드리지 않는다.**
- 실측(2026-10-12): `git worktree list` 12개 = 메인 1 + `_wt/salespt-log/*` 5 + `.claude/worktrees/*` 3(다른 Claude 세션) + `<메인>/wt/*` 3.
- check.sh의 상한(12)은 **경고만** 하고 `<메인>/wt/` 아래 폴더 수만 센다(check.sh:64-89). 그 폴더에는 등록 안 된 옛 폴더까지 36개가 있어 경고가 늘 뜬다. 우리 일이 아니므로 지우지 않는다.
- **자기 worktree 정리 명령**(최상위 `node_modules`만. 하위 폴더 `node_modules`에는 쓰지 않는다 — 옮기다 형제 파일이 사라진 사고가 있었다):
  ```powershell
  $main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
  $wt   = "<자기 항목 worktree 절대경로>"
  git -C $wt status --porcelain          # 비어 있어야 한다. 남은 증거·미추적 파일이 있으면 먼저 옮겨 보존한다
  New-Item -ItemType Directory -Force "C:\_nmdel\_empty" | Out-Null
  $tmp = "C:\_nmdel\" + (Split-Path $wt -Leaf)
  Move-Item "$wt\node_modules" $tmp      # 같은 C: 라 이름 바꾸기로 바로 끝난다(짧은 경로로 옮겨 260자 한계를 피함)
  robocopy "C:\_nmdel\_empty" $tmp /MIR /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null   # $LASTEXITCODE 0~7 은 정상
  Remove-Item $tmp -Recurse -Force
  git -C $main worktree remove $wt       # --force 쓰지 않는다. 거절되면 이유(미커밋 변경)를 먼저 본다
  git -C $main worktree prune
  ```

**새 항목 worktree(예: B)**
```powershell
$main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
$wt   = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-headlines-1013"
git -C $main fetch origin
$bak = git -C $main log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
git -C $main worktree add $wt -b feat/dashboard-card-headlines origin/master
Set-Location $wt; npm ci
git diff b51d04b8 origin/master -- <항목 파일들>          # 비어 있어야 통째 checkout 안전
git checkout ecf241c2 -- <항목 전용 파일들>               # 목록 = 해당 plan 인계 절(plan 파일 없음)
git checkout $bak -- docs/plans/active/dashboard-card-headlines.md   # plan은 백업 커밋에서
```

**공통 게이트(각 항목 worktree에서)**
```powershell
npm run typecheck; npm run lint; npm run test:structural
& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh    # 필수. typecheck·lint·structural·unit·500줄·doc-drift
npm run build                                             # 앱 코드가 바뀌면 필수(CLAUDE.md:51). 목업 서버 폰트에도 필요
git diff origin/master...HEAD --stat                      # 그 항목 파일 목록과 대조
```
- 항목별 vitest 목록: A plan §5, B plan §5, C plan §5, D plan §5, E plan §6.
- **판정은 건수가 아니라 「전부 PASS(실패 0)」로 한다.** plan에 적힌 건수(59 / 112 / 86 / 165 / 104)는 모든 항목이 섞인 `ecf241c2`에서 센 것이라, 항목을 나눈 PR에서는 달라진다(예: B 회귀 목록의 `finance-three-columns.test.ts`에는 C 시험이 들어 있다). 나눈 PR의 건수는 새로 세어 PR·plan에 적는다.

**목업 서버(백그라운드로 띄우고 끄기)**
- 원본 worktree에서는 `.next`가 있으니 바로 돌릴 수 있다. 새 worktree는 `npm run build`를 먼저 한다.
- 포트 3000(로컬 dev 기본)과 **3100(모아워크 운영, CLAUDE.md:79)** 은 피한다.
- 서버는 esbuild watch로 계속 돈다. 앞에서 실행하면 셸이 멈추므로 **항상 백그라운드로 띄우고, 자기가 띄운 PID만 끈다.**

```powershell
$wt  = "<서버를 돌릴 worktree 절대경로>"
$log = Join-Path $env:TEMP "pluuug-mock-4519.log"
$env:PORT = "4519"                                   # A·B·C·E 서버는 PORT를 읽는다. D 서버는 안 읽는다(자동 포트)
$mock = Start-Process node -ArgumentList "tests/browser/dashboard-followups-server.mjs" -WorkingDirectory $wt -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
Remove-Item Env:PORT                                 # 자식은 이미 물려받았다
for ($i = 0; $i -lt 60 -and -not (Select-String -Path $log -Pattern "http://127" -Quiet -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Seconds 1 }
Get-Content $log                                     # 주소 한 줄(E는 SEED_OK 줄도)이 보여야 한다. 안 보이면 "$log.err"
# … 화면 확인 …
taskkill /PID $mock.Id /T /F                         # 자기가 띄운 서버와 그 자식만 끈다
```
- 명령이 끝날 때 자식 프로세스까지 끝내는 도구 환경이면 서버가 바로 꺼진다. 그때는 띄우기 → 확인(Playwright 스크립트) → 끄기를 한 명령 안에서 이어서 한다.
- 서버별 주소와 시나리오:
  - A·B·C `tests/browser/dashboard-followups-server.mjs`(PORT 읽음, server:294)
    - A `/dashboard?scenario=some|many|empty|error|unsupported`(`&slow=1`). some 기대값: 밀린 1·오늘 1·미팅 2·다시 연락 2·멈춘 업체 3·7일 안 1, 총 9건 + 연결 끊긴 할 일 안내 1줄
    - B `/dashboard?finance=profit|loss|cost-only|none|refund|ledger-fail|big` · `?goals=remaining|done|unset|zero` · `?slow=1` · `/headlines`
    - C `/dashboard?channels=demo|large|loss|empty`(+ `&ledgerFail=1 &noChannels=1 &staleChannels=1 &renamed=1 &stuck=1`) → 영업이익 칸을 누른다
  - E `tests/browser/db-sheet-supplier-server.mjs`(PORT 읽음, :169). 시작 때 `SEED_OK 98 leads (A 40/16/6/2 · B 25/6/1/0 · 메타 30/14/4/2 · 미입력 3)`가 떠야 한다. `/db-sheet?view=suppliers`(`&empty=1 &few=1 &many=1 &error=1`)
  - D `tests/browser/company-info-email-server.mjs`(PORT 안 읽음, :73 자동 포트 — 로그의 주소를 쓴다). `?email=<값>` · `?empty=1` · `?view=all|filled|empty`
  - F 서버 없음. 원본 worktree의 `mockups/records-follow-renames.html`을 브라우저로 연다. 다른 worktree에서는 `git show ecf241c2:mockups/records-follow-renames.html > "$env:TEMP\f-approved.html"`(PowerShell 7.4+는 바이트 그대로 저장) 후 그 파일을 연다.
- 화면 확인 폭: 320·375·430(모바일), 1024·1280·1600(PC)(AGENTS.md:41).
- 스크린샷만으로 클릭·저장 지속성을 통과로 치지 않는다(workflow.md:32).
- 주간목표 브라우저 시험 `tests/browser/weekly-goals-browser.mjs`는 지금 :113에서 멈춘다. 이 가지가 고치지 않은 낡은 단계 때문이다. 첫 화면 검사는 NOT_RUN과 이유를 남기고, 시험 수정은 별도 카드로 낸다(A plan 인계 §1).

**PR head에서 합성 화면 찍기(B·C·A — 서버·fixture가 아직 그 PR에 없을 때)**
- 이유: 대시보드 목업 서버·fixture는 마지막 대시보드 PR에만 들어간다(§3). 그러나 검증은 **정확한 PR head**의 화면이어야 한다(workflow.md:41). `ecf241c2`에서 찍으면 결정 변경·보강(C §3-6 등)이 빠진다.
- 순서: **커밋해서 head를 고정 → 목업 파일만 임시로 꺼냄 → 찍기 → 원상복구 → 깨끗한지 확인 → push.** 임시 파일이 있는 동안에는 `git add`·`git commit`·check.sh를 하지 않는다(pre-commit의 tsc가 임시 .tsx까지 검사해 깨진다).
```powershell
$wt = "<PR worktree 절대경로>"; Set-Location $wt
git status --porcelain                               # 비어 있어야 한다(먼저 커밋)
git rev-parse HEAD                                   # 이 SHA를 스크린샷 폴더 이름·PR 본문에 적는다
$fx = "tests/browser/dashboard-followups-fixture.tsx"
$mockFiles = @("tests/browser/dashboard-followups-server.mjs", $fx,
  "tests/browser/dashboard-channel-profit-data.mjs","tests/browser/dashboard-channel-profit-scenario.ts")
$bInHead = Test-Path components/ui/CardHeadline.tsx  # B 코드가 이 head에 없으면(미승인·미머지) 승인표 matrix는 꺼내지 않는다(import 대상이 없어 번들이 깨진다)
if ($bInHead) { $mockFiles += "tests/browser/dashboard-headlines-matrix.tsx" }
$missing = @($mockFiles | Where-Object { -not (git ls-files -- $_) })   # 이 head에 없는 파일만 꺼낸다(있는 것은 PR 것을 쓴다)
$missing                                             # 눈으로 확인. 비어 있으면 꺼낼 것이 없다 — 아래 checkout·restore 를 건너뛴다
# ⚠️ 경로 없이 `git checkout ecf241c2 --` 를 치면 HEAD 가 그 커밋으로 바뀐다. 반드시 Count 를 확인한다
if ($missing.Count -gt 0) { git checkout ecf241c2 -- @missing }
if (-not $bInHead -and ($missing -contains $fx)) {   # 임시 fixture 사본에서만 matrix import(:20)와 "/headlines" 줄(:58)을 지운다
  (Get-Content $fx) | Where-Object { $_ -notmatch 'from "\./dashboard-headlines-matrix"|"/headlines": HeadlineMatrix' } | Set-Content $fx
}
# … 위 「목업 서버」대로 띄워 찍고 끈다 …
if ($missing.Count -gt 0) {
  git restore --staged -- @missing                   # 꺼낸 파일을 색인에서 뺀다
  $missing | ForEach-Object { Remove-Item -LiteralPath (Join-Path $wt $_) }
}
git status --porcelain                               # 다시 비어 있어야 한다. 아니면 push·PR 하지 않고 원인을 본다
```
- 화면을 보고 코드를 고치면 새 커밋을 만들고 이 절차를 다시 한다.

## 6) 배포·운영 확인

[deploy-vps.md](../../../playbooks/deploy-vps.md) 「정상 완료」 그대로다. 각 PR마다:
1. 머지 직전 `git fetch origin; git rev-parse origin/master` → last-good SHA를 PR과 worklog에 적는다.
2. 현재 head의 CI(`Typecheck & QA`)가 success인지, 검증 PASS가 같은 head인지 본다. 직렬 순서로 squash merge한다.
3. `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion,status,headSha`가 `success`이고 headSha가 squash SHA와 같은지 본다.
4. `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online`과 `…/api/health`가 200인지 본다. **200만으로 새 버전 성공을 주장하지 않는다.**
5. 운영 화면을 확인한다(각 plan 「배포 뒤 운영 확인」).
   - Codex는 운영에 로그인하지 않고 실계정에 쓰지 않는다. belie에게 「보기만」 확인을 부탁한다.
   - 할 일 완료 체크, 미팅 결과 저장, 상담 기록, 가져오기 버튼은 누르지 않는다.
   - 못 했으면 NOT_RUN으로 적는다.
   - **PostHog·Sentry**: 이 인계에는 접속 수단(계정·도구)이 없다. Codex 세션에 실제로 연결된 읽기 도구가 있을 때만 읽기로 보고, 없으면 각 plan의 PostHog·Sentry 확인은 **NOT_RUN(접속 수단 없음)** 으로 적는다. belie에게 대시보드 캡처를 부탁해도 된다(선택).
6. worklog 맨 위에 항목을 쓴다(SHA·run id·검사·검증 판정·운영 확인·미완료). plan의 체크칸을 고치고, 이 README §2 표는 §2 「이 README의 자리」대로 고친다.
   - **다 끝난 plan을 `docs/plans/completed/`로 옮기는 것**은 따로 PR을 만들지 않아도 된다. ① 다음 항목 PR에 그 이동 1건을 함께 넣거나(권장 — 이미 `npm ci`가 된 worktree), ② 마지막에 문서 PR 1개로 묶는다.
   - 문서만 바꾸는 PR도 pre-commit이 전체 check.sh를 돌린다(`.githooks/pre-commit:31-34`, AGENTS.md:39). check.sh는 `npx --no -- tsc` 등을 쓰므로 그 worktree에도 `npm ci`가 필요하다. `npm run build`는 생략하고 「문서만 — build NOT_RUN」을 PR에 적는다.

**실패 대응**(deploy-vps.md:21-28)
- SSH나 러너 연결이 실패하면 원격 `.deploy` 상태를 보고 `gh run rerun <id> --failed`를 쓴다. 연결 실패만으로 revert하지 않는다.
- build나 health 결함이면 되돌린다.
  - 최신 `origin/master`에서 `fix/revert-<slug>` 가지를 만들고 `git revert <squash-sha>` → PR → CI → squash한다.
  - master 직접 커밋은 pre-commit이 막는다(`.githooks/pre-commit:13-17`).
  - 되돌린 배포도 success와 health 200까지 확인한다.
- `reset --hard`나 force-push로 master 역사를 바꾸지 않는다.
- A·B·C·E는 저장값이 없어 revert만 하면 된다.
- D는 CE·BM에 이미 쓰인 값이 남지만 무해하다.
- F는 PR마다 되돌리는 법이 다르다(F plan 각 PR 「되돌리기」). 백필 데이터를 지우는 것은 실행 직후에만, belie 승인을 받아서 한다.

## 7) 하지 말 것

- #2(통합 타임라인)·#5(분할 정산 회차·자동 지연)를 되살리지 않는다. #6(발생주의 매출)도 만들지 않는다(§1).
- belie의 명시적 승인 전에 구현·PR·머지·배포를 하지 않는다. 승인한 화면이 바뀌면 변경 목업을 먼저 보인다. 승인 안 된 항목은 진행하지 않는다.
- **belie의 명시적 「진행」 없이 운영 DB에 쓰지 않는다.**
  - 대상: F PR-3 백필 execute, F PR-6a `DB Migrate` execute, 지난 상담 기록 seed execute.
  - 순서는 늘 dry-run → 건수만 worklog → 「무엇을·몇 건·되돌리는 법」 3줄로 묻기 → 「진행」 → execute → 같은 dry-run 0건(F plan §4).
  - **중단 규칙(F plan §4 ①~⑤ 요약)**: ① execute 뒤 재실행이 0이 아니면 다시 execute하지 않고 멈춰 원인을 보고한다(새 「진행」 필요). ② execute의 실제 쓴 행 수가 dry-run 계획 건수와 다르면 멈춘다. ③ 겹침·모호·연결 못 찾은 할 일·헤더 정크가 0보다 크거나 「이미 있음」이 예상과 다르면 그 건수를 3줄 질문에 반드시 넣는다. ④ 시트 하나에서 트랜잭션이 실패하면 그 시트는 롤백된 상태로 두고, 재시도는 같은 「진행」 범위 안에서 1번만 한다. ⑤ F PR-2는 belie가 같은 날 PR-3 「진행」에 답할 수 있을 때만 머지한다.
- 운영 시트에 쓰지 않는다. 실데이터·비밀값·업체명을 fixture·로그·PR·Muse 문맥에 넣지 않는다.
- `--no-verify`·force-push·`reset --hard` master·`.git` 직접 조작·테스트 약화로 검사를 통과시키지 않는다.
- VPS `/opt/salespt-log`에 수동으로 들어가지 않는다. 모아워크 `:3100`·`/srv/moawork-direct`는 접근·종료 금지다.
- **D는 census 없이 머지하지 않는다.**
  - census는 READ-ONLY이고 숫자만 출력한다. cwd는 메인 checkout이다.
  - 헤더 규칙(D plan 인계 §1 결함 3)을 고친 판으로 돌린다. 머지 전 대상 시트 수를 DB registry와 대조한다(D plan 인계 §3-10).
  - exit 0이 아니면 머지하지 않고 belie 결정함에 올린다. 오류만 있는 결과는 1번 다시 돌려 본 뒤 보고한다.
  - 행 쓰기에는 사전 읽기 가드가 없다. 그래서 census가 유일한 안전선이다(D plan 인계 §7).
- **F 마이그레이션 순서를 지킨다.**
  - 0009 표와 그 표를 쓰는 코드를 한 PR에 넣지 않는다(리뷰 blocker).
  - PR-6b는 0009가 운영에 적용된 것을 확인한 뒤에 머지한다.
  - 적용한 0009 파일은 절대 고치지 않는다(체크섬 → 이후 마이그레이션 전부 실패). 고칠 것은 0010으로 낸다.
  - 배포가 마이그레이션을 적용하지 않는다(CLAUDE.md:22). `DB Migrate` installed 모드는 master에서만 돈다(`.github/workflows/db-migrate.yml:72-75`).
- `feat/dashboard-followups`를 통째로 머지하지 않는다. 원본 worktree를 지우지 않는다. `specs/*.json`을 커밋하지 않는다. 이 README를 master에 넣지 않는다.
- PR #1131은 belie 지시 없이 머지하지 않는다. 보호 PR #1002·#798은 건드리지 않는다(worklog 2026-10-10).
- 남의 worktree·가지(`.claude/worktrees/*`, `<메인>/wt/*` 등)를 정리하거나 인수하지 않는다. `node_modules`를 링크로 공유하지 않는다.
- 새소식 팝업을 사용자 대신 닫지 않는다(CLAUDE.md:75).
- 검증 PASS(현재 head) 없이 머지하지 않는다.

## 8) 열린 위험·미확인

1. **주간목표 첫 화면 충돌(실측)**: A 카드와 B 문장이 들어가면 주간 목표가 첫 화면 밖으로 밀린다. 목표 아래 끝이 1366×768에서 925px(한계 768), 390×844에서 1171px(한계 784)이다. belie 답을 꼭 기록한다. 「유지」면 B도 머지 전에 잰다(§3).
2. **승인 페이지와 코드가 어긋난다**:
   - 02장은 「가장 가까운 목표 하나」라고 썼지만 코드는 고정 순서다.
   - 「전체」 접두어 질문, 이메일 녹화 질문(⑧)이 페이지에 없다.
   - 꼬리말 「커밋 전」은 지금 `ecf241c2`로 커밋됐다.
   - 모두 §3 문안에 넣었다.
3. **build 미실행**: `ecf241c2`에서 `npm run build`와 브라우저 수치 재측정은 NOT_RUN이다(전체 check.sh는 PASS, §2).
4. **인계 문서 보존**: 백업 커밋(§2) 전까지 인계 문서는 이 PC 작업본에만 있다. 백업 커밋이 실패하면 승인 요청보다 그 원인 해결을 먼저 한다.
5. **가지 나누기 실수**: 공용 파일에서 다른 항목 줄이 섞이거나 자기 줄이 빠질 수 있다. `--stat` 대조, doc-drift, tsc로 잡는다.
6. **master 이동 미확인**: 이번 세션은 네트워크를 쓰지 않았다. 로컬 `origin/master`는 `b51d04b8`이지만 원격은 더 나아갔을 수 있다. fetch 뒤 `git log b51d04b8..origin/master --stat`으로 A~F 파일과 겹치는지 본다.
7. **C 반복 재조회**: 영구 어긋남이 있으면 대시보드를 열 때마다 `GET /api/dashboard`가 1번 더 나간다. 이 요청은 원장 반복 지출 쓰기를 포함한다. → C PR에서 탭 단위 가드를 **같이 넣는다**(§4). 그래도 탭을 새로 열 때마다 1번은 남는다.
8. **A 조회 부하**: `/api/db-sheet`는 방문마다 레지스트리를 캐시 없이 읽는다. 계측(`withApiTiming`)을 이번에 넣지 않으므로 배포 뒤 p95는 NOT_RUN이다. 느리다는 신호가 오면 별도 카드.
9. **D census 결과 모름**: 라이브 시트를 아직 읽지 않았다. 세션 녹화(⑧)는 belie 답대로 한다.
10. **E 화면 밀림**: 1280px에서 도구 줄이 두 줄이 된다(결정 ⑦). 숫자가 대시보드와 일부러 다르다(각주로 안내).
11. **F 미정 값**: 백필·seed 실제 건수는 dry-run 전까지 모른다. 마이그레이션·ADR 번호(0009·0035)는 머지 시점의 빈 번호로 정한다. PR-2와 PR-3 사이에는 운영 스크립트를 금지한다.
12. **#1131 상태 미확인**: CI·mergeable을 이번에 다시 보지 않았다. 머지 전 `gh pr view 1131 --json state,mergeable,statusCheckRollup`으로 확인한다.
13. **운영 화면·관측 확인**: Codex가 로그인할 수 없으면 운영 화면 확인은 belie 확인이나 NOT_RUN으로 남는다. PostHog·Sentry도 접속 수단이 없으면 NOT_RUN(§6).
14. **검증자 확보**: 다른 세션을 띄우지 못하면 머지가 멈춘다(§4 「검증자를 못 구했을 때」).

## 9) 첫 응답 체크리스트(Codex)

0. **시작 조건**
   - 시작 폴더(cwd): `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012`(원본 worktree).
   - 필요한 권한(세션 설정·승인으로 받는다. 없으면 그 단계만 멈추고 무엇이 막혔는지 보고한다):
     - 시작 폴더 밖 쓰기: 메인 `C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지/.git/worktrees/`(worktree 등록), 형제 폴더 `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/<slug>`, 정리용 `C:\_nmdel\`, 임시 `$env:TEMP`.
     - 네트워크: `git fetch`·`git push`(force 없음), `gh`(PR·run 조회·머지·워크플로 실행), `npm ci`.
     - 메인 checkout에서 읽기 실행: D census가 메인의 `.env.local`을 읽는다(복사 금지).
     - 운영 쓰기 워크플로(`DB Backfill`·`DB Migrate`·`DB Seed`의 execute)는 belie 「진행」 뒤에만.
   - `gh auth status`로 GitHub 로그인을 확인한다. 안 되면 PR·머지·run 확인 단계가 막힌다고 보고한다(로그인은 belie가 한다).
1. 이 README → `AGENTS.md` → `CLAUDE.md` → `docs/development/workflow.md` → `docs/worklog.md` 맨 위 5~10개 순서로 읽는다. 항목 plan은 그 항목을 할 때 읽는다.
2. `git -C <원본 worktree> status --short`와 `git -C <원본 worktree> log --oneline -3`을 본다.
   - 백업 전: HEAD `ecf241c2`, `M` 5개(plan), `??` F plan, `??` `docs/plans/active/pluuug-handoff/`. → **§2 백업 커밋을 만든다.**
   - 백업 후: HEAD가 `[handoff-backup]`(또는 그 위 `[handoff-progress]`) 커밋이고 작업본이 깨끗하다.
3. `git -C <메인> fetch origin`을 한다. `git rev-parse origin/master`, `git log b51d04b8..origin/master --oneline --stat`으로 A~F 파일과 겹치는지 본다.
4. 열린 PR과 겹침을 본다: `gh pr list --state open --json number,title,files`. #1131 상태도 본다: `gh pr view 1131 --json state,mergeable,statusCheckRollup`.
5. belie에게 §3 문안을 보낸다. 그다음 「현재 단계 = 목업 승인 대기, 기다리는 것 = 승인·결정 답·#1131 여부」를 짧게 보고한다.
6. 기다리는 동안 해도 되는 일은 읽기와 검증뿐이다.
   - `npm run build`(원본 worktree)로 NOT_RUN을 줄인다.
   - 목업 서버 3개가 뜨는지 본다(§5 백그라운드 방식).
   - 가지 나누기용 파일 목록을 plan과 대조한다.
   - 검증자 띄우는 방법(§4)이 실제로 되는지 작은 읽기 요청으로 시험해 본다.
   - 구현·PR·머지는 하지 않는다.
7. 승인이 오면 §3대로 기록하고 §4 순서로 진행한다. 끝날 때마다 이 README §2 표를 고친다(§2 「이 README의 자리」).

## Codex 킥오프 프롬프트

belie가 새 Codex 세션에 그대로 붙여 넣는다.

```text
너는 경영일지(세일즈PT 영업일지) 개발 총괄이다. 사용자 belie는 비개발자이고, belie와 이야기하는 창구는 너 하나다.
이전 작업은 Claude가 했다. 너는 그 대화를 모른다. 아래 파일이 전부다.

시작 폴더(지우지 말 것): C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012
가지 feat/dashboard-followups, 코드 커밋 ecf241c2(base origin/master b51d04b8, push 됨, PR 없음).
인계 문서(README 1개 + plan 6개)가 아직 커밋 전이면 README §2대로 문서만 백업 커밋해 push(force 금지)부터 한다.
필요한 권한: 시작 폴더 밖 쓰기(메인 .git/worktrees, 형제 _wt/salespt-log/<slug>), 네트워크(git fetch·push, gh, npm ci).
먼저 gh auth status 로 GitHub 로그인을 확인한다. 셸은 PowerShell 7이고, check.sh 는 Git Bash 경로로만 돌린다(README §5).

1) 먼저 읽기(이 순서, 필요한 것만):
   docs/plans/active/pluuug-handoff/README.md → AGENTS.md → CLAUDE.md → docs/development/workflow.md → docs/worklog.md 맨 위 5~10개.
   항목별 정본은 README §2 표의 plan 문서다. A~E는 각 plan 끝 「Codex 인계」 절, F는 records-follow-renames.md.
2) 지금 단계는 「목업 승인 대기」다. belie가 명시적으로 승인하기 전에는 구현·PR·머지·배포를 하지 않는다.
3) 첫 응답(README §9):
   - 백업 커밋 상태, git fetch 뒤 origin/master, 열린 PR(#1131 포함), 원본 worktree 상태를 확인해 짧게 보고한다.
   - README §3 문안을 belie에게 보낸다(승인 링크 + 페이지에 빠진 확인 4개 + #1131 머지 여부).
4) belie가 승인하면:
   - 승인된 항목만 진행한다. 답이 없는 결정은 권장안으로 한다. 각 plan에 승인 기록을 남긴다.
   - README §4 순서(B → C → A → D → E → F PR-1~6b)로 한 번에 하나씩 진행한다.
   - 항목마다 최신 origin/master에서 새 worktree와 가지를 만들고 그 항목 코드 파일만 ecf241c2에서 옮긴다.
   - plan 문서는 백업 커밋에서 git checkout 으로 가져온다. feat/dashboard-followups는 통째로 머지하지 않는다.
5) PR마다:
   check.sh 초록(Git Bash 경로) → npm run build → 정확한 PR head의 합성 화면 확인(README §5)
   → 작성자와 다른 검증자의 PASS(같은 head, README §4 템플릿) → CI 초록 → 직렬 squash 머지
   → Deploy to VPS success·health 200 → worklog.
6) 하지 말 것(README §7):
   - 기각한 #2·#5를 되살리기.
   - belie 「진행」 없이 운영 DB에 쓰기(F 백필·DB Migrate·seed). 중단 규칙 ①~⑤를 지킨다.
   - census 없이 D 머지.
   - --no-verify·force-push, 맨 bash·npm run check(=WSL) 사용.
   - /opt/salespt-log 수동 접근, :3100·/srv/moawork-direct 접근.
   - 남의 worktree 정리.
   - 실데이터·비밀값을 fixture·로그에 넣기.
7) belie에게는 쉬운 말로 결론부터 말한다. 확인한 것과 하지 않은 것(NOT_RUN)을 나눠 보고한다.
   모델별 토큰·시간 보고와 Muse 위임 단계는 네 전역 지침을 따른다.
```

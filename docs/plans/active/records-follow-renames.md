> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Pluuug 배울점 F(#1 업체 고유번호 · #9 변경 기록)를 PR 7개(1·2·3·4·5·6a·6b)로 나눠 구현하는 설계 — 어디를 어떻게 바꾸고, 무엇으로 검증하고, 운영 DB 쓰기를 어떤 순서·승인으로 하고, 어떻게 되돌리는지.
> - **누가 읽나요**: 개발자(이 작업을 이어받는 Codex/GPT·Claude) · 검증 담당 · 총괄
> - **어떤 기능·작업과 연결?**: 실무/수납 계약 카드(할 일·History·D-day·업체정보·계정 보관함) · 일정·계약 미팅 카드 · DB관리시트 컨택내용 / `lib/util/company-id.ts`(신규) · `lib/repo/db/company-id.ts`(신규) · `lib/service/company-rename.ts`(신규) · `lib/service/company-vault.ts` · `lib/service/meetings-write.ts` · `lib/repo/db/db-sheet.ts` · `lib/repo/db/migrations/0009_db_sheet_contact_log.sql`(신규)
> - **읽고 나면 알 수 있는 것**: ① 업체id 가 어떻게 정해지고 언제 저장·고정되는지 ② PR 마다 고칠 파일·함수·시험·운영 명령·수용 기준·되돌리기 ③ 백필·DB Migrate·지난 기록 채우기를 어떤 순서와 승인으로 하는지
> - **관련 문서**: 인계 지도 `docs/plans/active/pluuug-handoff/README.md`(보관 가지 `feat/dashboard-followups`) · 승인 자료 `mockups/records-follow-renames.html` @ `ecf241c2`(아티팩트 06번 장의 「설명서 열기」와 같은 내용, master 에는 없음 — §0) · [workflow](../../development/workflow.md) · [task-template](../../development/task-template.md) · [deploy-vps](../../playbooks/deploy-vps.md) · A [dashboard-follow-ups.md](./dashboard-follow-ups.md) · C [dashboard-channel-profit.md](./dashboard-channel-profit.md) · D [company-info-email.md](./company-info-email.md) · E [db-sheet-supplier-summary.md](./db-sheet-supplier-summary.md)

# 업체 고유번호 + 변경 기록 (F · Pluuug #1·#9) — 구현 설계

## 0. 먼저 읽기

### 2026-10-13 사용자 결정 — 아래 옛 Q1 자동 복원 설계보다 우선

- 8-1: 재계약할 때 이전 기록이 있으면 팝업에서 **이전 기록 불러오기 / 새로 시작하기 / 취소**를 선택한다. 일괄 자동 복원을 하지 않는다. 미팅에서 생긴 계약의 기존 기록을 대상으로 하며 수동 업체의 다른 계약을 이름만으로 찾지 않는다.
- 8-2: **진행건별 Todo·History 구분을 유지**한다. 업체 안에서 기관/진행건별로 본다. `institutionRef`·진행건 연결·완료 상태·원래 마감일을 보존하며, 업체 전체 하나의 목록으로 합치지 않는다. 통합 타임라인 기각은 유지한다.
- Q2는 원래 보관함 공유 질문이다. Todo·History 통합과 다른 사안이다. 보관함은 기존 권장안인 계약 카드별 분리를 유지하고 자동 병합하지 않는다.
- 새로 시작해도 이전 기록은 삭제하지 않는다. 새 계약에서 과거 Todo가 안정 ID 또는 옛 `contractRef` 폴백으로 다시 붙지 않아야 한다. 프런트에서만 숨기는 방식은 금지한다.
- **PR-1/2 착수 전 설계 보완 필수:** 계약 회차 식별자/세대와 복원 대상 선택을 서버에서 구분하는 프로토콜을 확정하고 저장·조회·D-day·보관함 경로 모두 검토한다. 업체 ID 자체를 무조건 바꾸면 업체정보/보관함이 끊길 수 있으므로 이 문서의 D1/D4/PR-2 자동 재사용 가정을 그대로 구현하지 않는다. 테넌트·미팅 계보 확인, 중복 요청, 동시 요청, 취소 무쓰기, 실패 원자성 시험을 추가한다.
- 새 수용 A6: 불러오기 → 기존 진행건별 기록/마감/완료 상태 그대로; 새로 시작 → 새 회차 빈 목록/과거 기록 보존/옛 ID 및 이름 폴백 혼입 없음; 취소 → 계약/기록 모두 무변경. 이미 활성인 계약에 이 팝업으로 덮어쓰기 금지. 다른 계약·테넌트 기록 혼입 금지.
- 목업: `mockups/records-follow-renames.html`의 재계약 선택 체험. 합성 화면이며 저장 API는 없다. **변경 목업 승인 대기**, 운영 구현·DB 변경 없음. 이전 `ecf241c2` 승인 자료는 원본 가지에 보존한다.

**현재 단계: 승인 자료(설명서) 승인 대기.** belie 가 아직 승인하지 않았다. 승인 기록(15절)을 남기기 전에는 PR-1 을 포함한 어떤 구현·운영 반영도 하지 않는다(workflow.md 「주문 → 설계 → 목업 → 승인」 5).

- 승인 자료: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG → 06번 장 「업체 고유번호 + 변경 기록」 → 「설명서 열기」. 같은 내용의 로컬 파일 `mockups/records-follow-renames.html`(작업 순서 7단계·질문 2개·위험·되돌리기).
- 아티팩트의 결정 ①~⑦ 은 A~E 항목용이다. F 에 해당하는 것은 설명서 안의 질문 2개다. 답이 없거나 「전부 권장안」이면 아래 기본값으로 간다.
  - **Q1 (2026-10-13 교체)** 이전 기록이 있으면 팝업에서 불러오기 또는 새로 시작을 사용자가 선택한다. 취소는 무쓰기. 진행건별 기록 구분은 유지한다. 위 보완 절과 새 A6가 정본이며 자동 복원하지 않는다.
  - **Q2** 같은 업체가 추가미팅으로 계약을 두 번 하면 보관함을 합칠까? → **기본: 계약 카드마다 따로.** 미팅 카드는 그 미팅 계보에 연결된 계약의 보관함을 보여 준다.
- 기준 코드: worktree `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012`, branch `feat/dashboard-followups`, 커밋 `ecf241c2` = origin/master `b51d04b8` + A~E 목업 코드(미머지). **이 문서의 `경로:줄` 은 모두 ecf241c2 기준이다.** A~E 가 먼저 머지되면 줄이 밀린다 — 각 PR 착수 때 최신 origin/master 에서 함수 이름으로 다시 찾는다(`graft callers <심볼>` / `graft skeleton <파일>` / rg).
- 정본 우선순위: **이 문서 > `docs/plans/active/pluuug-handoff/specs/F-records-follow-renames.json`**. JSON(spec + review 원본)은 `.gitignore` 의 `*.json`(:13) 때문에 커밋되지 않는 로컬 파일이라 이 PC 에만 있다. spec 과 이 문서가 다르면 리뷰를 반영한 이 문서가 맞다(13절 대응표).
- **이 문서의 위치**: 이 문서는 원본 worktree 작업본에서 만들었다(처음엔 git 미추적). 인계 README §2 의 백업 커밋(`[handoff-backup]`, 가지 `feat/dashboard-followups`)에 들어간다. **PR-1 에 이 문서를 넣어 master 로 올린다** — 가져오는 법은 `git checkout $bak -- docs/plans/active/records-follow-renames.md`(`$bak` 찾기 = README §2). 백업 커밋이 없을 때만 작업본에서 `Copy-Item` 한다. pre-commit 이 active plan 을 요구한다(`.githooks/pre-commit:19-29`).
- **설명서 html(승인 자료)의 위치**: `mockups/records-follow-renames.html` 은 커밋 `ecf241c2` 에만 있고 master 에는 `mockups/` 폴더가 없다. **일부러 어느 PR 에도 넣지 않고 보관 가지에만 둔다**(승인본을 바꾸지 않고 SHA 로 고정 — workflow.md:25). 보는 법: 원본 worktree 의 `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/dashboard-followups-261012/mockups/records-follow-renames.html` 을 브라우저로 연다(보관 가지 HEAD 에도 그대로 있다). 다른 worktree 에서는 `git show ecf241c2:mockups/records-follow-renames.html > "$env:TEMP\f-approved.html"`(PowerShell 7.4+ 는 바이트 그대로 저장). 승인 기록(15절)에는 「`mockups/records-follow-renames.html` @ `ecf241c2`」로 적는다. 그래서 F 가 끝난 뒤에도 가지 `feat/dashboard-followups` 삭제는 belie 에게 묻는다.
- 읽을 것(필요한 것만): AGENTS.md → CLAUDE.md(§2 #5 bulk-write 가드 · §2.5 · §3.5 · §6.8) → docs/development/workflow.md → docs/worklog.md 최근 5~10건 → 이 문서 → 해당 PR 의 파일.
- 범위 밖: PR #1131(PostHog 세션 녹화에서 보관함·메모 붙여넣기 가림, CI green)은 F 와 무관하다. 자동 안전 검사가 머지를 막았으므로 belie 의 명시적 머지 지시가 있을 때만 머지한다.

## 1. 목표와 범위

목표(belie 가 수락한 #1·#9):
1. 실무/수납에서 업체명·계약일을 고치거나, 일정·계약에서 계약된 미팅의 날짜·업체명을 고치거나, 수동 업체를 미팅에 연결해도 그 계약 카드의 Todo·History, D-day 배지, 업무현황(대시보드 포함), 업체정보, 계정 보관함이 그대로 따라온다.
2. 계약일만 고친 계약도 미팅 되돌리기·미팅 삭제·계약카드 삭제·일정·계약 상단 「계약」 수와 수납 합계가 맞는 짝을 찾는다.
3. 📅 변경으로 생긴 새 미팅 카드와 원래 카드가 같은 보관함을 본다.
4. 미팅 상태가 바뀔 때마다 날짜와 「이전 → 이후」가 미팅 카드 「지난 기록 N건」에 쌓인다. 되돌려도 사유가 지워지지 않는다. 완료·취소 입력칸은 빈 칸으로 열린다. 되돌린 예약 미팅의 구글 캘린더 메모에 지난 사유가 들어가지 않는다.
5. DB관리시트에서 「이 날짜로 상담 기록」을 누를 때마다(같은 날 여러 번도) 상담메모 아래 「지난 상담 기록」에 날짜·결과·메모가 한 줄씩 남는다. 컨택진행 집계는 지금처럼 하루 1건.

제외: #2 업체별 통합 타임라인(거절) · #5 분할 정산 회차·자동 지연(거절) · #6 발생주의 매출(보류) · 대시보드·실무/수납·캘린더 카드 배치 · A 의 대시보드 링크(`/payment?row=&slot=`, lib/analytics/dashboard-follow-ups.ts:105, 234) · 1·2·3·5기 레거시(비DB 기수)의 상태기록·상담기록 · 구글 시트 새 열 · 06 업체정보 키 체계(`계약일|업체명`).

화면 변화는 접이식 줄 2곳뿐이다: 미팅 카드 `MeetingHistoryNote`(PR-5), DB관리시트 `DbContactLog`(PR-6b). 나머지는 「사라진 것처럼 보이던 기록이 그대로 보이는」 동작 변화다.

## 2. 지금 코드가 업체를 찾는 방법(실측)

| 무엇 | 지금 키 | 근거(ecf241c2) |
|---|---|---|
| 계약 행 | `sheet_rows` tab=`contracts`, row_key=`r{row}` | lib/repo/db/read-daily.ts:245-268 |
| 계약↔미팅 | AK(`linkedMeetingId`) 먼저, 없으면 계약일+업체명(수동 행 제외, 시트 C:AK 동기 읽기) | lib/repo/contract-payment.ts:180-214 |
| 할 일·History | `Todo.contractRef` = `계약일|업체명` 정확히 일치 | lib/types/todo.ts:23 · lib/service/todos.ts:154-168 · app/(app)/payment/_components/ContractRow.tsx:218-219 |
| D-day·업무현황·멈춘 업체 | `slotActivityKey("계약일|업체명", 기관)` | lib/analytics/payment-work-status.ts:47-71, 88-113 · app/(app)/payment/_lib/institution-view.ts:84 · lib/analytics/dashboard-follow-ups.ts:55, 85, 94, 191-208 |
| 06 업체정보 | `계약일|업체명.trim()`(ContractRow 는 trim 안 함 → 두 형태 공존) | lib/repo/company-info-archive.ts:64-66 |
| 04 업체정보 대체 읽기·저장 | 미팅날짜=계약일 && 업체명 | lib/service/contract-payment.ts:222-235, 250-255 |
| 계정 보관함 | `m:<미팅id>`, 계약일+업체명이면 그 날짜 미팅의 `m:`, 못 찾으면 `c:<계약일>|<업체명>` | lib/service/company-vault.ts:46-59 |
| 📅 변경 | 새 id + 「(변경) 」 접두 + previousMeetingId, `...original` 복사 | app/(app)/schedule/page.tsx:190-213 |
| 일정·계약 상단 계약 수·수납 합계 | `미팅날짜|업체명.trim()` ↔ `계약일|업체명.trim()` | app/(app)/schedule/_components/SummaryBar.tsx:43-71 |
| 미팅 되돌리기·삭제 → 계약카드 | `clearRowByLink(계약일, 업체명)` (미팅 id 안 씀) | lib/repo/contract-payment-link.ts:22-32 · 호출 5곳 lib/service/contact.ts:328, lib/service/contact-cascade.ts:33, 75, 121-126, 179 |
| 계약카드 삭제 → 미팅 | 미팅날짜=계약일 && 업체명 | lib/service/contract-payment.ts:381-384 |
| 실무/수납 개명 | 02·04·06 은 옮기지만 할 일은 안 옮김 | lib/service/contract-payment.ts:107-178 |
| 미팅에서 날짜·이름 수정 | 옛 키 = 미팅 값, 이름만 바꿔도 계약일을 미팅날짜로 덮음 | lib/service/contact.ts:330-334 → lib/repo/contract-payment-link.ts:54 |
| 미팅 되돌리기 사유 | `미팅사유: ""` | lib/service/contact-cascade.ts:137-142, 145-149 |
| 상담 기록 | `db_sheet_contacts` 하루 1행 upsert(같은 날 덮어씀) | lib/repo/db/db-sheet.ts:103-104 · lib/repo/db/migrations/0008_db_sheet.sql:7-12 |
| 저장 사본 | `db_sheet_history` 저장(리비전)마다 1행 | lib/repo/db/db-sheet.ts:27 · 0008:17-21 |

기반 사실:
- sheet_rows upsert 는 `payload || excluded.payload` 얕은 병합이다(lib/repo/db/client.ts:106-110, writeRowToDb :181-194). **payload 에서 키를 빼면 기존 값이 보존되고, 키를 실으면 덮어쓴다.**
- 계약 편집 미러는 F:AH 화이트리스트만 싣는다(lib/repo/db/contracts-clear.ts:105-133). 그래서 화면이 보내는 계약 객체에 무엇이 있어도 업체id 는 편집 저장으로 바뀌지 않는다.
- DB 전용 필드 선례: `Meeting.발굴id`(lib/types/meeting.ts:162, optional·default 없음 = R11) · `ContractPayment.계약비고`(lib/types/contract.ts:78-79 + read-daily.ts:218-224) · 시험 tests/types/lead-id-contract.test.ts.
- DB 기수 판정: `chooseWriteSource(cohort, dbEnabled())`(lib/service/daily-source.ts:31, 49, 63-68 — 8·9·연습·4·10·7·6·11·0, 아레나, 12기 이상).

## 3. 설계 결정 요약

- **D1 업체id 규칙(순수 함수 하나, `lib/util/company-id.ts`)**
  ```ts
  deriveContractCompanyId(c) =
    AK(linkedMeetingId).trim()                         // 실제 미팅 id 또는 manual:<요청키>
    || (AJ(이월원본행id).trim() ? `${AJ}@r${row}` : "") // prior:<uuid> / 02:<옛 행번호> + 행번호(이월 겹침 방지)
    || `r${row}|${계약일}|n${companyNameHash(업체명)}`   // AK·AJ 없는 레거시 — 이름은 8자리 해시로(길이 고정·로그에 이름 안 남김)
  companyIdOf(c) = c.업체id?.trim() || deriveContractCompanyId(c)
  ```
  `companyNameHash` = `업체명.trim().normalize("NFC")` 의 FNV-1a 32bit 16진 8자리(node:crypto 금지 — lib/util 은 import 0). 업체명은 번호에 그대로 들어가지 않는다. **Q1 수정:** 같은 미팅의 업체 ID만으로 이전 Todo를 자동 연결하지 않는다. 계약 회차와 복원 선택을 구분하는 설계를 PR-1/2 전에 확정한다(§0).
- **D2 저장·고정**: 새 계약 행을 처음 쓸 때만 payload 에 `업체id` 를 명시한다(지운 행 번호 재사용 시 옛 값 덮기). 기존 행 upsert 는 키를 생략한다(R11). 이름·계약일·AK 가 바뀌기 **직전** 에 「비어 있을 때만 쓰기」(set-if-absent)로 옛 값 기준 번호를 고정(freeze)한다. updated_at·mirror_pending 은 바꾸지 않는다.
- **D3 읽기 스키마는 관대하게**: 업체id·상태기록에 `.max()` 를 두지 않고 `.optional().catch(undefined)` 로 둔다. 이상한 값 하나 때문에 미팅·할 일이 safeParse 실패로 화면에서 사라지거나(read-daily.ts:46-54, 275-283) 계약 목록 전체가 시트 폴백으로 떨어지는(read-daily.ts:218 + service contract-payment.ts:76-82) 일을 막는다. 길이는 쓰는 쪽에서 묶는다(D1 해시, 상태기록 200건).
- **D4 할 일 매칭**: 할 일에 업체id 가 있으면 **번호로만** 찾는다(이름이 같은 남의 카드에 붙지 않게). 없으면 지금처럼 이름표(`계약일|업체명` 원형과 trim 형 둘 다)로 찾는다.
- **D5 06 업체정보 키는 그대로**(company-info-archive.ts:210-216 경고). 개명 뒤 새 키에 **내용을 다시 저장**한다. 원본 우선순위: 개명 직전 06(DB → 비었으면 시트) → 04(미팅 id) → 모두 비면 생략(지금처럼 시트 대체 읽기). contract-meeting-link.ts:157-166 선례.
- **D6 보관함**: 기존 키(`m:`·`c:`)와 겹치지 않는 새 이름공간을 primary 로 쓴다 — 계약이 있으면 `u:<업체id>`, 없으면 `l:<계보 root 미팅 id>`. primary 행이 **있으면(0건이어도) 그것만** 쓴다. 없으면 옛 서랍들을 복호화·중복 제거해 합쳐 보여 준다. 쓰기는 primary 에만, 옛 행은 건드리지 않는다. 개명·연결 직전에 primary 가 없으면 옛 값 기준으로 모아 primary 로 한 번 복사(seal-copy)한다. DB 기수만, 비DB 기수는 지금 방식.
- **D7 미팅 계보**: previousMeetingId 사슬. **삭제된 미팅 행도 포함**해 root 를 고정한다(root 가 지워져도 `l:` 키가 바뀌지 않게). 순환 입력에도 끝난다(db-sheet.ts:58-66 방식).
- **D8 상태기록**: `Meeting.상태기록` 은 서버 소유·DB JSONB 전용. patchMeetingRecord DB 경로에서 상태가 바뀌면 `{날짜(KST), 이전, 이후, 되돌림?}` 을 덧붙이고 최근 200건만 남긴다. 클라이언트가 보낸 값은 무시, 새 미팅은 빈 기록으로 시작.
- **D9 사유**: 되돌리기에서 지우지 않는다. 완료·취소 입력칸은 빈 칸. 새 줄은 `appendReason` 하나로 만든다(`10/12 · 사유`, `2회차 · 10/14 · 사유`).
- **D10 상담 로그**: 새 표 `db_sheet_contact_log`(append-only). 하루 1행 집계 원장(`db_sheet_contacts`)의 의미는 그대로. 로그 insert 는 SAVEPOINT 로 감싸 실패해도 상담 저장은 계속된다.
- **D11 순서**: 표(0009)만 담은 PR-6a 머지 → 자동 배포 → DB Migrate(installed) dry-run → execute → 확인 → 그 표를 쓰는 PR-6b. installed 모드는 master 에서만 돈다(.github/workflows/db-migrate.yml:72-75) — 코드와 표를 한 PR 에 넣으면 배포 직후 상담 저장이 막힌다(리뷰 blocker).
- **D12 시트 열 0개**: F 는 02·04·06·05 어디에도 열을 만들지 않는다. D 의 04 CE·06 BM 과 충돌 없음(12절).
- **D13 비DB 기수**: 업체id 는 파생만(저장·고정 없음), 상태기록·상담기록 없음, 보관함은 지금 방식. 할 일 이름표 이동(개명 때)은 DB·비DB 모두 한다.

## 4. 모든 PR 공통 규칙

- **착수 조건**: 15절에 belie 승인 기록. PR 은 1 → 2 → 3 → 4 → 5 → 6a → 6b **직렬**. 앞 PR 의 머지·배포·health 200·worklog 가 끝나야 다음 PR 머지(§3.5·§6.8). 구현은 병렬로 미리 해도 되지만 머지는 하나씩, 머지 전 최신 master 리베이스 + check.sh 재통과.
- **작업 폴더·브랜치**: 매 PR 최신 origin/master 에서 `C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/<slug>`(절대경로). 브랜치: PR-1 `chore/company-id-contract`(사용자 변화 0 — 커밋 `chore(types): …`, Changelog 없음, CLAUDE.md:72) · PR-2 `feat/company-id-lookup` · PR-3 `chore/company-id-backfill` · PR-4 `feat/vault-follows-company` · PR-5 `feat/meeting-status-history` · PR-6a `chore/db-sheet-contact-log-table` · PR-6b `feat/db-sheet-contact-log`. 문서만 고치는 PR 도 pre-commit 이 check.sh 를 돌리므로 `npm ci` 가 필요하다(build 는 생략, NOT_RUN 기록 — README §6). 머지·배포 뒤 **자기가 만든** 워크트리만 정리한다(README §5 「worktree 정리」 명령). 남의 worktree 는 건드리지 않는다.
- **게이트(매 PR)**: `& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh` 초록(typecheck · lint · structural — layers·sheets-request-path-guard·period-hardcode · test · doc-drift · 500줄. 맨 `bash`·`npm run check` 는 WSL 로 가므로 쓰지 않는다) → runtime 변경 PR 은 `npm run build` → UI PR 은 합성 실화면(375·1280px 스크린샷, 정확한 PR head) → PR → 작성자와 다른 검증자 PASS(같은 head, README §4 템플릿) → CI success → squash merge → `gh run list --workflow="Deploy to VPS" -L1` success → `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online` 200 → worklog 맨 위 항목 → 이 문서 15절 갱신. 실패 시 `git revert <squash-sha>` + push(force-push 금지).
- **운영 DB 쓰기(=belie 명시 승인 필요)**: PR-3 백필 execute, PR-6a DB Migrate execute, PR-6a/6b 지난 상담 기록 채우기(seed) execute. 순서는 항상 **dry-run → 건수만 worklog → belie 에게 「무엇을 · 몇 건 · 되돌리는 법」 3줄로 묻기 → 명시적 「진행」 → execute → 같은 dry-run 재실행이 0건**. 승인 없으면 그 운영 단계만 멈추고 다음 코드 PR 준비는 계속한다(단 PR-6b 머지는 0009 적용 확인 뒤에만).
- **운영 DB 쓰기 중단 규칙(백필·DB Migrate·seed 공통)** — 아래에 걸리면 그 단계는 멈추고, 다시 하려면 새 「진행」이 필요하다:
  1. **재실행이 0 이 아니다**: execute 뒤 같은 dry-run 이 0 이 아니면(백필 「부여 예정」·「할 일 부여 예정」, Migrate 「대기 중」, seed 「사본에서·원장에서」) **다시 execute 하지 않는다.** 원인(계획~실행 사이 새 행, 실행 일부 실패 등)을 조사해 건수와 함께 보고한다.
  2. **쓴 행 수가 계획과 다르다**: execute 가 출력한 실제 rowCount 합계가 바로 앞 dry-run 의 계획 건수와 다르면 멈춘다(적게 쓴 이유가 「앱이 그 사이 먼저 고정함」처럼 무해해 보여도 보고 후 판단).
  3. **예외 건수는 질문에 반드시 넣는다**: 겹쳐 건너뜀·모호·연결 못 찾은 할 일·헤더 정크·겹침 계약의 할 일이 0 보다 크거나, 「이미 있음」이 예상(PR-2 배포 뒤 새로 생긴 계약 수 정도)과 크게 다르면 그 건수와 뜻을 3줄 질문에 넣는다. 빼고 묻지 않는다.
  4. **시트 하나가 중간에 실패**: 시트마다 한 트랜잭션이라 실패한 시트는 롤백된 상태로 남는다(다른 시트는 이미 커밋). 그 상태 그대로 두고, 재시도는 같은 「진행」 범위 안에서 **1번만** — 재시도 전 dry-run 건수가 처음 계획의 남은 몫과 같을 때만 한다. 다시 실패하면 멈추고 보고한다.
  5. **위험 구간을 짧게**: PR-2 는 **belie 가 같은 날 PR-3 백필 「진행」에 답할 수 있을 때만** 머지한다. PR-3 은 PR-2 머지 전에 구현·검증·CI 까지 끝내 둔다(PR-2 배포 → PR-3 머지·배포 → dry-run → 질문 → execute 를 하루 안에). 답을 못 받을 날이면 PR-2 머지를 미룬다. PR-6a 는 앱이 표를 안 써서 위험 구간이 없다 — 머지는 언제든 되지만 PR-6b 는 0009 적용 확인 뒤에만.
- **데이터 보호**: §2 #5 bulk-write 가드 — F 의 모든 일괄 쓰기는 「키가 비어 있을 때만 추가」라 사용자 값을 덮지 않는다. 시트 셀 쓰기 0. 삭제(delete/drop) 없음. 로그·출력에 업체명·메모·전화·시트 id·비밀값 금지(건수와 행 키 `r12` 정도만). 테스트·fixture 는 합성 값만(`샘플 달빛공방`, `synthetic-sheet-a`).
- **R11**: 새 DB 전용 필드는 `.optional()`(필요하면 `.catch(undefined)`), `.default()` 금지, 빈 문자열을 payload 에 싣지 않는다.
- **lib/util 은 import 0**(tests/structural/period-hardcode.test.ts:88-101). `import type`·재수출도 걸린다 → util 함수는 로컬 구조 타입만 쓴다. util 끼리도 import 못 한다.
- **500줄 캡(lib·app·components 의 .ts/.tsx, scripts/check.sh:33-46)** — 지금 줄 수: `app/(app)/schedule/page.tsx` 500(늘리면 안 됨) · `app/(app)/schedule/_components/MeetingResultCard.tsx` 498 · `app/(app)/payment/_components/ContractRow.tsx` 494 · `lib/repo/company-info-archive.ts` 459 · `lib/repo/meetings.ts` 455 · `lib/repo/db/read-daily.ts` 422 · `lib/service/contract-payment.ts` 420 · `lib/service/contact.ts` 382 · `lib/repo/contract-payment.ts` 377. 넘치면 같은 PR 안에서 분리한다(분리 대상은 각 PR 에 적음).
- **요청 경로 시트 호출**: 새 repo 파일은 시트 저수준 호출 0(가드는 파일 단위 화이트리스트). 늘어나는 기존 시트 동기 호출은 각 PR 에 정직하게 적는다.
- **Changelog**(feat squash 본문, §6.5): PR-2·PR-4 는 `Changelog-Group: records-follow-renames`(PR-4 에 `Changelog-Done`), PR-5·PR-6b 는 단독. 문구는 각 PR 절에.
- **SSOT**: 새 Zod export → docs/domains/data-model.md, 새 컴포넌트 → docs/design/components.md(+ docs/design/preview.html 예시), 시트 좌표 변경 없음.

---

## 5. PR-1 공용 계약 — 타입 · ADR · SSOT (동작 변화 0)

**목표**: 새 필드와 규칙을 정의만 한다. D 가 같은 파일(lib/types/meeting.ts:101-104 이메일)을 고쳤으므로 기본은 D 머지 뒤 단독 PR 로 먼저 머지한다(§3.5 공용부). **D가 census로 보류되면 F PR-1부터 D 없이 진행한다. 이메일 유지 단언은 D가 나중에 rebase하면서 추가한다.**(README §4 「D 보류 규칙」과 같은 문장) 가지 `chore/company-id-contract`, 커밋 제목 `chore(types): add company id and history contracts`(Changelog 없음 — 사용자 변화 0).

**바꿀 곳**
| 파일 | 변경 |
|---|---|
| lib/types/contract.ts:85-86 아래 | `업체id: z.string().optional().catch(undefined)` — 주석: 「업체 고유번호. DB JSONB 전용(시트 열 없음). 처음 생길 때 정하고 바꾸지 않는다. default 금지(R11). 읽기는 관대(.catch).」 |
| lib/types/todo.ts:41-42 아래 | `업체id: z.string().optional().catch(undefined)` — 「서버가 붙인다. 있으면 이 번호로만 계약을 찾는다.」 |
| lib/types/meeting.ts:116 앞 | `export const MeetingStatusLogEntry = z.object({ 날짜: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), 이전: MeetingState, 이후: MeetingState, 되돌림: z.literal(true).optional() });` + type |
| lib/types/meeting.ts:162 아래 | `상태기록: z.array(MeetingStatusLogEntry).optional().catch(undefined)` — 「서버 소유·DB 전용. 읽기 상한 없음(상한 = 행 소실, :150-153 과 같은 이유). 쓰기에서 최근 200건만.」 |
| lib/types/company-vault.ts:35-39 | VaultTarget 에 `업체id: z.string().max(200).optional()`(API 입력용 — 저장 데이터 읽기 스키마가 아니므로 max 허용) |
| lib/types/db-sheet.ts | `export const DbSheetContactLogSource = z.enum(["contact","meeting","seed"])` · `export const DbSheetContactLogEntry = z.object({ id: z.string().uuid(), date: DbSheetDate, result: z.string(), note: z.string(), source: DbSheetContactLogSource, recordedAt: z.string() })` + type. result 는 enum 이 아닌 string(옛 값·향후 값에도 목록이 깨지지 않게) |
| docs/domains/data-model.md | :621 ContractPayment·:630 Todo·:611 Meeting 설명에 업체id/상태기록(DB 전용·R11·.catch) 추가, :68 VaultTarget 에 업체id·`u:`/`l:` 키, :754-756 근처에 `MeetingStatusLogEntry`·`DbSheetContactLogSource`·`DbSheetContactLogEntry` 행(doc-drift C 가 `export const X = z.` 를 검사 — scripts/doc-drift.sh:76-85) |
| docs/decisions/0035-company-id-and-history.md(신규, 번호는 머지 시점 빈 번호 — 지금 마지막은 0034) | D1~D13 요약: 업체id 정의·파생·불변·고정 시점, 06 키 유지 이유, 보관함 `u:`/`l:`, 상태기록·상담 로그, 0009 적용 순서, 되돌리기 방법, Q1·Q2 결정 |
| docs/plans/active/records-follow-renames.md | 이 문서(백업 커밋에서 `git checkout $bak --` 로 가져옴 — §0). 설명서 html 은 넣지 않는다(§0) |
| docs/worklog.md | 맨 위 항목 |

**시험(신규)** `tests/types/company-id-contract.test.ts`(lead-id-contract.test.ts 패턴):
- ContractPayment·Todo·Meeting 을 업체id/상태기록 없이 parse → 키 자체가 없다(`"업체id" in x === false`).
- 값이 있으면 보존, 숫자·객체 같은 이상한 값이면 `undefined` 로 떨어지고 **parse 는 성공**한다.
- `meetingFromDbPayload({...정상 미팅, 상태기록: [{날짜:"bad"}]})` 가 null 이 아니고 다른 필드가 그대로(letter 경로로 떨어지지 않음).
- `meetingToRow`·`cpToRow` 결과 어디에도 업체id·상태기록 값이 없다(시트 격리).
- 상태기록 600건짜리 payload 도 safeParse 성공(읽기 상한 없음).

**수용 기준**: 런타임 동작 변화 0 · check.sh(doc-drift 포함) 초록 · build PASS · 배포 success · health 200.
**되돌리기**: squash revert. 데이터 변화 없음.

---

## 6. PR-2 업체id 부여·고정 + 번호 우선 찾기(이름 폴백)

**목표**: 설명서 「지금」 1·2번(실무/수납 개명·계약일 수정)과 미팅 쪽 개명(보관함 제외)을 고친다. 수용 A1·A2·A4·A5·A6.

### 6-1. 순수 유틸

**`lib/util/company-id.ts`(신규, import 0)** — 파일 맨 위에 `// COMPANY-ID-SSOT: scripts/ops/backfill-company-id.mjs 에 같은 규칙의 사본(COMPANY-ID-SSOT-COPY)이 있다. 바꾸면 둘 다 고치고 tests/ops/backfill-company-id.test.ts 의 parity 시험을 돌린다.`
```ts
type ContractLike = { row?: number | null; 업체id?: string | null; linkedMeetingId?: string | null;
  이월원본행id?: string | null; 계약일: string; 업체명: string };
type TodoLike = { 업체id?: string | null; contractRef: string };

export function companyNameHash(name: string): string {        // FNV-1a 32bit
  const s = name.trim().normalize("NFC"); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
export function deriveContractCompanyId(c: ContractLike): string   // D1 그대로. row 없으면 0
export function companyIdOf(c: ContractLike): string                 // 저장값 우선
export function legacyContractRefs(c: { 계약일: string; 업체명: string }): string[]
  // 중복 제거 [`${계약일}|${업체명}`, `${계약일}|${업체명.trim()}`]
export function legacyRefsOfContractRef(ref: string): string[]
  // 첫 "|" 기준으로 나눠 [원형, `${날짜}|${이름.trim()}`] 중복 제거. "|" 없으면 [ref]
export function todoBelongsTo(t: TodoLike, companyId: string, refs: readonly string[]): boolean
  // t.업체id?.trim() ? t.업체id.trim() === companyId : refs.includes(t.contractRef)
export function todoJoinKey(t: TodoLike): string       // 번호 있으면 `id:${번호}`, 없으면 `ref:${contractRef}`
export function contractJoinKeys(c: ContractLike): string[]
  // 중복 제거 [`id:${companyIdOf(c)}`, ...legacyContractRefs(c).map(r => `ref:${r}`)]
export function contractForTodo<C extends ContractLike>(contracts: readonly C[]): (t: TodoLike) => C | undefined
  // byId(companyIdOf → 첫 계약), byRef(각 legacy ref → 첫 계약). 번호 있는 할 일은 byId 만
export function meetingLineage(links: readonly { id: string; previousMeetingId?: string | null }[], id: string):
  { root: string; ids: string[] }
  // 위로: previousMeetingId 를 따라 links 에 있는 동안, 방문 집합으로 순환 차단 → root.
  // 아래로: root 에서 자식(previousMeetingId === x) BFS, 방문 집합. id 가 links 에 없으면 { root: id, ids: [id] }.
```
**`lib/util/contract-link.ts`** 에 추가(isManualContractLink 와 같은 파일이라 import 불필요):
```ts
export function meetingContractResolver<C extends { linkedMeetingId?: string | null; 계약일: string; 업체명: string }>(
  rows: readonly C[]): (m: { id: string; 미팅날짜: string; 업체명: string }) => C | undefined
// 실제 AK 가 있는 계약은 AK 로만(byId), AK 가 빈 레거시 계약만 `계약일|업체명.trim()`(byKey). manual: 은 둘 다 제외.
```
**`lib/util/company-info-filled.ts`(신규, import 0)**: `hasCompanyInfoValue(ci: Record<string, unknown> | null | undefined): boolean` — lib/service/contract-payment.ts:184-196 `hasCompanyInfo` 를 옮긴다(contract-payment.ts 는 이걸 쓰게 바꾼다). company-rename.ts 가 contract-payment.ts 를 import 하면 순환이라 util 로 뺀다.

### 6-2. repo

| 파일:줄 | 변경 |
|---|---|
| lib/repo/db/read-daily.ts:218-224 contractFromDbPayload | parse 객체에 `업체id: typeof p.업체id === "string" && p.업체id.trim() ? p.업체id.trim() : undefined` |
| lib/repo/db/read-daily.ts:275-283 todoFromDbPayload | 열문자 경로(:280-282) 결과에도 같은 방식으로 `업체id` 를 얹는다(직접 경로 :276-279 는 스키마가 보존). 리뷰: 백필이 넣은 값이 열문자 할 일에서 안 보이는 문제 |
| **lib/repo/db/company-id.ts(신규, DB 전용·시트 호출 0)** | 아래 3함수 |
| lib/repo/contract-payment.ts:254-305 writeContractRow | 인자 `isNew: boolean` 추가(appendFromContract :243-246 기존 행 → false, :248-249 새 행 → true). 새 행이면 payload(:295-299)에 `업체id: deriveContractCompanyId({ row, linkedMeetingId: data.meetingId, 이월원본행id: carryover?.원본행id, 계약일: data.계약일, 업체명: data.업체명 })` 명시. 기존 행이면 키 생략 + `opts?.syncDb` 일 때 시트 쓰기 전에 `freezeRowCompanyId(spreadsheetId, row)`(안전망) |
| lib/repo/contract-payment-link.ts:22-32 clearRowByLink | 5번째 인자 `meetingId?: string` 추가 → `findRowByLink(spreadsheetId, { meetingId, 계약일, 업체명 })`. **opts(4번째)는 그대로** — 기존 시험의 `[3]` 단언이 유지된다 |
| lib/repo/contract-payment-link.ts:42-69 updateLinkFields | `opts?.syncDb` 이면 :48-53 로 행을 찾은 직후, 쓰기 전에 `await freezeRowCompanyId(spreadsheetId, row)`(안전망 — 서비스가 이미 고정했으면 읽기 1회로 끝) |
| lib/repo/contract-payment-link.ts:79-109 relinkContractRow | 같은 안전망(첫 줄, `opts?.syncDb` 일 때) — manual:… 번호가 미팅 id 로 바뀌기 전에 고정 |

`lib/repo/db/company-id.ts`:
```ts
/** r{row} 계약의 업체id 를 비어 있을 때만 적는다. 반환 = 지금 저장된 값(행 없음·_cleared → null).
 *  updated_at·mirror_pending 을 바꾸지 않는다(사용자 저장이 아니므로 readRowsUpdatedAt 비교를 흐리지 않게). */
export async function freezeContractCompanyId(spreadsheetId: string, row: number, value: string): Promise<string | null>
//  update sheet_rows set payload = payload || jsonb_build_object('업체id', $3::text)
//   where spreadsheet_id = $1 and tab = 'contracts' and row_key = $2
//     and coalesce(payload->>'업체id','') = '' and coalesce((payload->>'_cleared')::boolean,false) = false;
//  select payload->>'업체id' as id, coalesce((payload->>'_cleared')::boolean,false) as cleared ... row_key = $2

/** 지금 payload 로 번호를 계산해 고정. readContractRowPayload(contracts-clear.ts:140-154) → contractFromDbPayload → companyIdOf */
export async function freezeRowCompanyId(spreadsheetId: string, row: number): Promise<string | null>

/** 새 할 일에 붙일 번호. contractRef 가 빈 값(일반 이벤트)이면 undefined.
 *  readContractsFromDb → legacyContractRefs 가 contractRef 를 포함하는 계약들 →
 *  hint 가 있으면 그중 companyIdOf === hint 인 것이 정확히 1건일 때 채택, 아니면 ref 매칭이 정확히 1건일 때 채택 →
 *  freezeContractCompanyId 후 **실제 저장된 값** 반환. 0건·2건 이상·어떤 오류든 undefined(삼킴). */
export async function resolveTodoCompanyId(spreadsheetId: string, contractRef: string, hint?: string): Promise<string | undefined>
```
read-daily.ts 는 `../contract-payment`(rowToCP)을 import 하고, contract-payment-link.ts → db/company-id.ts → read-daily.ts 로 순환 import 가 생긴다. 함수 안에서만 쓰므로 런타임은 안전하다. 시험에서 모듈 초기화 문제가 보이면 read-daily.ts:27 을 `from "../contract-payment-row"` 로 바꿔 순환을 끊는다(rowToCP 의 실제 정의 위치, contract-payment.ts:377 재수출).

### 6-3. 고정(freeze) 지점 — 빠뜨리면 할 일이 어긋난다

| 경로 | 고정 시점 | 담당 |
|---|---|---|
| 실무/수납 「✎ 계약정보 수정」 업체명·계약일 | updateLinkFields 전 | `prepareCompanyRename` + updateLinkFields 안전망 |
| 일정·계약 계약 미팅의 날짜·업체명 수정 | updateLinkFields 전 | `prepareCompanyRename` + 안전망 |
| 「영업기록 없음」 업체 ↔ 미팅 연결 | relinkContractRow 전 | `prepareCompanyRename({row})` + relinkContractRow 안전망 |
| 미팅에서 계약(기존 행 재사용·날짜+이름 폴백으로 AK 가 처음 채워짐) | appendFromContract 전 | addFromContract(lib/service/contract-payment-add.ts:22-69): syncDb 이면 `:43` 앞에서 같은 규칙(AK=m.id 먼저, 아니면 manual 제외 날짜+이름)으로 DB 행을 찾아 `freezeRowCompanyId`(실패 무시 — append 는 throw 금지 경로) + writeContractRow 기존 행 안전망(syncDb 일 때만) |
| 새 할 일에 번호 붙이기 | attach 전 | `resolveTodoCompanyId` (고정 후 저장값) |
| 새 계약 행 | 처음 쓸 때 | writeContractRow(isNew) payload |
| 기존 행 전체 | 1회 | PR-3 백필 |

수임비 동기(syncFeeFromContract)·F:AH 편집(updateUserFields)·해지(writeTermination)는 번호 재료(AK·AJ·계약일·업체명)를 바꾸지 않아 고정이 필요 없다. **PR-2~PR-3 사이에는** AK·AJ·계약일을 바꾸는 운영 스크립트(scripts/backfill-contract-meeting-id.mjs, clear-carryover-flag 워크플로)를 돌리지 않는다 — PR-3 뒤에는 저장값이 우선이라 영향 없다.

### 6-4. 서비스

**`lib/service/company-rename.ts`(신규)** — 개명 전·후 공용 절차. 의존: repo(read-daily·company-id·company-info-archive·company-archive-sync), service(todos·meetings-write, PR-4 부터 company-vault). contract-payment.ts·contract-meeting-link.ts 를 import 하지 않는다(순환 금지).
```ts
/** 계약 행 찾기 — findRowByLink(contract-payment.ts:180-214)와 같은 규칙을 DB 에서: row 지정 → AK===meetingId(manual 포함) → manual 제외 (계약일, 업체명.trim()) 첫 행 */
export async function findLinkedContract(ctx: MeetingCtx, syncDb: boolean, key: { row?: number; meetingId?: string; 계약일?: string; 업체명?: string }): Promise<ContractPayment | null>
  // syncDb=false 면 null(비DB 는 시트가 정본 — 이 기능 범위 밖)

export interface RenamePrep { companyId?: string; row?: number; archive06: CompanyInfo | null; archive06InDb: boolean; failures: string[] }
/** 개명 직전에 부른다. ① 계약 찾기 → freezeRowCompanyId(번호 확보) ② 옛 06 내용 미리 읽기: readCompanyInfoFromDb(old) →
 *  값이 없으면 readCompanyInfoArchiveRow(old)(시트 동기 읽기 — DB 06 이 빈 경우만) ③ (PR-4) 보관함 seal-copy.
 *  syncDb=false 면 ①②③ 모두 건너뛴다(시트 rename 이 내용 보존). 어떤 단계 실패도 throw 하지 않고 failures 에 담는다. */
export async function prepareCompanyRename(email: string, ctx: MeetingCtx, input: { syncDb: boolean; row?: number; meetingId?: string; old: { 계약일: string; 업체명: string } }): Promise<RenamePrep>

/** 개명(02 성공) 직후. 반환 = failures. */
export async function followCompanyRename(email: string, ctx: MeetingCtx, input: {
  syncDb: boolean; prep: RenamePrep | null; old: { 계약일: string; 업체명: string }; next: { 계약일: string; 업체명: string };
  meetingId?: string; renamed?: { moved: boolean } | null; include06: boolean }): Promise<string[]>
```
followCompanyRename 알고리즘:
1. **할 일**(실패 → `"할일·History"`): `listTodos(email, ref, companyId)` 를 옛 원형 ref·trim ref 두 번 부르고 id 로 중복 제거(contract-meeting-link.ts:171-183 과 같은 2회 호출 — 기존 시험 mock 과 맞음). `newRef = companyContractRef(next.계약일, next.업체명)`. 각 할 일에 대해 `contractRef === newRef && 업체명 === next.업체명.trim() && (번호를 붙일 필요 없음)` 이면 **건너뛴다**. 아니면 `patchTodo(email, t.id, { contractRef: newRef, 업체명: next.업체명.trim(), ...(syncDb && companyId && !t.업체id ? { 업체id: companyId } : {}) })` 를 **순서대로**. 일괄 SQL 은 쓰지 않는다 — 할 일 시트 수렴이 행별(todos.ts:77-87)이라 시트 호출 수가 같고, patchTodo 의 삭제 가드·gcal reconcile 를 우회하게 된다. 이름표도 함께 고쳐 두므로 PR 을 되돌려도 지금 방식(이름표)으로 계속 보인다.
2. **06**(include06 && syncDb, 실패 → `"06 업체정보"`): 원본 = `prep.archive06` → 없고 `meetingIdFromLink(meetingId)` 가 있으면 `getMeetingRecord(ctx, id)?.업체정보` → 없으면 생략. `!renamed?.moved && prep.archive06InDb` 이면 옛 DB 키 정리 `persistCompanyArchiveRename(old → new)`(company-archive-sync.ts:129-145, contract-meeting-link.ts:157-164 와 같은 분기 — 시트에 옛 행이 아직 없을 때 06 에 키가 둘 남지 않게). 원본이 `hasCompanyInfoValue` 이면 `upsertCompanyInfoArchive(spreadsheetId, { 업체명: next.업체명, 계약일: next.계약일, 업체정보: 원본 }, { syncDb })`(:300-332, 시트는 큐로 수렴).

**lib/service/contract-payment.ts**
- `editContractLinkedFields`(:107-178): 이름·계약일이 바뀌면 맨 앞에서 `prep = await prepareCompanyRename(email, ctx, { syncDb, meetingId: input.meetingId, old: input.old })`, prep.failures 를 합친다. updateLinkFields(:126-131) 호출 형태는 그대로(시험 :136-141 유지). renameCompanyInfoKey(:167-172) 결과 `{moved}` 를 받아 두고, **02 가 성공했을 때만** `followCompanyRename(..., { include06: true, renamed, meetingId: input.meetingId })` 결과를 failures 에 합친다(02 실패면 할 일을 옮기지 않는다 — 이름이 엇갈리지 않게). edit-linked 요청 body 에 row 를 추가하지 않는다(spec 의 `body.row` 는 고정에만 쓰였고, 고정은 서버가 DB 에서 행을 찾아 한다).
- `loadCompanyInfoByContract`(:203-237): `data.meetingId?` 추가. 순서 = DB 06(:212-219) → 시트 06(:220-221) → **04 미팅 id**(`meetingIdFromLink` 인 경우만 `getMeetingRecord`, 실패 무시) → 04 날짜+이름(:222-235). 04(id) 를 시트 06 뒤에 두는 이유: 계약일만 고친 계약은 06 이 결제 화면 편집을 받았고 04 는 옛 값일 수 있다(리뷰 major — 옛 04 가 06 을 이기지 않게).
- `saveCompanyInfoByContract`(:243-259): `data.meetingId?` 추가. 실제 미팅 id 면 `getMeetingRecord(ctx, id)` 로 **있는지 먼저 확인**하고 있을 때만 `patchMeetingRecord(ctx, id, { 업체정보 })`(meetings-write.ts:179-182 의 throw 회피). 없거나 실패면 지금 날짜+이름 검색(:250-255). 06 저장(:257)은 그대로.
- `removeContractPaymentWithCascade`(:352-406): syncDb 이면 키를 DB 에서 먼저 읽는다 — `readContractRowPayload` + `contractFromDbPayload`(시트 C:D 는 DB-first 편집 뒤 잠깐 옛 값일 수 있음). 없거나 실패면 지금처럼 시트 `readContractCascadeKey`(:364). manual 판정(:370-372) 유지. 그다음 `meetingIdFromLink(linkId)` 가 있으면 `getMeetingRecord(ctx, linkId)` → **상태 '계약' 확인 유지** → 그 미팅을 되돌림. 못 찾으면 지금 날짜+이름(:381-384).
- `hasCompanyInfo`(:184-196) → `hasCompanyInfoValue` 사용.

**lib/service/contract-payment-add.ts** `addFromContract`(:22-69): 6-3 표의 append 전 고정만 추가(실패 무시).

**lib/service/contact.ts** `patchMeeting`(:313-359):
- 계약 해제(:327-328): `clearContractPaymentByLink(spreadsheetId, cur.미팅날짜, cur.업체명, { syncDb }, id)`.
- 링크 변경(:329-338): `linked = await findLinkedContract(ctx, syncDb, { meetingId: id }).catch(() => null)`. `oldKey = linked ? { 계약일: linked.계약일, 업체명: linked.업체명 } : { 계약일: cur.미팅날짜, 업체명: cur.업체명 }`. **실제로 바뀐 칸만** 다음 값에 반영: `next.계약일 = 미팅날짜가 바뀌었으면 partial.미팅날짜, 아니면 oldKey.계약일`, `next.업체명 = 업체명이 바뀌었으면 partial.업체명, 아니면 oldKey.업체명`(이름만 바꿔도 따로 고친 계약일이 미팅날짜로 되돌아가던 문제). 둘 다 안 바뀌었으면 아무것도 안 한다. 바뀌었으면 `prep` → `updateContractLink(spreadsheetId, { ...oldKey, meetingId: id }, next, { syncDb })`(throw 동작 유지) → `companyContractRef(oldKey) !== companyContractRef(next)` 이면 06 rename(조건을 「업체명 또는 날짜 변경」으로 넓힘, 실패 warn 유지).
- `patchMeetingRecord`(:342) 뒤 06 동기화 블록(:344-358): 계약 미팅이면 06 키를 **연결된 계약의 (계약일, 업체명)** 으로(방금 개명했으면 next, 아니면 findLinkedContract, 못 찾으면 지금처럼 미팅 값). 계약일을 따로 고친 계약의 미팅 카드에서 업체정보를 고치면 엉뚱한 06 키에 새 행이 생기던 반대 방향 문제.
- 개명했으면 마지막에 `followCompanyRename(..., { include06: partial.업체정보 === undefined, ... })` — 같은 요청에서 업체정보도 바꿨다면 위 동기화가 최신값을 이미 썼으므로 옛 내용으로 덮지 않는다. failures 는 console.warn(고객 데이터 없이 이름 목록만).
- contact.ts 382 → 약 415줄.

**lib/service/contact-cascade.ts**: `clearContractPaymentByLink` 4곳에 5번째 인자 — :33 `c.id`, :75 `id`, :121-126 `id`, :179 `child.id`.

**lib/service/contract-meeting-link.ts** `linkMeetingToContract`(:128-185): relinkContractRow(:143) 전에 `prep = await prepareCompanyRename(email, ctx, { syncDb, row: input.row, old: { 계약일: cp.계약일, 업체명: cp.업체명 } })` — 업체id 가 `manual:<키>` 로 고정된다. 06 블록(:151-169)은 그대로(사용자가 고른 합친 업체정보를 쓴다). 할 일 루프(:171-183)를 `failures.push(...await followCompanyRename(..., { include06: false }))` 로 바꾼다(실패 문구 `"할일·History"` 동일).

**lib/service/todos.ts**
- `listTodos(email, contractRef, companyId?)`(:154-168): DB 경로에서 companyId 가 있으면 `todoBelongsTo(t, companyId, legacyRefsOfContractRef(contractRef))`, **없으면 지금 그대로 `t.contractRef === contractRef`**(배포 직후 옛 화면·내부 호출 호환). 시트 경로(:167)는 그대로.
- `createTodo(email, input, opts)`(:238-311): `CreateTodoOptions` 에 `companyIdHint?: string`. DB 경로(:255, :271) 에서 parse 전에 `const 업체id = await resolveTodoCompanyId(ctx.spreadsheetId, input.contractRef, opts.companyIdHint)` → 있으면 Todo 에 넣는다. 시트 경로는 붙이지 않는다. `sameTodoBusiness`(:208-223)는 업체id 를 계속 비교하지 않는다(재시도 판정 불변).

### 6-5. API · 화면

| 파일:줄 | 변경 |
|---|---|
| app/api/todos/route.ts:41-59 GET | `업체id` 쿼리를 읽어 `listTodos(email, contractRef, 업체id || undefined)` |
| app/api/todos/route.ts:15-39 CreateBody · :61-85 POST | `업체id: z.string().max(200).optional()` 추가, `const { operationId, 업체id, ...input } = parsed.data` → `createTodo(email, input, { operationId, companyIdHint: 업체id })`. 클라이언트 값은 힌트일 뿐 서버가 검증(6-2 resolveTodoCompanyId) |
| app/api/todos/[id]/route.ts:16-31 PatchBody | **바꾸지 않는다** — 업체id 는 화면이 고칠 수 없다(zod 가 모르는 키를 버림) |
| lib/query/todos-hooks.ts:18-19, 40-53 | `todosKey(contractRef, companyId?) = ["todos", contractRef, companyId ?? ""]`, URL 에 `&업체id=`. 같은 이름표의 두 계약이 캐시를 같이 쓰지 않게(리뷰 major) |
| lib/query/todos-hooks.ts:64-79, 102-117 | `CreateTodoArgs.업체id?`. invalidate 는 `["todos", contractRef]` 접두로 그대로 동작 |
| lib/query/todos-hooks.ts:126-156 usePatchTodo | onMutate 를 `qc.getQueriesData({ queryKey: ["todos", contractRef] })` / `setQueriesData` 접두 일괄로, onError 는 스냅샷 전부 복구(지금은 정확 키 getQueryData — 키가 3칸이 되면 낙관적 갱신이 조용히 사라진다) |
| app/(app)/payment/_components/ContractRow.tsx:218-219, 480 | `const companyId = companyIdOf(cp)` 1줄 → `useTodosByContract(contractRef, companyId)`, ContractSlots 에 `companyId` prop. import 1줄. 494 → 약 497줄(넘치면 todos 조회 2줄을 작은 훅으로 분리) |
| app/(app)/payment/_components/ContractRow.tsx:141-144 | useContractCompanyInfo target 에 `meetingId: meetingIdFromLink(cp.linkedMeetingId)` |
| app/(app)/payment/_components/ContractRow.tsx:455 | CompanyInfoContractSection 에 `meetingId={meetingIdFromLink(cp.linkedMeetingId)}`(같은 줄) |
| ContractSlots.tsx:16,35,65,82,101 → PaymentSlotForm.tsx:86,112,289-292 → TodoSection.tsx:20,30,69 → TodoFormModal.tsx:21-29,46 | `companyId?: string` prop 을 contractRef 옆에 전달, TodoFormModal 의 mutateAsync 에 `업체id: companyId` |
| app/(app)/payment/_components/useContractCompanyInfo.ts:11-14, 59-63 | target 에 `meetingId?`, POST body 에 포함. 큐 키 `targetKey`(:33-34)는 그대로 |
| components/CompanyInfoContractSection.tsx:12-31, 59-61, 87-91 | props `meetingId?`, GET 에 `&meetingId=`(있을 때), POST body 에 meetingId. 보관함 target(:131)은 PR-4 |
| app/api/company-info/route.ts:16-31, 33-53 | GET 쿼리·POST body 의 `meetingId`(선택, string) 를 서비스로 |
| app/(app)/schedule/_components/SummaryBar.tsx:43-71 | `meetingContractResolver(rows)` 로 계약 수(해지 제외)와 수납 합계를 계산. 수납 합계는 이번 주 계약 미팅(`계약여부 && 구분 !== "이월"`)마다 찾은 계약을 **중복 없이** 모아 합산 |

### 6-6. 활동 조인(A 의 코드 — A 가 먼저 머지됐다는 전제, 12절)

| 파일:줄 | 변경 |
|---|---|
| lib/analytics/payment-work-status.ts:55-71 buildSlotActivityIndex | 색인 키를 `slotActivityKey(todoJoinKey(record), record.institutionRef)` 로 |
| 같은 파일(신규 export) | `slotActivityFor(index, cp, institution)`: `contractJoinKeys(cp)` 각각의 값을 모아 **todo = 가장 이른 날, history·done = 가장 늦은 날**로 합친다(키가 여러 개라도 한 번씩만 — raw==trim 이면 하나로 중복 제거됨) |
| 같은 파일:88-113 buildWorkStatusItems | todoKeys(:93) = `${todoJoinKey(t)}|${기관.trim()}`, hasTodo(:100) = `contractJoinKeys(cp).some(k => todoKeys.has(...))` |
| app/(app)/payment/_lib/institution-view.ts:84 | `slotActivityFor(dates, cp, storedInstitution)` |
| lib/analytics/dashboard-follow-ups.ts:84-112 buildTodoFollowUps | `byRef`(:85)·`byRef.get`(:94) → `contractForTodo(contracts)(todo)` |
| 같은 파일:187-208 buildStalledWork | openRefs(:191-197)를 todoJoinKey 기준으로, 계약 쪽(:201-204)은 `contractJoinKeys(cp)` 합집합, :208 은 `slotActivityFor(index, cp, data.진행기관)` |

**A 가 아직 master 에 없을 때(A 보류·지연 — README §3·§4)**: 위 표 대신 master 의 현재 위치에서 같은 규칙으로 바꾼다. origin/master `b51d04b8` 기준: 활동 색인은 `app/(app)/payment/_lib/institution-view.ts` 의 `activityKey`(:61)·`activityDates`(:66-80), 「할 일 있음」은 `lib/analytics/payment-work-status.ts:50-62` `buildWorkStatusItems`(:55 todoKeys, :62 hasTodo). `lib/analytics/dashboard-follow-ups.ts` 는 아직 없으므로 건너뛰고, A 가 나중에 rebase 할 때 `contractForTodo`·`contractJoinKeys`·`slotActivityFor` 를 쓰게 한다(A plan 인계 §4 에도 같은 메모). 개명 뒤 할 일 즉시 갱신용 무효화(A 의 `invalidateContractLinked` — `["todos"]`·`["month"]`, master 에는 없음)도 이 PR 이 `lib/query/contract-payment-hooks.ts` 에 넣는다(12절 A 행).

### 6-7. C 의 계약↔채널 키(C 가 먼저 머지됐다는 전제)

`contractChannelKey`(lib/util/contract-link.ts:35-44)를 `lib/util/company-id.ts` 로 옮기고 `${row}|id:${companyIdOf(c)}` 로 바꾼다(util 끼리 import 불가라 이동이 필요). import 경로 수정: lib/service/contract-channel.ts:14, components/dashboard/channel-profit.ts:15, tests/util/finance-period-channel.test.ts:11, tests/components/channel-profit.test.ts:4. 기대 문자열 수정: tests/util/finance-period-channel.test.ts:72-84, 합성 데이터의 키 재구현 tests/browser/dashboard-channel-profit-data.mjs:13-30. lib/types/dashboard.ts:53-57 주석, docs/domains/data-model.md:573·657 갱신. C 가 아직 안 머지됐으면 이 절을 건너뛰고, C 가 리베이스할 때 이 규칙을 쓴다(dashboard-channel-profit.md:33 「#1 이 생기면 이 함수만 바꾼다」).

### 6-8. 요청 경로 시트 호출(정직하게)

늘어나는 것: 미팅 날짜만 바꿔도 06 rename(renameCompanyInfoKey — 시트 findRowByRef + update 동기, company-info-archive.ts:420-459) · prepare 의 06 시트 읽기(DB 06 이 빈 경우만) · loadCompanyInfoByContract 의 04(id) 는 DB 읽기. 줄어드는 것: removeContractPaymentWithCascade 의 시트 C:D 읽기(DB 먼저). clearRowByLink·findRowByLink 의 시트 C:AK 읽기는 그대로. 새 repo 파일은 시트 호출 0 → sheets-request-path-guard 통과.

### 6-9. 시험

신규:
- `tests/util/company-id.test.ts` — 우선순위(AK 실제 id > manual: > AJ@r행 > r|날짜|해시), 저장값 우선, 해시 고정값(예: `companyNameHash("샘플 달빛공방")` 을 한 번 계산해 상수로 고정 — 규칙이 바뀌면 깨지게), 앞뒤 공백·NFD 입력이 같은 해시, legacyContractRefs·legacyRefsOfContractRef(원형·trim·`|` 없음), todoBelongsTo(번호 있는 할 일은 이름 무시), contractJoinKeys(raw==trim 이면 2개), contractForTodo, meetingLineage(root·자손·형제·순환 입력 종료·없는 id).
- `tests/util/contract-link-resolver.test.ts` — meetingContractResolver(AK 계약은 id 로만, 레거시만 날짜|이름, manual 제외, 계약일을 고친 AK 계약도 찾음).
- `tests/repo/contract-company-id.pglite.test.ts` — PGlite + `sheet_rows` 표(tests/repo/db-sheet.pglite.test.ts:16-18 처럼 직접 create): freeze 가 빈 행에만 쓰고 값이 있으면 no-op·같은 값 반환, `_cleared` 행은 null, updated_at·mirror_pending 불변, contractFromDbPayload 가 업체id 노출(빈 값·숫자는 undefined), todoFromDbPayload 열문자 경로 overlay, resolveTodoCompanyId(1건 채택·2건 미채택·힌트로 2건 중 1건·힌트 불일치는 ref 1건일 때만·오류 삼킴).
- `tests/service/company-rename.test.ts` — prepare 가 freeze 를 updateLinkFields 보다 먼저, 06 원본 우선순위(DB06 > 시트06 > 04(id) > 생략), moved:false && DB06 있음 → persistCompanyArchiveRename, 변경 없는 할 일 건너뜀, 번호 있는 할 일에 업체id 안 덮음, 실패가 failures 로.
- `tests/repo/contract-write-company-id.test.ts` — writeContractRow 새 행 payload 에 업체id 명시, 기존 행 payload 에 업체id 키 없음(R11), syncDb 기존 행이면 freeze 호출. (sheets-client·mirror mock — tests/repo/contract-append-idempotent.test.ts:76-95 패턴)

확장:
- tests/service/todos.test.ts — createTodo 번호 부착(1건)/미부착(2건)/힌트/조회 실패 삼킴, listTodos(새 이름표 + 번호) 가 옛 이름표의 번호 있는 할 일을 돌려줌, 번호 다른 할 일은 이름이 같아도 제외, 번호 없이 부르면 지금 동작.
- tests/components/payment-work-status.test.ts · payment-institution-view.test.ts · dashboard-follow-ups.test.ts — 개명 후(계약 이름·날짜 변경, 할 일은 옛 이름표+번호)에도 activityKind·hasTodo·D-day·멈춘 업체가 같음, 번호 있는 할 일과 레거시 할 일이 섞인 경우, raw==trim 에서 이중 합산 없음.
- tests/service/contract-payment-write-gate.test.ts — `vi.mock("@/service/company-rename")` 추가, editContractLinkedFields 가 prepare → updateLinkFields → follow 순서, 02 실패면 follow 안 부름, failures 합침, saveCompanyInfoByContract(meetingId 있으면 getMeetingRecord 확인 후 id 로 patch / 없으면 날짜 검색), loadCompanyInfoByContract 순서.

**깨지는 기존 시험(같은 PR 에서 의도에 맞게 고친다 — 약화 금지)**:
- tests/service/contact-contract-cascade-sync.test.ts:114 — `clearRowByLink` 기대 인자에 5번째 `"m1"` 추가. 파일에 `vi.mock("@/service/company-rename", ...)` 추가(안 하면 비DB 기수 시험이 실제 시트 클라이언트까지 간다). :133-141 은 그대로 통과해야 한다(연결 계약 없음 → 미팅 값).
- tests/service/contract-payment-standalone.test.ts:38-41 — meetings-write mock 에 `getMeetingRecord` 추가(:124-130 id 우선 경로), `vi.mock("@/service/company-rename")` 추가(:95-104 의 `failures === []` 유지).
- tests/service/contract-meeting-link.test.ts — `@/service/company-rename` 을 실제로 쓰되 `@/repo/db/company-id` mock 추가, patchTodo 기대값에 DB 기수면 `업체id: "manual:…"` 가 붙는지 확인. 할 일 2회 조회(:54 mock 의 listTodos) 유지.
- tests/service/todos.test.ts:46-49 · tests/service/todos-idempotency.test.ts:57-61 — read-daily mock 에 `readContractsFromDb` 가 없다 → `vi.mock("@/repo/db/company-id", () => ({ resolveTodoCompanyId: vi.fn(async () => undefined) }))` 추가.
- (C 머지 시) 6-7 의 시험.
- 확인 대상(깨질 수 있음): tests/repo/contract-append-idempotent.test.ts:85-89 와 tests/repo/contract-clear-by-link-sync.test.ts:22-31 은 `@/repo/db/contracts-clear` 를 mock 한다. 새 import(`readContractRowPayload` — db/company-id.ts 경유)가 syncDb 기존 행 경로에서 불리면 mock 에 없어 실패한다 → 그 경우 mock 에 추가하고, 새 행 payload 에 `업체id` 가 실리는지 단언 1개를 더한다.

**운영 확인**: 배포 후 공개 health 200. 실계정 쓰기는 에이전트가 하지 않는다. 화면 확인은 합성 fixture(tests/browser/dashboard-followups-server.mjs 의 실무/수납 도착 화면에 「개명된 계약 + 옛 이름표 할 일」 시나리오 `?companyRenamed=1` 추가 — `?renamed=1` 은 C 가 이미 쓰는 이름이라 피한다)로 375·1280px. 그 서버·fixture 가 master 에 없으면(README §3 「일부만 승인할 때」) 장면을 커밋하지 않고 README §5 임시 checkout 방식으로 찍거나, 그것도 안 되면 화면 확인은 NOT_RUN(이유)으로 남기고 6-9 시험으로 판정한다.

**수용 기준**: A1(실무/수납 개명·계약일 수정 뒤 할 일·History 목록, D-day, 업무현황·대시보드 분류 동일) · A2(계약일만 고친 계약의 업체정보 보임, 고치면 04 에도 반영 `meetingUpdated=true`) · A4(계약일 고친 계약에서 미팅 되돌리기·삭제 → 계약카드 지워짐, 계약카드 삭제 → 미팅 예약) · A5(일정·계약 상단 계약 수·수납 합계 동일) · A6(같은 미팅으로 재계약 → 예전 할 일 다시 붙음, 수동 업체 연결 뒤에도 번호 `manual:` 유지) · 미팅 이름만 바꿔도 계약일 그대로 · check.sh·build·배포·health.

**Changelog**: `Changelog: 업체명이나 계약일을 고쳐도 할 일과 지난 기록이 그 업체에 그대로 남아요.` / `전: 업체 이름이나 계약일을 고치면 그 업체의 Todo·History 가 빈 것처럼 보였어요.` / `후: 이름이나 날짜를 고쳐도 할 일·D-day·업체정보가 그대로 따라와요.` + `Changelog-Group: records-follow-renames`.

**되돌리기**: squash revert → 재배포 → health. 남는 데이터(계약·할 일 payload 의 업체id 키)는 읽는 코드가 없어 무해하고, 할 일 이름표도 새 이름으로 옮겨 두었으므로 옛 방식으로 계속 보인다.

---

## 7. PR-3 기존 업체에 번호 채우기(백필 dry-run → apply)

**목표**: PR-2 배포 전에 있던 계약 행 전부를 지금 값 기준으로 고정하고, 이름표로만 연결된 할 일에 번호를 붙인다. 이후 어떤 운영 스크립트가 AK·AJ·이름을 바꿔도 번호가 흔들리지 않는다. 수용 A7.

**새 파일**
- `scripts/ops/backfill-company-id.mjs` + `scripts/ops/backfill-company-id.d.mts`(시험 import 용 타입 — backfill-db-row-numbers.d.mts 선례). 형식은 scripts/ops/backfill-db-row-numbers.mjs 그대로: `.env` 에서 DATABASE_URL(로그 미출력), 순수 함수 export, `isMainModule` 가드, 기본 dry-run, `--execute` 로만 쓰기, `--rollback=<runId>`(기본 dry-run, `--execute` 와 함께일 때만 실제 제거).
- `.github/workflows/db-backfill-company-id.yml` — db-backfill-row-numbers.yml 복사. inputs: `execute`(boolean, 기본 false), `rollback_run_id`(string, 기본 빈 값). VPS `/opt/salespt-log` 에서 실행. **workflow_dispatch 는 기본 브랜치에 있어야 실행되므로 이 PR 머지 후에만 돌릴 수 있다.** `.github/` 는 공용부 — 이 PR 이 단독으로 머지되는 것으로 충분.
- `scripts/ops/company-history-audit.mjs` + `.github/workflows/db-audit.yml` 의 script 선택지에 `company-history-audit` 추가(:12-26 목록, :136 이 `node scripts/ops/${SCRIPT}.mjs` 로 실행). 읽기 전용 SELECT 만: 시트별 계약 행 수·업체id 있음/없음·같은 번호 겹침 수, 할 일 번호 있음/없음·번호가 어느 활성 계약과도 안 맞는 수. PR-6a 에서 표 점검을 덧붙인다.
- `tests/ops/backfill-company-id.test.ts`.

**계산(순수 함수 `planCompanyIdBackfill(contractRows, todoRows)` — 입력은 `{ spreadsheetId, row_key, payload }` 배열)**
1. 계약: tab=`contracts`, `_cleared` 제외, row_key `r{N}` 만. payload 에서 아래 **사본 규칙**으로 (row, 계약일, 업체명, AK, AJ, 저장된 업체id) 를 만든다. 의미 없는 행(C·D·E 모두 빈 값)·헤더 정크(`_backfill === true` && 계약일이 비지 않았는데 ISO 가 아님 — read-daily.ts:235-242)는 건너뛴다.
2. 저장값이 있으면 「이미 있음」. 없으면 `deriveContractCompanyId` 사본으로 후보.
3. 같은 시트 안에서 (이미 있음 ∪ 후보) 의 번호가 2번 이상 나오면 그 번호의 **후보는 전부 「겹쳐 건너뜀」**(기존 값은 손대지 않음). 아레나 이월 `02:<행>` 겹침 같은 경우를 추정하지 않는다.
4. 할 일: tab=`todos`, `_cleared` 제외, 저장된 업체id 없음, contractRef(필드명 `contractRef` 또는 열문자 `B`) 비지 않음, type(필드명 또는 `E`) ≠ `일반`. 같은 시트에서 `legacyContractRefs` 가 contractRef 를 포함하는 계약이 **정확히 1건이고 그 계약이 「부여 예정」 또는 「이미 있음」(겹침 아님)** 일 때만 「할 일 부여 예정」. 0건 = 「연결 못 찾은 할 일」(과거 개명 고아 — 되살릴 수 없음), 2건 이상 = 「모호」, 계약이 겹침 = 「겹침 계약의 할 일」.

**사본 규칙(`// COMPANY-ID-SSOT-COPY`)** — read-daily.ts:33-39(coerce)·:171-179(CP_FIELD_IDX)·:187-215 와 contract-payment-row.ts:9-30(serialToISODate, **로컬 시각** 기준 toISO)·:53-56(toStr)·:88-98(의미 있는 행)·:131-133(AJ·AK trim) 을 그대로 옮긴다:
- 열문자 C..AO(인덱스 2..40)를 `coerce` 해서 배열에 놓고, **CP_FIELD_IDX 순서대로**(…`구분`, `이월원본행id`, `원본행id`, `linkedMeetingId`, `meetingId`…) `undefined`/`null` 이 아닌 필드명 값으로 덮는다(뒤 키가 이긴다 — `meetingId` 가 `linkedMeetingId` 를, `원본행id` 가 `이월원본행id` 를 이긴다).
- 계약일 = serialToISODate(r[2]), 업체명 = toStr(r[3]), AJ = toStr(r[35]).trim(), AK = toStr(r[36]).trim().
- `companyNameHash`·`deriveContractCompanyId` 는 lib/util/company-id.ts 와 글자 그대로 같게.

**parity 시험(필수)**: 같은 fixture payload 들을 ① `contractFromDbPayload(p, n)` + `companyIdOf` 와 ② 스크립트의 사본으로 계산해 번호가 같다 — 필드명만 / 열문자만(C=`"46042"` 같은 문자열 직렬 날짜, AK·AJ 열문자) / 섞임 / `meetingId`·`linkedMeetingId` 둘 다 다른 값 / `원본행id`·`이월원본행id` / 빈 문자열 meetingId / 이름 앞뒤 공백 / AJ=`02:10` / manual:. 시험은 같은 프로세스 TZ 로 돌므로 serialToISODate 로컬 시각 규칙도 함께 묶인다.

**쓰기(--execute)** — 시트마다 한 트랜잭션, 계약 먼저:
```sql
-- 계약: 빈 칸에만, 표식 함께. updated_at·mirror_pending 미변경
update sheet_rows set payload = payload || jsonb_build_object('업체id', $3::text, '_업체id_src', $4::text)
 where spreadsheet_id = $1 and tab = 'contracts' and row_key = $2
   and coalesce(payload->>'업체id','') = '' and coalesce((payload->>'_cleared')::boolean,false) = false;
-- 할 일: 계획한 값이 아니라 **그 계약에 지금 저장된 값**을 복사(계획~실행 사이 앱이 다른 값으로 고정했어도 일치)
update sheet_rows t set payload = t.payload || jsonb_build_object('업체id', c.payload->>'업체id', '_업체id_src', $4::text)
  from sheet_rows c
 where t.spreadsheet_id = $1 and t.tab = 'todos' and t.row_key = $2
   and c.spreadsheet_id = $1 and c.tab = 'contracts' and c.row_key = $3
   and coalesce(c.payload->>'업체id','') <> '' and coalesce((c.payload->>'_cleared')::boolean,false) = false
   and coalesce(t.payload->>'업체id','') = '' and coalesce((t.payload->>'_cleared')::boolean,false) = false;
```
`$4` = runId `backfill-<UTC yyyymmddHHMM>`(출력). 동시 앱 쓰기와는 행 잠금으로 직렬화되고 서로 다른 키라 잃는 값이 없다. 시트 셀 쓰기 0.

**출력(dry-run·execute 공통)**: 시트마다 `sheet#<순번> cohort=<기수>: 부여 예정 a · 이미 있음 b · 겹쳐 건너뜀 c · 헤더 정크 d · 할 일 부여 예정 e · 연결 못 찾은 할 일 f · 모호 g · 겹침 계약의 할 일 h` 와 합계. 업체명·메모·시트 id 를 찍지 않는다(시험으로 고정). execute 는 실제 rowCount 합계.

**운영 순서**(중단 규칙 = 4절 1~5): PR-2 머지 전에 PR-3 을 CI·검증까지 끝내 두고, belie 가 그날 답할 수 있는지 확인한 뒤 PR-2 → PR-3 순서로 같은 날 머지한다. PR-3 머지 → 배포 success → `gh workflow run "DB Backfill (company id)" -f execute=false` → 로그 합계를 worklog 에 → belie 에게 「기존 업체 N곳에 번호를 채우고 할 일 M건을 번호로 묶어요 / 빈 칸에만 추가·시트 0건 / 되돌리기는 이번 실행분만 지우는 명령」 + **겹쳐 건너뜀 c · 모호 g · 연결 못 찾은 할 일 f · 헤더 정크 d 가 0 이 아니면 그 건수와 뜻**(4절 3) → 명시적 진행 → `-f execute=true` → 실제 rowCount 합계 = 계획 a+e 인지 확인(4절 2) → 같은 dry-run 재실행이 「부여 예정 0 · 할 일 부여 예정 0」(0 이 아니면 4절 1) → DB Audit `company-history-audit` 로 겹침 수 확인 → worklog.

**되돌리기**:
- 실행 직후(그 뒤 개명·할 일 부착이 생기기 전): `-f rollback_run_id=<runId> -f execute=false` 로 대상 건수 확인 → belie 승인 → `execute=true` — `update sheet_rows set payload = payload - '업체id' - '_업체id_src' where payload->>'_업체id_src' = $1`(계약·할 일 둘 다).
- 그 뒤에는 데이터 삭제로 되돌리지 않는다. 번호를 지우면 개명된 계약의 파생값이 새 이름으로 바뀌어 번호 있는 할 일이 떨어져 나간다. 대신 **코드 revert**(PR-2·PR-3) — 업체id 키는 읽는 코드가 없으면 무해하다.

**수용 기준**: A7 — dry-run 이 시트별 「부여 예정 / 이미 있음 / 번호 겹쳐 건너뜀 / 연결 못 찾은 할 일」 을 출력, execute 뒤 재실행 0건(멱등), 시트 쓰기 0, 기존 업체id 덮어쓰기 0, updated_at 불변(시험), 출력에 업체명·메모 0(시험). parity 시험 PASS. check.sh 초록.

---

## 8. PR-4 계정 보관함이 번호를 따라오게

**목표**: 설명서 1·2번의 보관함 문제(개명·계약일 수정·📅 변경 뒤 빈 것처럼 보임). 수용 A3.

### 8-1. 키

| 화면 | primary(새 이름공간) | 옛 서랍 후보(legacy, 순서대로·중복 제거·primary 제외) |
|---|---|---|
| 계약 카드(`target.업체id` 있음) | `u:<업체id>` | `target.meetingId` 가 실제 미팅이면 그 계보의 `l:<root>` · `m:<target.meetingId>` · 계보의 다른 `m:<id>` · `c:<계약일>|<업체명>` · 실제 미팅이 없으면 옛 코드 규칙(그 날짜·이름 미팅의 `m:`, company-vault.ts:52-58) |
| 미팅 카드(`target.meetingId` 만) | 계보에 연결된 계약이 있으면 `u:<companyIdOf>`, 없으면 `l:<root>` | `l:<root>`(primary 가 u: 일 때) · `m:<target>` · 계보의 다른 `m:<id>` · 고른 계약이 있으면 `c:<그 계약일>|<그 업체명>` |
| 계약일+업체명만 온 요청(배포 직후 옛 화면) | DB 에서 `legacyContractRefs` 로 활성 계약을 찾아 정확히 1건이면 계약 카드 규칙 | 못 찾으면 지금 단일 키(company-vault.ts:46-59) |
| 비DB 기수 | 지금 단일 키 그대로 | — |

미팅 카드의 계약 고르기(Q2 = 계약마다 따로): 계보 L(삭제 미팅 포함)에 `meetingIdFromLink(linkedMeetingId)` 가 속한 계약 중 ① 활성이고 링크 === 이 미팅 ② 활성 중 행 번호가 가장 큰 것 ③ 삭제된(`_cleared`) 계약 중 링크 === 이 미팅 ④ 삭제된 계약 중 행 번호가 가장 큰 것. 삭제 계약까지 보는 이유: Q1(지웠다가 다시 계약하면 같은 번호)이라 계약을 지운 동안에도 미팅 카드가 마지막 계약의 `u:` 를 보고, 옛 `l:` 에서 지운 비밀값이 다시 보이지 않게 한다. 지운 행 번호에 새 계약이 들어와 옛 payload 가 덮였으면 ③④ 를 못 찾고 `l:` 로 돌아간다(수용하는 한계).

### 8-2. 읽기·쓰기

- **읽기**: primary 행이 **있으면(0건이어도) 그것만**. 없으면 legacy 행을 모두 읽어 복호화(`openVault`, 서버 키 — PIN 은 화면 열림만 가른다) → `kind|label|id|secret|note` 로 중복 제거 → 앞 50개. 잠긴 상태의 `count` 도 복호화 후 중복 제거한 수(항목은 돌려주지 않음). 50 초과면 50개만 보이고 나머지는 옛 행에 남는다(지우지 않음, 경고 로그는 건수만).
- **쓰기**: primary 에만. legacy 행은 읽기 전용(비파괴).
- **실패 처리(fail-closed)**: 계보·계약 조회가 실패하면 읽기는 지금 단일 키로, 쓰기는 `VaultError(503)`(엉뚱한 서랍에 쓰지 않게).
- **개명·연결 직전 seal-copy**: `sealCompanyVaultForRename(email, { 업체id, linkedMeetingId, 계약일: 옛, 업체명: 옛 })` — DB 기수만. `u:<업체id>` 가 있으면 끝. 없으면 계약 카드 legacy 후보를 **옛 값으로** 계산 → 합쳐서 항목이 1개 이상이면 `u:` 에 `sealVault` 로 저장(최대 50, 넘으면 복사하지 않고 실패로 알림). 서버 안에서만 옮기며 화면에 항목을 내보내지 않는다. `prepareCompanyRename`(6-4) ③ 에서 부르고 실패는 `"계정 보관함"` failures.

### 8-3. 바꿀 곳

| 파일:줄 | 변경 |
|---|---|
| lib/repo/db/company-lineage.ts(신규, DB 전용) | `readMeetingLinks(spreadsheetId)` — `select row_key as id, coalesce(payload->>'previousMeetingId', payload->>'R') as prev, coalesce((payload->>'_cleared')::boolean,false) as cleared from sheet_rows where spreadsheet_id=$1 and tab='meetings'`(삭제 포함, 열문자 R 대응). `readContractLinkRows(spreadsheetId)` — contracts 전 행(삭제 포함) → `contractFromDbPayload` → `{ row, companyId: companyIdOf(cp), linkedMeetingId, cleared }` |
| lib/service/company-vault.ts:46-59 | `companyKeyOf` 는 지금 그대로 두고(단일 키 경로) `vaultKeysOf(owner, target): Promise<{ primary: string; legacy: string[] } \| { single: string }>` 추가 |
| lib/service/company-vault.ts:72-85 loadVault · :88-100 saveVault | 8-2 규칙. 136 → 약 230줄 |
| lib/service/company-vault.ts(신규 export) | `sealCompanyVaultForRename` |
| lib/service/company-rename.ts | prepare ③ 연결 |
| app/api/vault/route.ts:21-25 | `업체id: sp.get("업체id") ?? undefined`. PUT(:37)은 VaultTarget 이 이미 받음 |
| components/company-info/CompanyVaultSection.tsx:28-31 toQuery | `업체id`·`meetingId`·`계약일`·`업체명` 중 있는 값을 모두 직렬화 |
| components/CompanyInfoContractSection.tsx:131 | `vaultTarget={{ 업체id, meetingId, 계약일, 업체명 }}`(props `업체id?` 추가) |
| app/(app)/payment/_components/ContractRow.tsx:455 | `업체id={companyId}` 전달(같은 줄) |
| app/(app)/schedule/_components/MeetingResultCard.tsx:178 | 그대로(`{ meetingId }` — 서버가 계보를 푼다) |

요청 경로 시트 호출: DB 기수는 0(계보·계약 모두 DB). 비DB 기수는 지금과 같다.

### 8-4. 시험

- tests/service/company-vault.test.ts 확장·수정: 이 파일의 기수 `"12"`(:4)는 DB 기수라 새 규칙을 탄다 → `vi.mock("@/repo/db/company-lineage")`·`readContractsFromDb` mock 추가. **기대값이 바뀌는 기존 시험**: :35·:77 `m:meet-1` → 계약 없는 미팅 카드는 `l:meet-1`, :51-56 계약일+업체명 → 계약 1건을 mock 해 「u: 없으면 l:·m: 를 합쳐 보인다」로. 신규: u: 가 legacy 보다 우선 · primary 없으면 m:mtg-1·m:mtg-2 를 중복 없이 합침 · 저장은 u: 에만, legacy 행 불변 · **0건 primary 가 있으면 legacy 가 다시 안 나옴** · 미팅 카드가 계보로 계약을 찾아 같은 u: · 계약 없는 계보는 l:<root>(root 미팅이 삭제돼도 같은 키) · 삭제된 계약의 u: 를 미팅 카드가 봄 · 잠긴 count 는 중복 제거 수 · 조회 실패 시 읽기 단일 키·쓰기 503 · 비DB 기수는 지금 키 · seal-copy(u: 없을 때만, 옛 c: 키를 옛 값으로, 50 초과 거절).
- tests/service/company-rename.test.ts — prepare 가 seal-copy 를 rename 전에 부르고 실패를 `"계정 보관함"` 로.
- 실화면: 합성 fixture 로 계약 카드 개명 전후 보관함 항목 수 동일(375·1280).

**수용 기준**: A3 — 계약일·업체명을 고친 뒤 보관함 항목 수·내용 동일, 📅 변경으로 생긴 카드와 원래 카드가 같은 보관함, 보관함을 비워 저장하면 옛 항목이 다시 안 나타남. PIN·30분 열림·자동 저장 동작 불변.

**Changelog**: `Changelog: 업체 이름을 고치거나 일정을 바꿔도 계정 보관함 항목이 그대로 보여요.` / `전: 업체명이나 계약일을 고치거나 미팅을 다른 날로 옮기면 보관함이 빈 것처럼 보였어요.` / `후: 같은 업체의 카드라면 어디서 열어도 같은 보관함을 봐요.` + `Changelog-Group: records-follow-renames` + `Changelog-Done`.

**되돌리기**: revert → 옛 키 그대로 다시 보인다. 되돌린 동안 `u:`·`l:` 에만 저장한 항목은 안 보이지만 지워지지 않아 다시 적용하면 보인다(설명서 「위험과 되돌리는 법」과 같은 문구).

---

## 9. PR-5 미팅 「지난 기록」 + 사유 안 지우기

**목표**: 설명서 3번. 수용 A8·A9. 미팅 payload 키라 DDL 없음.

### 9-1. 서버

- **lib/util/meeting-reason.ts(신규, import 0)** `appendReason(prev: string, reason: string, todayISO: string): string` — reason trim 이 비면 prev(trim) 그대로. prev 가 비면 `${M}/${D} · ${reason}`. 아니면 `${prev}\n${prev.split("\n").length + 1}회차 · ${M}/${D} · ${reason}`(M·D 앞 0 없음). 옛 데이터 `사유\n2회차: x` 뒤에도 이어 붙는다.
- **lib/util/meeting-reason.ts** `nextStatusLog(prevState, nextState, prevLog, todayISO, keep = 200)` — 상태가 같으면 undefined. 다르면 `[...(prevLog ?? []), { 날짜, 이전, 이후, ...(이후 === "예약" && 이전 !== "예약" ? { 되돌림: true } : {}) }].slice(-keep)`. (구조 타입만 — util import 0)
- **lib/service/meetings-write.ts**
  - `createMeetingRecord`(:143-155): parse 전에 `상태기록` 을 뺀다(📅 변경·추가미팅이 `...original` 로 복사해 와도 새 카드는 빈 기록 — page.tsx:196-213, 280-298).
  - `patchMeetingRecord` DB 경로(:177-187): `partial.상태기록` 을 버리고 병합 → `nextStatusLog(base.상태, merged.상태, base.상태기록, todayKST())` 가 있으면 `merged.상태기록` 으로 넣어 저장. 비DB 경로(:188-190)는 기록하지 않는다(시트 열 없음). 264 → 약 280줄.
- **lib/repo/db/db-sheet.ts:114** registerDbSheetMeeting 의 `Meeting.parse({...raw, ...})` 에서도 `상태기록` 을 뺀다(방어).
- **lib/service/contact-cascade.ts** `revertMeeting`: :137-141 과 :148 의 `미팅사유: ""` 제거. 반환 문구 `"사유 초기화"`(:142) → `"사유는 지난 기록에 남김"`. 계약→예약(:115-120)·변경→예약 cascade(:145-149)는 그대로 — 상태기록은 patchMeetingRecord 가 남긴다. removeContractPaymentWithCascade 의 계약→예약(service contract-payment.ts:394-399)도 같은 경로라 「되돌림」으로 남는다.
- **lib/service/gcal-sync.ts:56-59** meetingToInput: 상태 `예약` 이면 description 은 `예약비고 || "세일즈PT 경영일지"` 만(지난 사유 제외). 그 외 상태는 지금처럼 `[미팅사유, 예약비고]`.

### 9-2. 화면

- **app/(app)/schedule/_components/MeetingHistoryNote.tsx(신규)** props `{ log?: MeetingStatusLogEntry[]; reason?: string; showReason: boolean }`. 기록 0건이고 보여 줄 사유도 없으면 `null`. `<details>` 기본 접힘, summary `지난 기록 {N}건`(`text-xs text-gray-500`). 펼치면 최신이 위로 `10월 14일 · 완료 → 예약 (되돌림)`. `showReason && reason` 이면 아래에 `사유:` + 사유(`whitespace-pre-wrap`). 로딩·에러 상태 없음(미팅 데이터에 포함). 새 CSS·임의값 금지(text-xs·text-px-11·text-gray-* 만).
- **MeetingResultCard.tsx**: :99-106 `accumulateReason` 을 `appendReason(meeting.미팅사유, r, todayKST())` 1줄로. :215 와 :217 사이(사유 박스 바로 아래, 예약 상태에서는 BasicEditDetails :281 보다 위)에 `<MeetingHistoryNote log={meeting.상태기록} reason={meeting.미팅사유} showReason={state === "reserved"} />` 1줄. DoneForm·CancelForm 의 `initialReason`(:251, :262, :346, :365)을 `""` 로. 되돌리기 확인 문구(:377-382): 계약 `계약 → 예약 (수임비/조건 초기화 + 계약카드 삭제)\n지난 기록은 남아요`, 완료 `완료 → 예약 (사유는 '지난 기록'에 남아요)`, 취소 `취소 → 예약 (사유는 '지난 기록'에 남아요)`. 498 → 약 494줄. 넘치면 ActionButton(:468-498)을 `ActionButton.tsx` 로 분리하고 components.md 에 등재.
- **app/(app)/schedule/page.tsx**(500줄 — 늘리면 안 됨): :219-228 누적을 `appendReason(original.미팅사유, reason, todayKST())` 1~2줄로, 두 newMeeting(:196-213, :280-298)에 `상태기록: undefined` 1줄씩. 순감소. import 는 기존 util import 줄에 합친다.
- docs/design/components.md(:1329 MeetingResultCard 근처)에 MeetingHistoryNote 등재, docs/design/preview.html 에 예시 1개.

### 9-3. 시험

- 신규 tests/util/meeting-reason.test.ts — 첫 줄 `10/12 · 사유`, 두 번째 `2회차 · 10/14 · 사유`, 빈 reason, 옛 `2회차:` 데이터 뒤 이어 쓰기, nextStatusLog(같은 상태 undefined, →예약 되돌림, 200건 자름).
- 확장 tests/service/meetings-write.test.ts — 상태 변경 시 `{날짜: todayKST, 이전, 이후}` 추가, →예약 `되돌림:true`, 클라이언트 상태기록 무시, createMeetingRecord 가 복사된 상태기록 제거, 상태 그대로면 추가 없음, 201번째에서 200 유지(fake timer 로 날짜 고정).
- 신규 tests/service/meeting-revert-history.test.ts — 완료/취소/변경→예약 후 `patchMeetingRecord` partial 에 `미팅사유` 키가 없음(사유 보존).
- **깨지는 기존 시험**: tests/service/gcal-sync.test.ts:62(`상태: "예약"` + `미팅사유: "재방문"` → `"재방문"` 기대) → `"세일즈PT 경영일지"` 로 바꾸고 `상태: "완료"` 면 `"재방문"` 케이스 추가.
- 신규 tests/components/meeting-history-note.test.ts(jsdom, channel-profit-breakdown.test.ts 패턴) — 기본 접힘, summary 건수, 최신순 문구, 예약일 때만 사유, 0건+사유 없음 → 렌더 없음. MeetingResultCard 의 완료·취소 입력칸이 빈 값으로 시작.
- 실화면 fixture 신규 `tests/browser/company-history-fixture.tsx` + `tests/browser/company-history-server.mjs`(student-dashboard-server.mjs:1-30 구조 — esbuild + tailwind + 빌드 폰트): 합성 미팅(상태 예약, 상태기록 [{2026-10-12 예약→완료}, {2026-10-14 완료→예약 되돌림}], 미팅사유 `10/12 · 샘플 달빛공방, 예산 부족`). 375·1280px 스크린샷.

**수용 기준**: A8(상태가 바뀔 때마다 KST 날짜와 이전→이후 한 줄, 되돌린 뒤에도 기록과 사유가 남고 「지난 기록 N건」 보임, 📅 변경 새 카드는 0건으로 시작) · A9(완료·취소 입력칸 빈 칸, 두 번째 저장은 `2회차 · 10/14 · …` 한 줄만, 되돌린 예약 미팅 캘린더 메모에 지난 사유 없음).

**Changelog**: `Changelog: 미팅 결과를 되돌려도 사유가 남고, 언제 어떻게 바뀌었는지 미팅 카드에서 볼 수 있어요.` / `전: 결과를 되돌리면 적어 둔 사유가 지워지고, 바뀐 날짜가 어디에도 남지 않았어요.` / `후: 미팅 카드의 「지난 기록」에 날짜와 이전 → 이후가 쌓이고 사유도 그대로 남아요.`

**되돌리기**: revert. 이미 쌓인 `상태기록` 키는 읽는 코드가 없어 무해하다. 되돌린 뒤의 되돌리기는 다시 사유를 지운다(지금 동작).

---

## 10. PR-6a 상담 기록 표 — 마이그레이션만 + 적용·확인 + 지난 기록 채우기

**목표**: 앱이 아직 쓰지 않는 새 표를 먼저 만든다. 배포돼도 동작 변화 0. 리뷰 blocker 해결. **앱 코드(lib·app·components) 0줄.**

### 10-1. 파일

- `lib/repo/db/migrations/0009_db_sheet_contact_log.sql`(번호는 머지 시점 빈 번호 — 지금 0001~0008, 0002 가 2개):
```sql
-- 0009: DB관리시트 상담 기록(표시 전용, append-only). 하루 1행 집계 원장 db_sheet_contacts 는 그대로 둔다.
create table public.db_sheet_contact_log (
 spreadsheet_id text not null, lead_id uuid not null, id uuid not null,
 contact_date date not null, result text not null, note text not null default '',
 source text not null check (source in ('contact','meeting','seed')),
 recorded_at timestamptz not null default now(),
 primary key (spreadsheet_id, id),
 foreign key (spreadsheet_id, lead_id) references public.db_sheet_leads (spreadsheet_id, id)
);
create index db_sheet_contact_log_lead on public.db_sheet_contact_log (spreadsheet_id, lead_id, contact_date desc, recorded_at desc);
revoke all on public.db_sheet_contact_log from public;
do $$ begin
 if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.db_sheet_contact_log from anon; end if;
 if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.db_sheet_contact_log from authenticated; end if;
end $$;
alter table public.db_sheet_contact_log enable row level security;
```
  id 는 앱이 만든다(node:crypto randomUUID — 확장 함수 의존 없음). 지난 기록 채우기(seed)는 이 SQL 에 넣지 않는다 — 건수를 먼저 보여 주고(dry-run) 승인받아 넣기 위해 별도 스크립트로 한다(설명서 「몇 건이 되살아날지는 모의 실행 때 확인」).
- 줄끝: 레포 기본 `* text=auto eol=lf`(.gitattributes:11)로 LF 저장 → VPS 체크섬도 LF. 0008 처럼 `-text` 고정(:31-33)은 필요 없다(Windows 에서 미리 적용한 적이 없으므로). 커밋 전 `git ls-files --eol lib/repo/db/migrations/0009*` 가 `i/lf w/lf` 인지 확인. **적용 후에는 이 파일을 절대 고치지 않는다**(scripts/db-migrate.mjs:83-100 체크섬 불일치 = 이후 모든 마이그레이션 실패). 바꿀 일이 있으면 0010.
- `scripts/ops/seed-db-sheet-contact-log.mjs` + `.d.mts` + `.github/workflows/db-seed-contact-log.yml`(db-backfill-row-numbers.yml 복사, input `execute`).
- `scripts/ops/company-history-audit.mjs` 에 표 점검 추가: 표 존재, `relrowsecurity`, `has_table_privilege('anon'/'authenticated', 'public.db_sheet_contact_log', 'select')` false(역할이 있을 때), 로그 행 수(시트별 건수만).
- 시험: tests/repo/db-sheet.pglite.test.ts:18 다음에 0009 exec. **깨지는 기존 단언** :118-119(`db_sheet_%` 표 4개) → 5개. 신규 단언: 표·인덱스 존재, RLS, 브라우저 역할 select 거부(:120-121 패턴). tests/ops/seed-db-sheet-contact-log.test.ts(순수 계획 함수).

### 10-2. 지난 기록 채우기(seed) 규칙 — 순수 함수 `planContactLogSeed(historyRows, contactRows, existingLog)`

- (b) **사본에서 꺼내기**: 같은 lead 의 `db_sheet_history` 를 revision 순으로 보며 `data.result` 가 직전 revision 과 **달라진** revision 만 쓴다. 근거: result 를 바꾸는 것은 상담 기록(saveDbSheetContact :106)과 미팅 예약(registerDbSheetMeeting :120)뿐이고, 일반 저장(save :83)은 `result: old.result` 를 유지한다 → 메모 입력 중 자동저장(use-db-sheet.ts:63-74, 500ms)이 만든 중간 revision 이 섞이지 않는다. 항목 = `{ date: data.contact.date, result: data.result, note: data.contact.note, recorded_at: history.recorded_at, source: (그 revision 에서 meetingId 가 null → 값이면 'meeting', 아니면 'seed') }`. date 가 ISO 가 아니면 건너뜀. 같은 결과를 같은 날 두 번 기록한 경우는 되살리지 못한다(한계).
- (a) **하루 1행 원장**: `db_sheet_contacts` 각 행 = `{ date: contact_date, result, note, source: 'seed', recorded_at: 그 lead 에서 data.contact.date === contact_date 인 마지막 history.recorded_at, 없으면 contact_date 00:00 KST }`.
- 중복 제거: (b) 먼저, 그다음 (a). 같은 (lead, date, result, note) 는 한 번만. **이미 로그에 같은 내용이 있으면 넣지 않는다**(라이브 로그와 겹쳐도 안전 — 6b 배포 뒤 재실행 가능).
- 쓰기: 시트마다 트랜잭션 + `select pg_advisory_xact_lock(hashtextextended('db-sheet:' || $1, 0))`(앱과 같은 잠금, db-sheet.ts:14) → `insert into db_sheet_contact_log(...) select ... where not exists (select 1 from db_sheet_contact_log l where l.spreadsheet_id=$1 and l.lead_id=$2 and l.contact_date=$3 and l.result=$4 and l.note=$5)`. 출력은 시트별 `사본에서 x · 원장에서 y · 이미 있음 z` 건수만.

### 10-3. 운영 순서(전부 belie 승인 필요 단계 포함 — 중단 규칙 = 4절 1~5)

1. PR-6a 머지 → Deploy success(앱이 표를 안 쓰므로 영향 없음) → health 200.
2. `gh workflow run "DB Migrate" -f execute=false -f mode=installed`(master) → 로그의 「대기 중:」 이 **정확히 `0009_db_sheet_contact_log.sql` 하나**인지 확인. 다른 파일이 보이면 멈추고 belie·총괄에게 올린다(그 파일 적용 여부를 모름).
   - **실행 앱과 migration 대상 DB 가 같은지**: installed 모드는 `compare_runtime` 을 쓸 수 없다(`.github/workflows/db-migrate.yml:75` 가 false 를 강제 — 그 비교는 0005·0006 정확 모드 전용). 0008 때는 실행 앱(PM2/Next)과 migration 연결의 대상·역할이 같다고 확인했다(`docs/qa/db-management-sheet.md:18`, 2026-10-11). 그 뒤 운영 DB 연결이 바뀐 기록(worklog·PR 의 `DATABASE_URL` Secret 교체 등)이 있으면 멈추고 보고한다. 최종 확인은 6b 배포 뒤 11-4 에서 동작으로 한다.
3. worklog 기록 → belie 에게 「DB 에 상담 기록용 빈 표 1개를 만들어요 / 기존 표·데이터 변화 없음 / 문제 시 앱은 이 표를 아직 안 써서 영향 없음」 + 「이어서 지난 상담 기록 채우기: dry-run 건수 N, 빈 표에 추가만, 6b 배포 직후 같은 명령 1회 재실행」을 함께 승인받는다. seed dry-run 은 표가 생긴 뒤에만 돌 수 있으므로 N 은 「적용 뒤 dry-run 으로 확인해 알려 드림」으로 묻고, 5번 뒤 실제 N 을 알린 다음 execute 한다.
4. `-f execute=true` → 성공 로그 → 같은 dry-run 이 「적용할 마이그레이션 없음」. 아니면 4절 1. execute 가 실패하면 바로 다시 누르지 않는다 — 재시도는 dry-run 대기 목록이 여전히 0009 하나일 때만 1번(4절 4).
5. DB Audit `company-history-audit` → 표·RLS·권한 회수 확인. 운영 /db-sheet 상담 저장이 그대로인지는 **belie 확인**(belie 가 원하면 본인 계정에서 상담 1건 저장 — 에이전트는 실계정 쓰기 금지). 못 하면 NOT_RUN(이유)으로 남긴다.
6. `gh workflow run "DB Seed (contact log)" -f execute=false` → 시트별 건수 worklog → belie 에게 실제 N 알림(3의 승인 범위 안인지 — 예상과 크게 다르면 새로 묻는다) → `execute=true` → 실제 넣은 행 수 = 계획 건수(4절 2) → 재실행 0건(4절 1).

**수용 기준**: DB Migrate dry-run 대기 목록 = 0009 하나 · execute 성공 · 재실행 「없음」 · 감사에서 표·RLS·권한 회수 확인 · 상담 저장 정상 · seed 재실행 0건 · check.sh 초록(PGlite 0009 시험 포함).

**되돌리기**: 앱이 표를 안 쓰므로 남겨 둬도 무해 — 기본은 그대로 둔다. 꼭 지워야 하면 새 마이그레이션 0010(`drop table`)을 belie 승인 후(비가역 삭제). seed 로 넣은 행만 빼야 하면 `delete ... where source in ('seed')` 역시 belie 승인 후(표시 전용 데이터).

---

## 11. PR-6b 상담 기록 남기기·보여 주기

**착수(머지) 조건**: 10-3 의 4·5 가 끝나 0009 가 운영 DB 에 있다는 확인. 수용 A10.

### 11-1. 서버

- **lib/repo/db/db-sheet.ts**
  - 헤더 주석(:1) `migration 0008` → `0008·0009`.
  - 내부 `appendContactLog(c, ctx, e: { leadId; date; result; note; source })`:
    ```ts
    await c.query("savepoint db_sheet_contact_log");
    try {
      // 이 lead 의 최신 로그와 (date, result, note) 가 같으면 건너뜀(연타 중복 방지)
      // select contact_date::text as date, result, note ... order by recorded_at desc, id desc limit 1
      // 다르면 insert(id = randomUUID())
      await c.query("release savepoint db_sheet_contact_log");
      return true;
    } catch {
      await c.query("rollback to savepoint db_sheet_contact_log").catch(() => {});
      return false;   // 표시용 기록 실패는 상담 저장을 막지 않는다. 고객 데이터 없이 실패만 계수
    }
    ```
  - `saveDbSheetContact`(:98-109): contacts upsert(:103-104) 뒤 `appendContactLog(c, ctx, { leadId, date: event.date, result: event.result, note: event.note, source: "contact" })`.
  - `registerDbSheetMeeting`(:110-129): contacts insert(:116-117) 뒤 `{ source: "meeting", result: "컨택진행", note: old.contact.note, date: meeting.예약일 }`. 이미 연결된 lead 의 재시도(:113)는 기록하지 않는다.
  - `listDbSheetContactLog(ctx, leadId, limit = 50): Promise<{ entries: DbSheetContactLogEntry[]; total: number }>` — guard, `spreadsheet_id = ctx.spreadsheetId` 조건(다른 시트 lead 면 빈 목록), 정렬 `contact_date desc, recorded_at desc, id desc`, total = count(*).
- **lib/service/db-sheet.ts** `loadDbSheetContactLog(ctx, leadId)` — `z.string().uuid().parse(leadId)`.
- **app/api/db-sheet/contact-log/route.ts(신규)** `GET ?lead=<uuid>` — app/api/db-sheet/route.ts:18-24 와 같은 인증·테넌트(`requireStudentViewContext` → `resolveDbSheetContext(view.email, view.sheetOverride)`), 실패 매핑은 :9-17 중 필요한 것(StudentViewContextError·ZodError/SyntaxError 400·DbSheetUnavailable 503·그 외 503, 고객 데이터 미노출)을 같은 문구로, `Cache-Control: no-store`, `runtime = "nodejs"`·`dynamic = "force-dynamic"`.

### 11-2. 화면

- **app/(app)/db-sheet/_components/DbContactLog.tsx(신규)** — react-query 키 `["db-sheet", "contact-log", leadId]`(use-db-sheet.ts:42 의 `["db-sheet"]` 무효화에 자동 포함 → 저장 직후 새로고침 없이 갱신). `<details className="db-previous-notes" open>`(ContactPanel.tsx:16 과 같은 class) summary `지난 상담 기록 {total}건`. 항목 1줄째 `10월 12일 · 재통화`(source=meeting 이면 `미팅 예약`), 2줄째 메모(`whitespace-pre-wrap`, 비면 회색 `메모 없음`). 최신 5건 + `지난 기록 N건 더 보기`/`접기` 제자리 토글(50건까지 받은 범위 안). 로딩 `지난 기록 불러오는 중…`, 0건이면 렌더 없음, 실패 `지난 기록을 불러오지 못했어요` + `다시 시도`(refetch). 새 CSS·Tailwind 임의값 금지(db-sheet.css 기존 class·text-xs·text-px-11·text-gray-*).
- **ContactPanel.tsx:35** ContactFields 의 상담메모 label 바로 뒤에 `<DbContactLog leadId={row.id} />`(PC 좌측 패널·모바일 오버레이 공용).
- docs/design/components.md(:1746 ContactPanel 근처) 등재, preview.html 예시.

### 11-3. 시험·하네스

- tests/repo/db-sheet.pglite.test.ts 확장(0009 는 6a 에서 이미 exec): 같은 날 두 번 contact → `db_sheet_contacts` 1행·contactProgress 1(:33-41 계속 통과)·로그 2행·메모 각각 · 같은 내용 연타 → 로그 1행 · registerDbSheetMeeting → source=meeting 1행(재시도는 추가 없음) · 다른 테넌트 격리 · **로그 표를 일부러 깨뜨려도**(예: 시험에서 `alter table ... rename` 후 저장) 상담 저장·집계 성공(SAVEPOINT 격리).
- 신규 tests/api/db-sheet-contact-log.test.ts — uuid 아님 400, 미인증·다른 계정 StudentViewContextError 매핑, 정상 시 최신순+total, DB 오류 503(본문에 고객 데이터 없음).
- 신규 tests/components/db-contact-log.test.ts — 로딩 문구, 0건 렌더 없음, 실패+다시 시도, 5건 초과 더 보기 토글, source=meeting 표기.
- **하네스가 0009 를 읽도록 수정**: tests/browser/db-sheet-live/server.mjs:25, tests/integration/db-sheet-postgres.mjs:174, tests/browser/db-sheet-supplier-server.mjs:37(E — E 가 master 에 있을 때만) — 0008 다음에 0009 exec.
- 실화면: company-history fixture 에 합성 lead + 합성 `/api/db-sheet/contact-log`(6건, 같은 날 2건) 추가, 375·1280px.

### 11-4. 운영

배포 → health 200 → 10-3 의 6번 seed dry-run 을 한 번 더(6a 실행~6b 배포 사이 공백) → 0이 아니면 같은 승인 범위로 execute(10-3 의 3번에서 미리 승인받은 계획된 1회라 4절 1 의 예외. 건수가 공백 기간 상담 수보다 크게 많으면 멈추고 묻는다) → 재실행 0(아니면 4절 1) → worklog.

**실행 앱 DB = migration DB 확인(6b 배포 뒤)**: 로그 insert 실패는 SAVEPOINT 가 삼키므로(11-1) 앱이 0009 가 없는 다른 DB 를 보고 있어도 상담 저장은 성공한다 — 그래서 아래 둘로 확인한다.
1. belie 가 /db-sheet 에서 seed 로 기록이 들어간 업체를 열어 상담메모 아래 「지난 상담 기록 N건」이 보이는지 본다. 「지난 기록을 불러오지 못했어요」가 뜨면 앱 쪽에 표가 없다는 신호다(GET 503) → 6b revert 를 검토하고 보고한다.
2. 실제 상담 기록이 1건이라도 생긴 뒤(belie 본인 저장 또는 평소 사용) DB Audit `company-history-audit` 의 로그 행 수(10-1 의 시트별 건수 합계)가 seed 직후 값보다 늘었는지 본다.
둘 다 못 하면 NOT_RUN(이유)으로 남긴다.

**수용 기준**: A10 — 같은 날 두 번 기록 → 상담메모 아래 두 줄, 그날 컨택진행 1건, 같은 내용 연타는 1줄만 증가, 다른 시트 lead 조회는 빈 목록 · 로그 실패 시에도 상담 저장 성공(시험) · A11(통합 타임라인·#5 화면 없음, 기록은 미팅 카드·상담메모 아래에만).

**Changelog**: `Changelog: DB관리시트에서 같은 날 여러 번 상담을 기록해도 모두 남아 「지난 상담 기록」에서 볼 수 있어요.` / `전: 같은 날 두 번 기록하면 앞 기록이 덮여 사라졌어요.` / `후: 상담메모 아래에 날짜·결과·메모가 한 줄씩 쌓여요. 컨택진행 숫자는 하루 1건 그대로예요.`

**되돌리기**: 6b 만 revert → 지금처럼 동작(표는 남아도 무해).

---

## 12. 다른 항목(A~E)과 겹침 · 머지 순서 · 열 소유

**권장 머지 순서**: belie 승인 → A~E 를 각자 plan 대로 분리 PR 로 먼저 머지(D 는 배포 전 census 필수 — D plan 「배포 전 확인」) → F PR-1 … PR-6b. F 를 먼저 하게 되면 아래 「겹침」의 반대 방향 작업을 A~E 쪽이 리베이스 때 한다. 승인 안 된 항목은 기다리지 않고 건너뛴다(README §3 「일부만 승인할 때」).
- **고정 선행 조건은 하나뿐이다: E 는 F PR-5 전에 머지한다**(PR-5 가 `lib/repo/db/db-sheet.ts:114` 를, 6a 가 `tests/repo/db-sheet.pglite.test.ts` 를, 6b 가 db-sheet.ts 를 고친다). E 가 승인되지 않았으면 이 조건은 없어진다.
- 나머지(D → PR-1, A·C → PR-2)는 기본 순서일 뿐이다. 늦어지면 아래 각 행의 「없을 때」대로 F 가 먼저 간다.

| 항목 | 겹치는 곳(ecf241c2) | 결정 |
|---|---|---|
| **D 이메일**(#11) | lib/types/meeting.ts:101-104(CompanyInfo.이메일)·:16-20 주석 / 04 CE·06 BM 미러(company-info-archive.ts:55-58, read-daily.ts:386-391) | **열 소유: 04 CE·06 BM 은 D 소유. F 는 시트 열을 하나도 만들지 않는다**(업체id·상태기록·상담기록 모두 DB 전용). D 의 「다른 트랙은 CF·BN 부터」(company-info-email.md:45-47)에 F 는 해당 없음 — D plan 의 「#1 트랙」 미확인 칸에 「F 는 시트 열 없음(records-follow-renames.md 12절)」이라고 적는다. 머지 순서: 기본 **D → F PR-1**(같은 types 파일, 다른 블록). **D가 census로 보류되면 F PR-1부터 D 없이 진행한다. 이메일 유지 단언은 D가 나중에 rebase하면서 추가한다.**(README §4 「D 보류 규칙」) F 의 06 재저장(6-4)은 CompanyInfo 전체를 싣으므로 D 이후엔 이메일도 함께 옮겨진다 — `tests/service/company-rename.test.ts` 에 이메일 값 유지 단언 1개: D 가 F PR-2 보다 먼저 머지됐으면 PR-2 가, 아니면 D 가 rebase 때 넣는다. |
| **C 채널별 남은 돈**(#7) | lib/util/contract-link.ts:35-44 contractChannelKey, lib/service/contract-channel.ts:19-41, termination-count.ts:51 | 기본 C 먼저 머지 → F PR-2 가 키를 `${행}|id:${companyIdOf}` 로 바꾼다(6-7). **C 가 없을 때**: 6-7 을 건너뛰고 C 가 rebase 때 이 규칙을 쓴다. contractMeetingResolver 의 날짜|이름 폴백은 C 소관으로 그대로(바꾸려면 C 후속 카드). |
| **A 오늘 챙길 일**(#3·#4) | lib/analytics/payment-work-status.ts:36-71(A 추가), institution-view.ts:84, dashboard-follow-ups.ts:55·85·94·191-208, lib/query/contract-payment-hooks.ts:42-49(invalidateContractLinked) | 기본 A 먼저 머지 → F PR-2 가 조인을 번호 우선으로(6-6). F 의 개명 후 할 일 즉시 갱신은 A 의 `invalidateContractLinked`(`["todos"]`·`["month"]`) 에 기댄다. **A 가 없을 때**: 6-6 의 「A 가 아직 master 에 없을 때」대로 master 위치에서 바꾸고, PR-2 가 같은 무효화 함수를 넣는다. A 의 #3 링크(`row·slot`)는 바꾸지 않는다. |
| **E 공급처별 보기**(#10) | lib/repo/db/db-sheet.ts(persist·projectMeeting·:114 registerDbSheetMeeting), lib/types/db-sheet.ts, tests/repo/db-sheet.pglite.test.ts, tests/browser/db-sheet-supplier-server.mjs:37 | **E 는 F PR-5 전에 머지**(PR-5·6a·6b 가 같은 파일·시험을 고친다). PR-1 과는 lib/types/db-sheet.ts 다른 줄만 겹쳐 나중 쪽이 rebase. E 의 하네스도 0009 를 읽게(11-3 — E 가 승인되지 않았으면 그 하네스 수정은 없다). |
| **B 한 줄 문장**(#8) | 없음 | — |
| **PR #1131**(세션 녹화 제외, 별도) | components/company-info/CompanyVaultSection.tsx — #1131 은 :229 `section` className(+주석 1줄), F PR-4 는 :28-31 `toQuery` | 다른 줄. 나중에 머지하는 쪽이 rebase 하고 check.sh 를 다시 돈다. #1131 은 belie 의 머지 지시가 있을 때만 머지한다. |

## 13. 리뷰 지적 18건 → 해결

| # | 심각도 | 지적 | 해결(이 문서) | PR |
|---|---|---|---|---|
| 1 | blocker | 0009 와 그 표를 쓰는 코드가 한 PR → 배포~적용 사이 상담 저장 실패 | 6a(표만) → DB Migrate → 확인 → 6b. 로그 insert 는 SAVEPOINT 로 실패 격리 | 6a·6b |
| 2 | major | 보관함 primary `m:<root>` 가 legacy 와 같은 이름공간 → 변경 카드 항목 영구 숨김 | primary 는 `u:`/`l:` 새 이름공간, legacy 에 `l:`·`m:` 들·`c:` | 4 |
| 3 | major | 개명 뒤 옛 `c:` 키를 못 찾음 | 개명·연결 직전 seal-copy(옛 값 기준) | 4 |
| 4 | major | freeze 지점 누락·무의미 | 6-3 표 — 서비스 prepare + repo 안전망(updateLinkFields·relinkContractRow·writeContractRow 기존 행) + addFromContract 전 + createTodo 고정 후 부착 + PR-3 백필 | 2·3 |
| 5 | major | createTodo 부착 규칙 미정·throw 위험 | 화면 힌트(서버 검증) → ref 1건 → 미부착, 모든 오류 삼킴, sameTodoBusiness 불변 | 2 |
| 6 | major | React Query 키 충돌 | `["todos", ref, 업체id]` + 접두 setQueriesData | 2 |
| 7 | major | 06 재저장에 옛 04 가 최신 06 을 덮음 | 원본 = 개명 직전 06(DB→시트) → 04(id) → 생략, 읽기 순서도 06 우선 | 2 |
| 8 | major | 미팅 기준 옛 키·계약일 덮어쓰기 | 옛 키 = 연결 계약의 현재 값, 바뀐 칸만 반영, 06 동기화 키도 계약 기준 | 2 |
| 9 | major | 백필↔런타임 파생 규칙 어긋남·열문자 할 일·겹침 계약의 할 일 | COMPANY-ID-SSOT-COPY + parity 시험, todoFromDbPayload overlay, 할 일은 부여 가능한 계약만·저장값 복사 SQL | 2·3 |
| 10 | major | 깨지는 기존 시험·하네스 누락 | 6-9·9-3·10-1·11-3 에 파일:줄로 명시 | 2·5·6a·6b |
| 11 | major | 읽기 스키마 상한 → 행 소실·목록 폴백 | 읽기 `.optional().catch(undefined)`·상한 없음, 쓰기 200건, 파생 번호는 이름 해시로 길이 고정 | 1·2·5 |
| 12 | minor | 조인 「id 먼저」 모호·이중 합산 | 계약별 키 집합 합치기(todo 최소·history 최대·hasTodo OR), raw==trim 중복 제거 | 2 |
| 13 | minor | 없는 미팅 id 로 patch → 500 | getMeetingRecord 로 확인 후에만 id patch, 아니면 날짜 검색 | 2 |
| 14 | minor | seed 가 사본을 버림·정렬·N건 | 사본(결과가 바뀐 revision)+원장에서 seed, (날짜 desc, 기록시각 desc), total 반환 | 6a·6b |
| 15 | minor | 「새 동기 Sheets 호출 0」 주장 틀림 | 6-8·8-3 에 늘고 주는 호출을 정직하게, 보관함 fail-closed | 2·4 |
| 16 | minor | 할 일 N회 patch·이미 맞는 할 일까지 재작성 | 변경 없는 할 일 건너뜀, 순차 patchTodo 유지(이유 6-4) | 2 |
| 17 | minor | ① 번호 없이 listTodos ② 상태 '계약' 확인 ③ moved:false 옛 DB 키 ④ 클라이언트 상태기록 복사 ⑤ A6 문구 | ① 지금 동작 ② 유지 ③ followCompanyRename 에서 정리 ④ page.tsx·createMeetingRecord·registerDbSheetMeeting 에서 제거 ⑤ Q1 을 「미팅에서 생긴 계약」으로 한정 | 2·5 |
| 18 | minor | lib/util import 0·롤백 SQL 안전성 | 로컬 구조 타입만, 롤백 SQL 은 실행 직후에만 — 이후는 코드 revert | 1·2·3 |

## 14. 남는 위험·한계(수용)

- 상태기록 동시성: patchMeetingRecord 는 전체 payload RMW 라 거의 동시에 두 번 바꾸면 한 줄이 빠질 수 있다(다른 필드도 같은 성질).
- 파생 번호(고정 전 레거시 행): PR-2~PR-3 사이에 6-3 표 밖의 경로로 AK·AJ·계약일·이름이 바뀌면 번호가 달라진다 → 그 사이 운영 스크립트 금지 + PR-3 를 PR-2 직후에.
- 과거(PR-2 이전) 개명으로 이름표가 끊긴 할 일은 되살리지 못한다 — 백필 「연결 못 찾은 할 일」 건수로만 보고.
- 같은 이름표의 활성 계약이 2개면 레거시 할 일(번호 없음)은 두 카드에 다 보인다(지금과 같음). 새 할 일은 화면 힌트로 정확히 붙는다.
- 보관함: 옛 서랍 합계가 50 초과면 50개만 보인다(나머지 보존). 지운 행 번호가 재사용돼 옛 계약 payload 가 덮이면 미팅 카드가 `l:` 로 돌아간다.
- 지난 상담 기록 seed: 같은 날 같은 결과를 두 번 기록했던 과거분은 되살리지 못한다. 실제 건수는 dry-run 전까지 모른다.
- 비DB 기수(1·2·3·5기)는 번호 저장·상태기록·상담기록·새 보관함 규칙이 없다(할 일 이름표 이동만 혜택).

## 15. 승인·진행 기록(실행하면서 채운다)

- belie 승인: (대기) — 승인 메시지 원문 요지·시각, Q1·Q2 답(또는 「권장안」).
- 승인 자료 버전: 아티팩트 https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG (version 1791746266-5ce4 확인 시점) · mockups/records-follow-renames.html @ ecf241c2.
- PR 마다 공통으로 적을 것: PR·head·merge SHA·CI·검증자 판정(PASS·대상 head·검증 세션의 실제 모델)·Deploy run·health.
- PR-1: (PR·head·merge SHA·CI·Deploy run·health)
- PR-2: (…)
- PR-3: (PR…) · 백필 dry-run 합계 · belie 승인 · runId · execute 결과 · 재실행 0
- PR-4: (…)
- PR-5: (…)
- PR-6a: (PR…) · DB Migrate dry-run 대기 목록 · belie 승인 · execute run · 감사 결과 · seed dry-run/execute 건수
- PR-6b: (PR…) · seed 재실행 건수
- 완료 시 이 문서를 docs/plans/completed/ 로 옮긴다.

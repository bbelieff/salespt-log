> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 [대표자] 「이메일」 한 칸(연락처 바로 아래) 추가 — 저장 좌표(04 CE · 06 BM)·메모 자동입력·검수 결함 반영·배포 전 확인을 한곳에 적은 작업 계획.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `lib/types/meeting.ts`(CompanyInfo.이메일) · `lib/repo/meetings-rows.ts`(COMPANY_FIELDS_EXT5) · `lib/repo/company-info-archive.ts` · `lib/repo/db/read-daily.ts` · `lib/document-ocr/parse-memo.ts` · `lib/util/contact-email.ts` · `components/company-info-defs.ts` · `components/company-info/CompanyInfoField.tsx` · `lib/service/company-info-txt.ts`
> - **읽고 나면 알 수 있는 것**: 이메일이 어디에 저장되고 개명·이월 뒤에도 왜 남는지 · 메모에서 비밀번호가 이메일 칸으로 새지 않게 막은 방법 · 배포 전에 무엇을 확인해야 하는지
> - **관련 문서**: [sheet-structure.md §3 확장5·§5-3 BM](../../domains/sheet-structure.md) · [data-model.md CompanyInfo](../../domains/data-model.md) · [components.md CompanyInfoField](../../design/components.md)

# 업체정보 [대표자] 이메일 (company-info-email, 2026-10-12)

## 승인 및 현재 실행 — 2026-10-13
- 승인: 사용자 「이메일 확장보기에 넣기」 및 「병렬로 작업가능한건 해서 빠르게 운영적용까지 가보자」. 이메일 1칸, 기존 연락처와 같은 녹화 정책 유지. #1131 취소 유지.
- 승인 자료: artifact `1791746266-5ce4`, 원본 목업 `ecf241c2`, 최신 수정 목업 plan. 구현 base `d4bc80a0`, 전용 `feat/company-email-release`.
- 추가 승인 범위(총괄): DB Audit의 registry-parity aggregate_only 옵션으로 대상 집합/불일치 수만 출력. PR ref 소스를 SSH stdin 실행, 운영 checkout 파일 불변, DB read-only 강제.
- 담당: email-release 제작. D 코드·검사·SSOT·plan만 수정; 직렬 병합/배포는 총괄. census exit 0 및 대상 누락 확인 전 머지 금지.

## 제작 검증 기록
- 초기 check: type/lint·구조 92 PASS, 단위 3,551 PASS/45 기존 SKIP. 기존 dashboard-motion 테스트의 React root 미정리로 teardown 뒤 window 접근(unhandled 1건), 전체 게이트 FAIL.
- 총괄 배정 확장으로 해당 테스트에 모든 mount의 afterEach unmount/DOM 정리만 추가. 앱 코드 불변, 기존 단언 유지. 정상 pre-commit 전체 check와 build를 재검한다.
- census 첫 실행: trainee 유니크 141, CE/BM 값 있는 셀 0, 다른 헤더 0, 열/탭 없음 134/136, 읽기 오류 12 → 보류. 몇 분 뒤 허용된 1회 재시도; HTTP 분류 건수만 출력.
- 추가 aggregate/read-only 시험 11 PASS, workflow YAML parse·PR 소스 stdin import smoke PASS. 최종 head CI/읽기 workflow/배포 여부는 PR과 총괄 기록이 정본.

## 범위
- **2026-10-13 결정:** 이메일은 **확장보기**에 둔다. 기존 목업 코드가 이미 이를 충족하며 기본↔확장 전환 시 값 보존·불필요한 저장 없음 시험을 추가했다. 목업 승인/구현 착수는 별도 기록, D census 통과 전 머지 금지는 유지한다.
- 포함: [대표자] 연락처 바로 아래 전폭 「이메일」 한 칸(belie 기본안 D). 자유 텍스트 — 모양이 틀려도 막지 않고 amber 안내만.
  업체정보생성(TXT)에 연락처 다음 줄. 미팅 메모 자동입력이 이메일 칸을 제안.
- 저장: DB payload(정본) + **시트 미러 04 CE · 06 BM**(확장5, `COMPANY_FIELDS_EXT5`). 04 폭 82→83, 06 폭 64→65,
  04 읽기 폴백 CE → CD → CC → BN → AS(한 단계씩, 읽기에서 grid 를 넓히지 않음).
- 제외: 기본보기(접힌 화면) 노출 — 연락처와 같은 기준으로 확장보기에만(아래 belie 질문). 이메일 발송 기능 없음.

## 검수 결함 반영 (2026-10-12)
1. **[major] 시트 미러 누락** — 처음 구현은 DB jsonb 에만 저장해 ① 계약 업체명 개명(새 키 DB 행은 키만 → 06 시트 대체 읽기)
   ② 아레나 이월(열문자 payload) ③ `DB_READ_COHORTS` 되돌림 때 이메일이 사라졌다. → EXT5 를 04 CE · 06 BM 에 미러:
   `meetings-rows.ts`(좌표·APOSTROPHE·buildCompanyInfo·meetingToRow·READ_WIDTHS 5단계), `meetings.ts`(헤더 라벨 AU1:CE1·split write AU:CE·clear),
   `company-info-archive.ts`(HEADER_LABELS·행 빌더·읽기 BM), `read-daily.ts`(BM 열문자 대체), `config`(A1:CE1/A2:CE · A1:BM1/A2:BM),
   이월(`carryover.ts`)은 MEETING_ROW_WIDTH 에서 자동으로 CE 포함. 폭 고정 테스트 8파일 갱신 + `tests/repo/company-info-email-io.test.ts`
   (개명 뒤 시트 대체 읽기에서 이메일 유지 = 수용 기준 #9, 이월 payload·아레나 시트 쓰기 CE, CD 까지만 넓힌 시트 읽기).
2. **[major] 메모의 비밀번호가 이메일 칸으로** — 계정 라벨 비교가 대소문자를 구분해 "이메일 id / pw" 를 놓쳤고 "로그인"·"계정"이 없었다.
   → 영문 계정 라벨은 대소문자 무시·단어 경계(`id`·`pw`·`password`·`login`), 「로그인」·「계정」·「패스워드」 추가.
   아이디·비번·로그인 라벨은 대표·연락처 분기보다 **먼저** 보관함(「대표 이메일 아이디/비번」이 대표자이름으로 가던 길도 막음).
   기관 이름만 있는 라벨(은행·홈택스…)은 원래 자리 — 「기존 은행 대출」은 기대출 칸 그대로.
   이메일 라벨 줄은 "@" 조각만 이메일 칸, 한글 없는 나머지 조각(비밀번호일 수 있음)은 보관함, 한글 메모는 버린다.
   모양이 틀린 이메일 후보는 `valid:false` → 비교표 기본 체크 없음. 공용 안내 문구 `INVALID_NOTE` 를 「형식이 맞지 않아 기본으로 안 넣어요」로
   (사업자등록번호와 공용 — "번호"는 이메일에서 틀린 말).
3. **[minor] 「010-… @카톡」** — 연락처 줄은 로컬부@도메인이 다 있는 조각이 있을 때만 이메일로 나눈다. 없으면 연락처 칸 그대로.
   라벨이 이메일도 말하면(「연락처/이메일」) "@" 조각은 모양이 틀려도 이메일 후보(`valid:false`, 기본 체크 없음).
4. **[minor] plan·워크로그** — 이 문서. 워크로그 항목은 커밋하는 총괄이 추가한다(아래 초안).

## 자율결정 · 근거 · 되돌리기
- **시트 미러를 이번 PR 에 포함**(DB 전용으로 두지 않음): 개명·이월·되돌림 3경로에서 값이 조용히 사라지는 건 사용자 데이터 손실이라
  belie 결정 사항이 아니라 버그로 판단. 되돌리기 = 이 PR revert(CE·BM 에 이미 쓰인 값은 남지만 코드가 읽지 않을 뿐, 다른 열 영향 없음).
- **비밀번호로 보이는 조각은 보관함**(버리지 않음): 보관함은 사용자가 체크해야 들어가는 제안이라 잘못 분류돼도 손실·노출이 없다.
- **INVALID_NOTE 문구 공용화**: 사업자등록번호 안내도 「형식이…」로 바뀐다(뜻 동일). 되돌리기 = 상수 한 줄.

## 배포 전 확인 (필수 — 실행 안 함)
- **라이브 시트 census(읽기 전용)**: `node scripts/ops/census-email-columns.mjs` — trainee 시트마다 04!CE2:CE · 06!BM2:BM 의 값 있는 셀 수만 출력
  (이름·시트 id·값은 출력 안 함). 합계 0 이면 배포, 1 이상·오류면 보류하고 belie 에게 올린다(§2.5 — 첫 저장이 그 열을 덮는다).
  머지 전에 헤더 규칙(아래 인계 §1 결함 3: CE1·BM1 이 빈 칸이거나 `이메일`이면 통과, 다른 글자면 보류)을 더한 판으로 돌리고, 대상 시트 수를 DB registry 와 대조한다(인계 §3-10).
  이 세션은 시트·네트워크 접근 금지라 **돌리지 않았다**(결과 미확인).
- **열 소유 규칙**: 04 CE · 06 BM 은 이 트랙(company-info-email) 소유. 같은 시기 04/06 에 확장 열을 붙이는 다른 트랙은 CF · BN 부터
  append 하고 `MEETING_READ_WIDTHS`·`ARCHIVE_ROW_WIDTH` 를 한 단계 더 늘린다. 두 PR 은 **직렬 머지** — 나중 PR 이 리베이스해 폭·폴백 테스트를
  고친다(같은 열을 두 트랙이 쓰면 서로의 값을 덮는다). 검수 메모의 「#1 트랙」이 가리키는 트랙이 따로 있으면 총괄이 여기 이름을 적는다(미확인).

## belie 질문 (결정 전까지 기본안으로 진행)
- **기본보기(접힌 화면)에도 이메일을 보일까요?**
  - 기본안(현재): 확장보기에만 — 연락처와 같은 기준. 적혀 있으면 「확장보기에 적힌 항목 N개」에 들어가 존재는 보인다.
  - 대안: 기본보기 [대표자] 줄에 추가 — 한눈에 보이지만 모바일 첫 화면이 한 줄 길어진다. 되돌리기 쉬움(배열 한 줄).
  - 미루면: 기본안 그대로 운영.

## 목업
- `node tests/browser/company-info-email-server.mjs` → 출력 주소. `?email=<값>` · `?empty=1` · `?view=all|filled|empty`. (Codex 셸에서는 README §5 「목업 서버」처럼 백그라운드로 띄운다 — 이 서버는 PORT 를 읽지 않고 자동 포트다)
  (C) 메모 예시에 「계정·비밀번호 섞인 줄」 추가 — 비밀번호가 칸으로 가지 않고 보관함 후보 수만 늘어나는지 본다.

## 수용 기준
- [x] 연락처 바로 아래 전폭 한 칸, 모양 오류는 amber 안내만(저장 막지 않음).
- [x] TXT 연락처 다음 줄, 비면 줄 없음.
- [x] 04 CE · 06 BM 미러, 읽기 폴백 5단계, 옛 폭 행은 "".
- [x] 계약 업체명 개명 뒤에도 이메일 유지(시트 대체 읽기) — `company-info-email-io.test.ts` ④.
- [x] 아레나 이월(DB 열문자 payload·시트 쓰기)에 이메일 포함 — 같은 테스트 ⑤.
- [x] 메모: 계정 라벨(대소문자 무시)·이메일 줄의 비밀번호는 칸·leftover 에 없음, 모양 오류 후보는 기본 체크 없음, 「@카톡」은 연락처.
- [ ] 배포 전 census 0 확인(위).
- [ ] check.sh 초록(총괄이 커밋 시).

## 워크로그 초안 (총괄이 커밋 때 docs/worklog.md 맨 위에)
```
### 2026-10-12 · 업체정보 [대표자] 이메일 칸 (company-info-email)
- 한 것: 연락처 아래 이메일 칸 · TXT · 메모 자동입력. 저장 04 CE · 06 BM 미러(확장5, 폭 83/65, 읽기 폴백 CE→AS).
- 검수 반영: 시트 미러 누락(개명·이월·되돌림 손실) 수정 · 메모 계정 라벨 대소문자/로그인/계정 · 이메일 줄 비밀번호 보관함 · @카톡.
- 배포 전: scripts/ops/census-email-columns.mjs (읽기 전용) 0 확인 필요 — 미실행.
- 되돌리기: PR revert.
```

## Codex 인계 — 승인 후 할 일 (2026-10-12)

> 이 절만 읽고 이어 가면 된다. 근거는 가지 `feat/dashboard-followups` head `ecf241c2`(base `origin/master` `b51d04b8`)를 직접 열어 본 결과다.
> 이 절을 쓴 세션(Claude Opus 5.5 하위 에이전트)은 커밋·푸시·네트워크·시트 접근을 하지 않았다.
> ⚠️ **이 절은 커밋 `ecf241c2` 에는 없다.** 인계 README §2 의 백업 커밋(`[handoff-backup]`)에 들어 있다. 이 plan 은 `git checkout $bak -- docs/plans/active/company-info-email.md` 로 가져온다(`$bak` 찾기 = README §2). `git checkout ecf241c2 -- 이 파일` 이나 가지 이름으로 가져오면 안 된다. 코드 파일은 SHA `ecf241c2` 에서 가져온다. 명령은 PowerShell 기준(README §5).

### 1. 지금 상태 — 실제 코드와 목업
- **실제 코드**: 목업이 곧 구현이고, 남은 연결 작업이 없다. 승인되면 그대로 PR 로 낸다. 새 API·DB 마이그레이션은 없다(jsonb).
  - 스키마: `lib/types/meeting.ts:104` `이메일: z.string().default("")`. 형식을 막는 검증은 없다.
  - 정리·모양 검사: `lib/util/contact-email.ts` 의 `tidyContactEmail`·`looksLikeContactEmail`(import 0).
  - 화면
    - `components/company-info-defs.ts:114`: 확장보기 [대표자] 연락처 묶음 다음, 전폭(span 2).
    - `components/company-info/CompanyInfoField.tsx:84-95,122-129,138-142`: 칸을 벗어날 때 값 정리, 입력칸 속성, 포커스가 없을 때만 amber 안내(`EMAIL_SHAPE_MSG` :36).
  - TXT: `lib/service/company-info-txt.ts:30`.
  - 메모 자동입력
    - `lib/document-ocr/parse-memo.ts:226-234`: 이메일 분기가 대표·사업장·연락처 분기보다 먼저 온다. 계정 라벨은 :235 에서 보관함으로 보낸다.
    - `lib/document-ocr/diff.ts:57,67`: 공용 문구 `INVALID_NOTE`. `valid:false` 면 기본 체크를 끈다.
    - 안내문: `components/company-doc/CompanyDocAutofillDialog.tsx:35`.
  - 시트 미러(04 CE · 06 BM)
    - `lib/repo/meetings-rows.ts`: :133-149 확장5 정의·폭 83·읽기 폴백 CE→CD→CC→BN→AS, :178 apostrophe, :233 읽기, :305 쓰기.
    - `lib/repo/meetings.ts:62-66`: AU:CE 쓰기·지우기, 헤더는 빈 셀에만 보강.
    - `lib/repo/company-info-archive.ts:55,58-59,94,369`: 06 폭 65, BM 쓰기·읽기.
    - `lib/repo/db/read-daily.ts:387`: DB 열문자 `BM` 대체.
    - `lib/config/index.ts:193,201,212-213`: `A1:CE1`·`A2:CE`·`A1:BM1`·`A2:BM`.
    - 이월(`lib/repo/carryover.ts`)은 `MEETING_ROW_WIDTH` 에서 자동으로 따라온다. 바뀐 건 주석뿐이다.
  - 주석만 바꾼 파일
    - `components/CompanyInfoEditor.tsx:2`: 495줄이라 로직 추가 금지.
    - `lib/repo/gcal-schedule-read.ts:18` · `lib/repo/gcal-event-ids.ts:26` · `lib/repo/db/company-archive-sync.ts`.
  - 배포 전 census: `scripts/ops/census-email-columns.mjs`. READ-ONLY 이고 숫자만 출력한다. 종료코드 0 = 배포 가능, 2 = 보류, 1 = 자격 누락.
- **목업 전용(합성 데이터)**
  - `tests/browser/company-info-email-server.mjs` + `company-info-email-fixture.tsx`: example.com 만 쓰고 fetch 는 0건이다.
  - 승인 페이지: https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG 04장(버전 `1791746266-5ce4`).
- **검사 결과(2026-10-12 이 세션에서 다시 실행)**
  - 통과: D 관련 vitest 16파일 165개 · `tests/structural` 15파일 92개 · `npm run typecheck` 오류 0 · `scripts/doc-drift.sh` PASS.
  - **NOT_RUN**: `scripts/check.sh` 전체(lint·500줄 검사 포함) · `npm run build` · census · PR·CI·배포.
- **코드와 대조해 찾은 남은 결함** — 승인 결과와 무관하게 고친다.
  1. `docs/design/components.md:1426` CompanyInfoEditor 행이 「AU~CD + 이메일 … **지금은 DB payload 전용·시트 열 미정**」이라고 적혀 있어 코드와 다르다. 실제로는 04 CE · 06 BM 에 미러한다.
     → 「AU~CE, 60필드 … 04 CE · 06 BM 미러」로 고친다.
  2. `docs/domains/data-model.md:611` `Meeting` 행의 「AU~CC」(옛 표기) → 「AU~CE」.
  3. census 가 데이터 행만 센다(`scripts/ops/census-email-columns.mjs:43-46` `CE2:CE`·`BM2:BM`). 검수 지시는 헤더를 포함한 `CE1:CE`·`BM1:BM` 이었다.
     - 헤더 보강은 빈 셀에만 필드 키를 쓰므로 덮어쓰지는 않는다(`lib/repo/meetings.ts:104`, 06 은 `company-info-archive.ts:52-56` `HEADER_LABELS`).
     - 하지만 수강생이 CE1 에 다른 제목을 붙여 둔 열이라면 그 제목 밑에 이메일이 쌓인다.
     - → **고칠 규칙(정확히 이것)**:
       - 범위를 `CE1:CE`·`BM1:BM` 으로 읽어 첫 행 = 헤더, 2행부터 = 데이터로 나눈다.
       - **헤더 CE1·BM1 이 빈 칸(공백만 포함)이거나 정확히 `이메일`(trim 후 — 앱이 쓰는 필드 키 `COMPANY_FIELDS_EXT5`, `lib/repo/meetings-rows.ts:133`)이면 통과. 다른 글자가 있으면 그 시트는 보류(exit 2).**
       - 이유: 배포 전에는 앱이 아직 CE1·BM1 을 쓴 적이 없어 거의 모든 시트에서 빈 칸이다. 「비었으면 보류」로 읽으면 census 가 늘 exit 2 가 되어 D 를 영원히 머지할 수 없다.
       - 데이터(2행부터)는 지금처럼 값 있는 셀이 1개라도 있으면 보류.
       - 2칸안(칸-2)이면 CF1·BN1 도 같은 규칙으로 센다(통과 글자 = 새 필드 키 `세금계산서이메일`).
       - 출력은 숫자만: 요약에 「헤더 다름 시트 N」을 더한다. 헤더 글자 자체는 찍지 않는다. 판정은 `blocked = 데이터 값 있음 > 0 || 헤더 다름 > 0 || 오류 > 0`.
       - 시험: 판정 부분을 순수 함수(예: `headerVerdict(cell, expectedKey)` → `"ok" | "blocked"`)로 export 하고, import 해도 실행되지 않게 `isMainModule` 가드를 둔다(`scripts/ops/backfill-db-row-numbers.mjs:125-127` 선례). 새 `tests/ops/census-email-columns.test.ts` 에 ① 빈 칸(`""`·`"  "`) 통과 ② `"이메일"`(앞뒤 공백 포함) 통과 ③ 다른 글자(`"메모"`) 보류 ④ 데이터 셀 1개 보류 — 4경우를 넣는다(`vitest.config.ts` 의 `tests/**/*.test.ts` 에 잡힌다).
       - 읽기 전용(`spreadsheets.readonly`)은 그대로다.
- `docs/plans/active/pluuug-handoff/specs/*.json` 은 git 이 무시하는 파일이다(`git status --ignored` 에 `!!`). PR 에 들어가지 않으므로 정본은 이 plan 이다.
- 위 「열 소유 규칙」이 미확인으로 남긴 「#1 트랙」은 **F(업체 고유번호 + 변경 기록)** 다.
  - F 스펙은 `lib/types/meeting.ts` 에 `Meeting.상태기록` 을 추가한다(같은 파일, 다른 블록). 04·06 에 새 열은 없다.
  - 그래서 열이 겹치지는 않고, 파일 단위 **직렬 머지**만 지키면 된다(D 먼저).

### 2. belie 결정 연결 (답이 없으면 기본안 — 코드 변경 없음)
| 결정 | 기본안(현재 코드) | 기본안이 아니면 |
|---|---|---|
| ⑤ 기본보기에도 이메일? | 확장보기에만 둔다. 기본보기에 적혀 있으면 「확장보기에 적힌 항목 N개」로 센다 | 아래 ⑤-B |
| 칸 개수 | `이메일` 1칸. 세금계산서 메일은 「필드 추가+」로 직접 만든다 | 아래 칸-2 |
| ⑧ 이메일 칸을 세션 녹화에서 뺄까? (README §3 문안 4번 — 승인 페이지에 없는 질문) | 그대로 둔다. 연락처와 같은 기준이다(`lib/analytics/index.ts:23` `SESSION_MASK_PII=false`, ADR-0009) | 아래 ⑧-B. 화면이 같으므로 변경 목업은 필요 없다 |

**⑧-B 이메일 칸만 녹화에서 빼기**
- `components/company-info/CompanyInfoField.tsx:118-131` 의 `<input>`(이메일도 여기로 온다, `isEmail` :84)에서 `className={inputCls}`(:120)를 `className={isEmail ? `ph-no-capture ${inputCls}` : inputCls}` 로 바꾼다. #1131 이 보관함·메모 붙여넣기에 쓴 방식과 같다.
- 시험: #1131 의 `tests/components/vault-no-recording.test.ts` 방식으로 「이메일 입력칸에 `ph-no-capture` 가 있고 연락처 칸에는 없다」 1건을 `tests/components/company-info-email.test.ts` 에 더한다.
- 문서: `docs/design/components.md` CompanyInfoField 행에 한 줄. 되돌리기 = 그 className 1줄.

**⑤-B 기본보기에도 넣기**
- `components/company-info-defs.ts:244-253` `기본_대표자_ITEMS` 맨 끝(:252 기대출개인 다음)에 `f(["이메일", "이메일", EMAIL_HINT, 2])` 를 넣는다.
  - 같은 키를 쓰므로 두 보기가 같은 값을 고친다. 컨택가이드 순서는 유지된다.
  - `hiddenFilledCount` 가 기본보기 키를 알아서 빼므로 로직은 고칠 필요가 없다.
  - 주석 :111-113 「기본보기에는 넣지 않는다」를 고친다.
- 테스트
  - `tests/components/company-info-email.test.ts:94-98` 를 뒤집는다: 기본보기에 `[id$="-이메일"]` 가 있다. 이메일만 적은 업체에는 「확장보기에 적힌 항목」 버튼이 없다.
  - `tests/components/company-info-basic-view.test.ts:47` 기대 라벨 끝에 `"이메일"` 을 더한다.
- 목업: `tests/browser/company-info-email-fixture.tsx:207` (B) 제목을 고치고, 375px 기본보기를 다시 캡처한다. 첫 화면이 한 줄 길어진 것을 확인한다.
- 문서: `docs/design/components.md:1737`(기본보기 칸 목록)·:1426(「기본보기엔 없음」)·이 plan 「범위」·「belie 질문」.

**칸-2 이메일 2칸(예: 세금계산서 이메일)**
- 스키마: `lib/types/meeting.ts:104` 다음 줄에 `세금계산서이메일: z.string().default("")`.
- 시트 열
  - `lib/repo/meetings-rows.ts:133` 를 `COMPANY_FIELDS_EXT5 = ["이메일", "세금계산서이메일"]` 로 바꾼다.
  - 그러면 04 는 CE·CF(폭 84), 06 은 BM·BN(폭 66, `HEADER_LABELS`)으로 저절로 넓어진다.
  - 같은 PR 에서 두 열이 함께 생기므로 `MEETING_READ_WIDTHS` 에 단계를 더할 필요가 없다.
- 범위: `lib/config/index.ts:193,201,212-213` → `A1:CF1`·`A2:CF`·`A1:BN1`·`A2:BN`.
- 화면
  - `components/company-info-defs.ts:146` `업체기타메모` 앞에 `f(["세금계산서이메일", "세금계산서 이메일", "세금계산서를 받을 이메일. 예: tax@example.com", 2])` 를 넣는다([기업정보]).
  - `CompanyInfoField.tsx:84` 의 `isEmail` 이 두 키를 모두 잡게 한다.
- TXT: `lib/service/company-info-txt.ts` 업체 라벨 목록에 한 줄.
- 메모: `parse-memo.ts:226` 앞에 「세금계산서」 라벨 분기.
- census: `scripts/ops/census-email-columns.mjs:43-46` 에 04 CF·06 BN 을 더한다. 헤더 규칙도 같다(CF1·BN1 이 빈 칸이거나 `세금계산서이메일`이면 통과 — §1 결함 3).
- 테스트: `tests/repo/company-info-email-io.test.ts`, 위 「폭 고정 테스트 8파일」, `tests/service/db-read-company-archive.test.ts` 의 기대값 83/65·CE/BM 을 84/66·CF/BN 으로 바꾼다. 뜻은 그대로이고 숫자만 새 기준이다.
- 문서: sheet-structure §3·§5-3, data-model CompanyInfo(61필드), components.md. 바뀐 화면 캡처를 승인 기록에 붙인다.

### 3. 승인 후 순서
1. **승인 기록.** 이 plan 에 다음을 적는다(workflow.md 「주문 → 설계 → 목업 → 승인」 5).
   - 승인 시점과 belie 메시지, artifact 버전 `1791746266-5ce4`, 목업 head `ecf241c2`, base `b51d04b8`, ⑤·칸 개수·⑧(이메일 칸 녹화 제외)에 대한 답.
2. **최신 master 확인.** `git -C "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지" fetch origin` 후 `git rev-parse origin/master`.
   - `b51d04b8` 에서 움직였으면 `git log b51d04b8..origin/master -- <아래 D 파일>` 로 D 파일과 겹치는 커밋이 있는지 본다.
3. **워크트리.** 자기가 만든 항목 worktree만 머지·배포 뒤 정리한다. 남의 worktree는 건드리지 않는다. 상한(12)은 `<main>/wt`만 세는 경고다(check.sh:64-89). 정리 명령 = README §5 「worktree 정리」.
4. **D 전용 가지.** 아래 명령으로 만들고, D 파일만 가져온다(PowerShell, 경로 그대로 사용 가능).
   ```powershell
   $main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
   $wt   = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/company-info-email-1012"
   $bak  = git -C $main log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
   git -C $main worktree add $wt -b feat/company-info-email origin/master
   $whole = @(
     "lib/types/meeting.ts","lib/util/contact-email.ts","lib/config/index.ts",
     "lib/repo/meetings-rows.ts","lib/repo/meetings.ts","lib/repo/carryover.ts","lib/repo/company-info-archive.ts",
     "lib/repo/db/read-daily.ts","lib/repo/db/company-archive-sync.ts","lib/repo/gcal-event-ids.ts","lib/repo/gcal-schedule-read.ts",
     "lib/document-ocr/parse-memo.ts","lib/document-ocr/diff.ts","lib/service/company-info-txt.ts",
     "components/company-info-defs.ts","components/company-info/CompanyInfoField.tsx","components/CompanyInfoEditor.tsx",
     "components/company-doc/CompanyDocAutofillDialog.tsx","scripts/ops/census-email-columns.mjs",
     "tests/util/contact-email.test.ts","tests/components/company-info-email.test.ts","tests/repo/company-info-email-io.test.ts",
     "tests/document-ocr/parse-memo.test.ts","tests/service/company-info-txt.test.ts","tests/service/db-read-company-archive.test.ts",
     "tests/repo/company-archive-flip.test.ts","tests/repo/company-finance-base-year-io.test.ts","tests/repo/company-info-archive-header.test.ts",
     "tests/repo/company-info-archive.test.ts","tests/repo/company-info-new-fields-io.test.ts","tests/repo/company-info-new-fields.test.ts",
     "tests/repo/company-info-restructure-io.test.ts","tests/repo/meetings-rows-roundtrip.test.ts",
     "tests/browser/company-info-email-fixture.tsx","tests/browser/company-info-email-server.mjs",
     "docs/domains/sheet-structure.md")
   git -C $wt diff b51d04b8 origin/master -- @whole        # 비어 있어야 통째 checkout 이 안전하다(아니면 그 파일은 손·3-way 로)
   git -C $wt checkout ecf241c2 -- @whole                  # 가지 이름이 아니라 SHA 로
   git -C $wt checkout $bak -- docs/plans/active/company-info-email.md   # 이 절 포함 plan(백업 커밋). 백업 커밋이 없을 때만 원본 작업본에서 Copy-Item
   ```
   - **D 부분만 손으로 옮긴다**(다른 항목의 변경이 섞인 파일).
     - `docs/design/components.md`: CompanyInfoEditor·CompanyInfoField 두 행만.
     - `docs/domains/data-model.md`: `CompanyInfo` 행만(diff 의 `@@ -597` 묶음).
     - `docs/worklog.md`: 위 「워크로그 초안」을 새 항목으로 넣는다.
   - 위 파일 목록은 D 전용인지 확인했다. 다른 항목은 이 코드 파일들을 건드리지 않았고, `lib/config/index.ts` 도 D 묶음 1개뿐이다.
5. 2절의 결정 반영(⑧ 포함), 1절의 문서 결함 1~2 수정, census 헤더 규칙(결함 3) 수정 + 시험.
6. `Set-Location $wt; npm ci`.
7. 5절의 검사를 모두 통과시킨다. ⑤ 또는 칸 개수를 바꿨다면 목업으로 375×812·1280×800 을 캡처하고 가로 넘침 0 을 확인한다(목업 서버는 README §5 백그라운드 방식, D 서버는 자동 포트). 작성자와 다른 검증자의 현재 head PASS 를 받는다(README §4 「독립 검증」).
8. **커밋·PR.** 커밋 1개로 만든다(squash 본문이 그대로 새소식이 된다).
   - 제목: `feat(company-info): 대표 이메일 칸 추가 — 04 CE · 06 BM 미러`
   - 본문 첫 줄: `Changelog: 업체정보에 대표 이메일을 적어 두고 TXT로도 받을 수 있어요.`
   - `전:` 「대표 이메일을 적을 칸이 없어 기타메모에 섞어 적었어요.」
   - `후:` 「[대표자] 연락처 아래 이메일 칸에 적으면 TXT 에도 나와요.」
   - push 후 PR 을 연다.
9. CI(`typecheck.yml`) 초록.
10. **census(머지 직전, READ-ONLY).**
    - **먼저 대상 목록이 빠짐없는지 본다.** census 는 옛 registry 시트 `users!A2:F` 에서 role=`trainee` 인 행만 대상으로 삼는다(`census-email-columns.mjs:60-68`). 그런데 계정·기수 연결의 정본은 지금 DB registry 다(CLAUDE.md:19). 그래서 `gh workflow run "DB Audit (read-only)" -f script=registry-parity`(읽기 전용, `.github/workflows/db-audit.yml:19`)를 돌려 시트↔DB 불일치가 0 인지 본다. 불일치가 있으면 그 건수를 census 결과와 함께 belie 결정함에 올리고 머지를 보류한다(빠진 시트의 CE·BM 을 못 봤을 수 있다).
    - cwd 는 main 레포다. `.env.local` 이 main 에만 있고 워크트리에는 없다. 비밀값 파일은 복사하지 않는다.
    - 실행(헤더 규칙을 고친 이 PR 의 스크립트로): `Set-Location $main; node "$wt/scripts/ops/census-email-columns.mjs"; $LASTEXITCODE` → 0 이어야 다음으로 간다.
    - **오류만 있는 결과**(값 있음 0·헤더 다름 0·읽기 오류 ≥1 로 exit 2): 일시적인 API 오류일 수 있으니 몇 분 뒤 **1번만** 다시 돌린다. 그래도 오류가 남으면 보류하고 보고한다.
    - 대상 시트 수·셀 수·헤더 다름 수·오류 수·registry-parity 불일치 수만 이 plan 「배포 전 확인」에 적고 체크한다.
    - exit 2 또는 1 이면 **머지 금지.** 워크로그 `📥 belie 결정함` 에 올린다. 다음 빈 열(CF·BN)로 옮길지 정하는 동안 다른 항목은 계속 진행한다(§4 D 보류 규칙 — F PR-1 은 D 없이 간다).
11. `git rev-parse origin/master` 로 last-good 을 기록하고 squash merge 한다. 직렬 큐라 다른 머지나 배포가 진행 중이면 기다린다.
12. 배포 run 을 끝까지 관찰하고 health 를 확인한다(6절). 실패하면 `git revert <squash>` 후 push 하고(force 금지), 재배포 health 를 확인한다.
13. **마감.**
    - worklog 에 merge SHA·Deploy run·census 숫자를 적는다. 같은 항목의 「미완료」에 **「배포 다음 날 census 재실행(6절) — 담당: 이 총괄, 계기: 다음 항목 PR 을 시작할 때 먼저 확인」** 을 등록한다. 못 하면 그 줄을 NOT_RUN 으로 바꿔 둔다.
    - 이 plan 의 completed 이동은 다음 항목 PR 에 함께 넣거나 마지막 문서 PR 로 묶는다(README §6-6). 문서만 PR 도 pre-commit 이 check.sh 를 돌리므로 `npm ci` 가 필요하다.
    - D 워크트리는 README §5 「worktree 정리」 명령으로 정리한다(`node_modules` 를 짧은 경로로 옮겨 지운 뒤 `git worktree remove`).

### 4. PR 나누기·머지 순서
- D 는 단독 PR 이다.
- 기본은 **F 보다 먼저** 머지한다. D 가 공용 계약(`lib/types/meeting.ts`·`lib/config/index.ts`)을 바꾸므로 §3.5 를 따른다. 특히 F PR-1 은 같은 `lib/types/meeting.ts` 를 고친다(다른 블록). F 는 D 머지 뒤 리베이스한다. census 로 보류되면 아래 D 보류 규칙을 따른다.
- A·B·C·E 와 겹치는 코드 파일은 없다. 겹치는 건 문서 3개(components.md·data-model.md·worklog.md)뿐이다.
  - 나중에 머지하는 PR 이 양쪽 내용을 모두 살려 충돌을 푼다.
  - 순서는 자유지만 머지는 한 번에 하나씩.
- PR #1131(`fix/vault-no-recording`)도 `CompanyDocAutofillDialog.tsx` 를 고치지만 다른 줄이다(#1131 은 :311 textarea className — diff hunk `@@ -308`, D 는 :35 안내문). 자동 병합되며 순서는 상관없다. ⑧-B 를 고르면 D 도 #1131 과 같은 `ph-no-capture` 방식을 쓴다(파일은 다름).
- **D 보류 규칙(README §4·F plan §5·§12 와 같은 문장)**: **D가 census로 보류되면 F PR-1부터 D 없이 진행한다. 이메일 유지 단언은 D가 나중에 rebase하면서 추가한다.** 그때 D 는 `tests/service/company-rename.test.ts`(F PR-2 가 만든 파일)에 「개명 뒤 06 재저장에 이메일 값이 그대로」 단언 1개를 더한다.

### 5. 검증 명령 (D 워크트리에서, PowerShell)
```powershell
$tests = @(
  "tests/util/contact-email.test.ts","tests/components/company-info-email.test.ts","tests/components/company-info-basic-view.test.ts",
  "tests/components/company-doc-autofill.test.ts","tests/repo/company-info-email-io.test.ts","tests/document-ocr/parse-memo.test.ts",
  "tests/service/company-info-txt.test.ts","tests/service/db-read-company-archive.test.ts","tests/repo/company-archive-flip.test.ts",
  "tests/repo/company-finance-base-year-io.test.ts","tests/repo/company-info-archive-header.test.ts","tests/repo/company-info-archive.test.ts",
  "tests/repo/company-info-new-fields-io.test.ts","tests/repo/company-info-new-fields.test.ts","tests/repo/company-info-restructure-io.test.ts",
  "tests/repo/meetings-rows-roundtrip.test.ts","tests/ops/census-email-columns.test.ts")   # 마지막 = 결함 3 신규 시험
npx vitest run @tests                                 # 실패 0 으로 판정(ecf241c2 기준 16파일 165개 — 신규 시험이 더해져 건수가 바뀐다, 새로 적는다)
npx vitest run tests/structural                       # 기준: 92개 통과
npm run typecheck
& "C:/Program Files/Git/bin/bash.exe" scripts/doc-drift.sh
& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh   # 필수 게이트(lint·500줄 포함). 맨 bash·npm run check 금지(WSL)
npm run build                                         # 런타임 변경 — production build(workflow.md 구현 2)
# 목업: README §5 「목업 서버」대로 tests/browser/company-info-email-server.mjs 를 백그라운드로(PORT 안 읽음 — 로그의 주소) → ?email=ceo@example · ?empty=1 · ?view=filled
```
census(READ-ONLY, §3-10 순서 — registry-parity 먼저): `Set-Location "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"; node "<D 워크트리>/scripts/ops/census-email-columns.mjs"; $LASTEXITCODE` → 0.

### 6. 배포 후 운영 확인 (실데이터 쓰기 없음)
- 배포: `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion,headSha`. headSha 가 merge SHA 이고 `conclusion=success` 인지 본다.
- health: `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online/api/health` → 200, `https://salesptlog.online` → 200.
- 배포 다음 날 census 를 다시 돌린다(읽기 전용). **담당 = 이 총괄, 계기 = §3-13 에서 worklog 「미완료」에 등록한 줄**(다음 항목 PR 을 시작할 때 먼저 확인). 못 하면 그 줄을 NOT_RUN 으로 남긴다.
  - CE·BM 의 「값 있는 셀」 수가 0 에서 늘었으면 미러가 동작하는 것이다(값 자체는 보지 않는다). 수강생이 아직 이메일을 안 적었으면 0 그대로일 수 있다 — 그때는 「미러 동작 미확인」으로 적는다.
  - 이때 나오는 「보류」 판정은 무시한다. 배포 뒤에는 앱이 쓴 값·헤더이기 때문이다.
- 접근할 수 있으면(읽기 전용): PostHog `sheet_mirror_error`(tab=meetings·company_archive)가 배포 전 24시간보다 늘지 않았는지 본다. 이 인계에는 PostHog 접속 수단이 없다 — 연결된 읽기 도구가 없으면 **NOT_RUN(접속 수단 없음)**(README §6).
- 로그인한 화면 확인은 **NOT_RUN** 으로 남긴다. 에이전트는 로그인할 수 없고, 실수강생 데이터를 열지 않는다.

### 7. 위험
- **열 덮어쓰기**: 행 쓰기에는 §2.5 pre-read 가드가 없다. 그래서 첫 저장이 04 CE·06 BM 셀을 `''` 나 값으로 덮는다. census 0 이 유일한 안전선이다.
- **옛 탭 저장**: 배포 직후 옛 JS 탭이 저장하면 zod 기본값 때문에 이메일이 `""` 로 덮인다. 창이 좁고 확장 1~4 때와 같은 성격이라 따로 조치하지 않는다.
- **세션 리플레이**: `lib/analytics/index.ts:23` `SESSION_MASK_PII=false`(ADR-0009, 사용자 선택)라 이메일 입력도 연락처처럼 녹화된다.
  - belie 가 정할 일이다 → **결정 ⑧**(§2, README §3 결정표·문안 4번). 답은 「승인 기록」에 남긴다.
  - 기본은 그대로 둔다. 막기로 하면 ⑧-B(이메일 input 에 `ph-no-capture` 한 줄, #1131 방식).
- **느슨한 모양 검사**: 오타 도메인(gmial.com)은 못 잡는다. 점 주변 공백은 붙이지 않는다(여러 주소를 보존하려는 의도).
- **500줄 상한**: `components/CompanyInfoEditor.tsx` 가 495줄이다. 이 기능의 로직을 여기에 넣지 않는다.
- **되돌리기**: squash 커밋을 revert 한다. CE·BM 에 이미 써진 값은 남지만, 코드가 읽지 않을 뿐 다른 열에는 영향이 없다.

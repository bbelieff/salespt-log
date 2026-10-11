> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 [대표자] 「이메일」 한 칸(연락처 바로 아래) 추가 — 저장 좌표(04 CE · 06 BM)·메모 자동입력·검수 결함 반영·배포 전 확인을 한곳에 적은 작업 계획.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `lib/types/meeting.ts`(CompanyInfo.이메일) · `lib/repo/meetings-rows.ts`(COMPANY_FIELDS_EXT5) · `lib/repo/company-info-archive.ts` · `lib/repo/db/read-daily.ts` · `lib/document-ocr/parse-memo.ts` · `lib/util/contact-email.ts` · `components/company-info-defs.ts` · `components/company-info/CompanyInfoField.tsx` · `lib/service/company-info-txt.ts`
> - **읽고 나면 알 수 있는 것**: 이메일이 어디에 저장되고 개명·이월 뒤에도 왜 남는지 · 메모에서 비밀번호가 이메일 칸으로 새지 않게 막은 방법 · 배포 전에 무엇을 확인해야 하는지
> - **관련 문서**: [sheet-structure.md §3 확장5·§5-3 BM](../../domains/sheet-structure.md) · [data-model.md CompanyInfo](../../domains/data-model.md) · [components.md CompanyInfoField](../../design/components.md)

# 업체정보 [대표자] 이메일 (company-info-email, 2026-10-12)

## 범위
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
- `node tests/browser/company-info-email-server.mjs` → 출력 주소. `?email=<값>` · `?empty=1` · `?view=all|filled|empty`.
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

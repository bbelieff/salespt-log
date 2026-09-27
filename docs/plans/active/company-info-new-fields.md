> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보에 새 칸 20개(과세유형·업태·법인등록번호·임차 조건·주민등록번호 앞자리·재무 13칸)를 추가하고, 주민등록번호는 앞 6자리만 저장되게 막는다.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/types/meeting.ts` CompanyInfo · 04 업체관리(AU~BN)·06 업체정보(AC~AV) 코덱 · 이월 · TXT 추출 · `components/CompanyInfoEditor.tsx`(컨택관리·일정/계약·실무/수납 공용)
> - **읽고 나면 알 수 있는 것**: 새 칸이 시트 어디에 저장되나 / 주민등록번호 뒷자리가 왜 저장될 수 없나 / 무엇을 되돌리면 원상복구되나
> - **관련 문서**: `docs/domains/sheet-structure.md` §3(04)·§5-3(06), `docs/domains/data-model.md` CompanyInfo, 선례 커밋 0ac1356(field-grid, 2026-06-11), `docs/plans/active/company-info-hint-tooltip.md`

---
slug: company-info-new-fields
status: active
created: 2026-09-28
worktree: _wt/salespt-log/dc-cohort12
branch: feat/company-info-new-fields
---

# 업체정보 새 칸 20개 (PR-3, belie 확정 2026-09-28)

## 1. Scope

- 새 키 20개를 `COMPANY_FIELDS_EXT2` 로 확정 순서 그대로 추가: 과세유형·업태·법인등록번호·임차보증금·임차월세·임차면적 / 주민등록번호 / 결산연도·영업이익·당기순이익·이자비용·자산총계·부채총계·자본총계·반기별매출·면세수입금액·부채비율·이자보상배율·당기순이익률·매출증가율.
- 전부 자유 텍스트(default ""). 비율 4칸도 이번엔 직접 입력 — 자동 계산은 서류 인식 PR 소관.
- 편집기: [업체]·[대표자]에 새 칸, 두 그룹 아래 전폭 [재무] 섹션. 새 칸마다 (?) 설명.

## 2. 좌표 결정 (자율결정 — 근거·복구법)

- **04 = AU~BN (지시의 AT~BM 에서 한 칸 뒤로)**. 근거: AT 는 이미 `gcal_event_ids` 사용자별 JSON 맵이 쓰는 열이다(`lib/repo/gcal-event-ids.ts` SPEC, sheet-structure §3). AT 부터 쓰면 구글 캘린더 매핑을 덮는다 → "기존 열 이동·침범 금지" 원칙 우선. AT 는 코덱이 항상 빈칸으로 두고 split write 범위 밖.
- **06 = AC~AV** (Z~AB 바로 뒤, 지시 그대로).
- grid: 04 = 66열(BN), 06 = 48열(AV) lazy 확장. grid 확장은 **쓰기 경로만**(split write·clear·이월 쓰기). 04 읽기(A2:BN·A:BN)는 grid 를 넓히지 않고 범위 초과 400 이면 A:AS 로 폴백(`readMeetingRows` — gcal-event-ids 의 "읽기에 쓰기 작업을 붙이지 않는다" 규약, grid 확장 시 그리드 밖 수식 참조 시프트 사고 회피).
- 헤더: 04 AU1:BN1, 06 Z1 이후는 **빈 셀에만** 셀 단위로 필드 키 라벨 보강(`headerBackfillPlan`). 사용자가 고쳐 쓴 헤더 문구는 보존.

## 3. 주민등록번호 보안 규칙 (belie 결정)

- 저장값은 `NNNNNN-` 또는 "" 뿐. `lib/util/rrn-front.ts`:
  - `normalizeRrnFront` — 저장 정규화(공백 무시, 앞 6자리 숫자 없으면 "").
  - `sanitizeRrnFrontTyping` — 입력 중: 숫자 6자리 초과 순간 즉시 절단(붙여넣기 포함), 6자리 미만은 그대로.
- 강제 지점 3겹: ① 편집기 onChange/blur ② **서버 스키마** `CompanyInfo.주민등록번호` zod transform — POST /api/company-info·PATCH /api/meeting/[id]·DB 읽기 모두 이 스키마를 지난다 ③ 04·06 시트 코덱(`meetingToRow`·`companyInfoToArchiveRow`)에서 한 번 더.

## 4. 매핑 지점 (전부 확장)

| 지점 | 변경 |
|---|---|
| `lib/types/meeting.ts` | 20키 + 주민등록번호 transform |
| `lib/repo/meetings-rows.ts` | EXT2 상수·폭 66·코덱 read/write·apostrophe 대상·헤더 계획 |
| `lib/repo/meetings.ts` | split write AU:BN · findById A:BN · clear AU:BN · 읽기 A:AS 폴백(`readMeetingRows`) · AU1:BN1 헤더 보강 |
| `lib/repo/gcal-schedule-read.ts` | A2:BN 읽기 — `readMeetingRows` 폴백 공유 |
| `lib/config/index.ts` | meetings A2:BN / companyInfoArchive A2:AV |
| `lib/repo/company-info-archive.ts` | 06 행 48열 · 헤더 빈 셀 보강 · 읽기 E:AV |
| `lib/repo/db/read-daily.ts` | 열문자 payload A~BN 복원 · 06 열문자 AC~AV |
| `lib/repo/carryover.ts` | 이월이 AQ~AS·AU~BN 도 복사(AT 제외). 이전 시트 확장 읽기 AQ:BN → 범위 초과면 AQ:AS 재읽기(45~46열 시트의 확장 3칸 보존). 쓰기 전 `sanitizeCarryRaw`(주민등록번호 앞 6자리) · 확장 문자열 `'` 접두 |
| `lib/service/company-info-txt.ts` | 새 라벨 + [재무] 섹션(값 있을 때만) |
| `components/company-info-defs.ts`·`CompanyInfoEditor.tsx` | 필드 정의 분리 · [재무] 그룹 · 주민번호 정규화 |
| `lib/util/sheet-column.ts` | 열문자 일반형(BA 이후) — read-daily·carryover 의 AZ 한계 제거 |

DB: payload JSONB — 마이그레이션 없음. `company-archive-sync.ts` 는 `CompanyInfo.parse({})` 로 새 키가 자동 포함돼 변경 불필요.

## 4.5 편집기 배치 결정 (자율결정)

- `업종주생산품목` span 2→1: 새 `업태` 칸과 한 줄에 짝지어 두 칸이 나란히 보이게 했다(둘 다 짧은 값).
- [재무] 안에서 `면세수입금액`(1칸)을 `반기별매출`(여러 줄·전폭) **앞**에 둔다. 확정 순서(반기→면세)
  그대로면 `자본총계`·`매출증가율` 옆이 비는 구멍이 두 개 생긴다. `COMPANY_FIELDS_EXT2`(시트·DB 열
  순서)는 확정 순서 그대로이며, 화면·TXT 의 표시 순서만 다르다. 되돌리기 = company-info-defs.ts·
  company-info-txt.ts 두 줄 순서 교환.
- `소유여부` 설명: 임차 보증금·월세·면적이 전용 칸으로 생겼으므로 "임차면 아래 칸에" 로 바꿨다(두 곳에 중복 입력 방지).
- 주민등록번호 앞자리 칸: 뒷자리가 잘리거나 6자리 미만이라 비워지면 칸 아래에 이유를 한 줄 보여준다.
- PC 상세 2단(inline)에서 [재무]는 두 단 전폭이라 내부 그리드를 2열로 둔다(1열이면 13칸이 전폭으로 늘어짐).

## 5. Verify

- 단위: `tests/repo/company-info-new-fields-io.test.ts`(읽기 A:AS 폴백·grid 무확장 · 이월 46열 시트 AQ~AS 보존 · 이월 주민번호/apostrophe), `tests/repo/company-info-new-fields.test.ts`(스키마·좌표·라운드트립·헤더·이월·DB·TXT), `tests/repo/company-info-archive-header.test.ts`(06 헤더 빈 셀만), `tests/util/rrn-front.test.ts`(정규화·서버 강제), `tests/util/sheet-column.test.ts`, `tests/components/company-info-new-fields.test.ts`(라벨·재무 섹션·주민번호 절단). 기존 폭 고정 테스트(45·28열) 갱신.
- 미실측: 라이브 시트 쓰기·375px 화면 캡처는 이 세션에서 하지 않았다(모바일은 기존 그리드 규격 재사용 — 1열 강하).

## 6. 되돌리기

- squash 커밋 1건 `git revert`. 시트에 이미 생긴 AU~BN·AC~AV 값·헤더는 남지만 앱이 읽지 않을 뿐 기존 열에는 영향 없음. DB payload 의 새 키는 스키마에서 빠지면 zod 가 무시한다.

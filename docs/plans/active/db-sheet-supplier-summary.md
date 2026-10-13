> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 「공급처별 보기」(유입 경로 #10) — 공급처마다 들어온 DB → 상담 → 미팅 → 계약을 한 줄로 비교하는 패널의 범위·규칙·검수 반영·목업 확인법을 적은 작업 계획.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `app/(app)/db-sheet/page.tsx` · `_components/SupplierSummary.tsx` · `_components/supplier-summary.ts` · `_components/use-db-sheet.ts` · `db-sheet.css` · `lib/service/db-sheet-status.ts`(dbSheetFunnelStep) · `lib/repo/db/db-sheet.ts`(단계 상수·save 응답) · `lib/types/db-sheet.ts`(DbSheetFunnelStep · DB_SHEET_MEETING_STAGE)
> - **읽고 나면 알 수 있는 것**: 숫자를 어떤 규칙으로 세는지 · 대시보드 숫자와 왜 다를 수 있는지 · 목업을 어떻게 열어 확인하는지
> - **관련 문서**: [components.md DB관리시트 SupplierSummary](../../design/components.md) · [data-model.md DbSheetFunnelStep](../../domains/data-model.md) · [db-management-sheet-backend.md](../completed/db-management-sheet-backend.md) · [contract-count-exclude-terminated.md](../completed/contract-count-exclude-terminated.md)

# DB관리시트 공급처별 성과 (db-sheet-supplier-summary, 2026-10-12)

## 범위
- **2026-10-13 결정(이하 옛 배치·펼침 기억 규칙보다 우선):** DB목록 우선. DB생산/DB관리시트 탭은 TopHeader 배너로 올림. 목록 박스 첫 행에 공급처별 보기와 **보여줄 항목**(옛 표시할 열)을 나란히, 검색 너비 압축. 넓은 PC 한 행, 좁으면 필터 다음 행. 공급처 패널은 기본 접힘, `?view=suppliers` 명시 진입만 펼침. 비용은 추가하지 않음. 수정 목업 승인 대기.
- 포함: DB관리시트(/db-sheet)만. [공급처별 보기] 토글 → 공급처별 들어온 DB·상담·미팅·계약·계약률 + 한 줄 요약. 줄을 누르면 기존 공급처 필터.
  `/db-sheet?view=suppliers` 딥링크. 유입일 기간 필터를 따르고 검색어·공급처 선택은 무시(비교 유지).
- 서버: 새 API·새 쓰기·스키마 변경 없음. 기존 GET/POST 응답의 각 lead 에 읽기 전용 `funnel` 이 붙는다(서비스 투영, 저장 안 함).
  `save()` 응답에 effectiveMeetingId·meetingLineageIds 를 실음(응답 전용 — persist 가 지운다). 시트 호출 추가 없음.
- 제외(belie 기본안): 대시보드 변경 없음 · 비용 열(1건당 매입단가) 없음 · 현수막·콜·지·기·소 소개처별 비교 없음(lead-chain 트랙).

## 단계 규칙 (`dbSheetFunnelStep`, 위에서 처음 맞는 것)
| 조건 | 단계 |
|---|---|
| 연결 계약 중 해지일·숨김 없는 계약이 있음 | 계약 |
| 연결 계약이 있으나 모두 해지/숨김 | 미팅 |
| 미팅 상태 계약(계약 행 아직 없음) | 계약 |
| 미팅 예약·변경·완료 | 미팅 |
| 미팅 취소·삭제 | 아래 규칙으로 |
| 최초상담일 있음(컨택진행·상담 후 거절) | 상담 |
| 미컨택이 아닌 결과(부재·단순거절·재통화) | 연락 |
| 그 외 | 유입 |

**대시보드와 다른 점(일부러)**: 이 패널은 DB관리시트 업체 1건 = 1줄, 유입일 기준이다. 대시보드는 영업관리 숫자(컨택관리 수기 실적 포함)와 미팅 카드를
STATS_WEEKS 창으로 센다. 계약도 대시보드는 미팅 상태 「계약」에서 해지일 계약만 빼지만(해지숨김만으로는 안 뺌), 이 패널은 같은 화면 현재상태 열(「계약해지」=
해지 또는 숨김)과 맞춘다. 미팅변경은 이 패널에서 미팅(업체가 취소된 게 아님)이고 대시보드 ALIVE 에서는 빠진다. 각주가 「대시보드 숫자와 다를 수 있어요」를 알린다.

## 검수 결함 반영 (스펙 리뷰 2026-10-12)
1. [major] `tests/api/db-sheet.test.ts` GET 동등 비교 → `{...lead, funnel:'유입'}` (투영 계약 변경, 약화 아님). `db-sheet-status.test.ts` 두 곳도 같은 취지.
2. [major] 비율 = `(n/total*100).toFixed(1)+'%'`, 분모 0 = 「—」 → 5.0% · 0.0% · 6.7% · 4.1% · 3.3% 고정 테스트.
3. [major] 목업 A = 미연락 10 + 연락만 14 + 상담 10 + 미팅 4 + 계약 2 = 40. A·메타·미입력 유입일 ≥ 기간 시작(오늘-11일), B 는 모두 그 전.
4. [major] 계약 시드 row_key `r7`… 숫자형 + 필드명 payload(계약일·업체명·수임비·linkedMeetingId·해지일). 진행 계약 업체는 미팅 상태도 계약.
5. [major] 조사 없는 문구(「1위 공급처 ‘X’ · DB N건 중 계약 M건」). 마지막 동률 = 이름순. 상담도 0이면 「아직 상담까지 간 DB가 없어요」. 기간 없으면 「전체 기간」.
6. [major] 첫 조회 실패 + 빈 목록이면 「불러오지 못했어요 · 새로고침」, 가져오기 버튼 없음(중복 가져오기 방지).
7. [minor] 「대시보드와 같다」 주장 삭제, 차이는 위 표 아래에 기록.
8. [minor] 목업 진입점은 localStorage 를 미리 채우지 않는다 — 딥링크는 page.tsx 마운트가 처리, 딥링크만으로는 기억을 바꾸지 않음.
9. [minor] 선택 줄 3px 표시는 db-sheet.css(`body.db-sheet-route` 접두, inset box-shadow) — Tailwind 임의값 없음.
10. [minor] 막대 = 그 공급처 채널색(매입DB 파랑·직접생산 초록, 섞이면 회색), 1위 = 진회색 칩. 파랑 배경은 선택·토글에만.
11. [minor] 기간 칩 「10/1부터」·「10/12까지」·「10/1 ~ 10/12」, 문자열 분해, 해가 다르면 연도.
12. [minor] 선택한 공급처는 8곳 밖이어도 보임, 미입력 줄은 8곳에 안 셈·늘 마지막.
13. [minor] 새 localStorage 읽기·쓰기 모두 try/catch. 모바일 목록 이동은 page.tsx 빈 앵커(`scroll-mt-app-content`)로(Grid 무변경).
14. [minor] 「총 N건 = 들어온 DB」 확인은 검색어·유입일 필터가 모두 빈 상태에서.

## 자율결정 · 근거 · 되돌리기
- **단계 계산을 서버 투영에 둠**(화면이 현재상태 글자를 해석하지 않음): 해지/숨김 계약·일정 변경 뒤 새 미팅 연결은 서버만 정확히 안다. 읽기 전용이라 데이터 위험 없음.
  되돌리기 = 이 PR revert(저장된 값 없음).
- **save() 응답 lineage**: 없으면 일정 변경 + 계약 업체 메모 저장 직후 현재상태가 「계약」으로 잠깐 틀어진다(기존 버그). 응답 전용, 저장 경로는 그대로.
- **SUPPLIER_MIN_SAMPLE = 20**, **처음 8곳**: 상수 하나로 조정.
- **모바일 목록 이동은 즉시 이동**(부드러운 스크롤은 미리보기 창에서 동작하지 않아 검증 불가 → 즉시 이동으로 단순화).

## 목업
- `node tests/browser/db-sheet-supplier-server.mjs` → 출력 주소(`/db-sheet?view=suppliers`). (Codex 셸에서는 README §5 「목업 서버」처럼 백그라운드로 띄운다) 실제 route → service → repo 를 PGlite 에서 돌리고,
  시작할 때 기본 데이터의 서버 단계가 기대 숫자(98건)와 정확히 맞는지 스스로 확인한다(`SEED_OK`).
- 시나리오: `&empty=1`(DB 없음) · `&few=1`(20건 미만뿐 → 대기 문구) · `&many=1`(11곳 → 더 보기) · `&error=1`(첫 조회 실패). 화면에서 바꾼 값은 서버 메모리에만.
- 기대 숫자(전체 기간, 들어온 DB/상담/미팅/계약/계약률): A 40/16/6/2/5.0% · 메타 광고 30/14/4/2/6.7% · B 25/6/1/0/0.0% · 미입력 3/0/0/0/0.0% · 합계 98/36/11/4/4.1%.
  유입일 시작 = 기간 시작(오늘-11일)이면 B 줄이 사라진다.
- 확인한 것(2026-10-12, 1280·375): 토글 aria-expanded·기억·딥링크, 표·카드 숫자, 기간 필터·검색 무시, 줄 누르기 → 필터·총 40건·강조, 미컨택 → 컨택진행 저장 후 A 상담 16→17·미연락 10→9(새로고침 없이),
  일정 변경 + 진행 계약 업체 메모 저장 POST 응답 현재상태 「진행대기」·단계 계약(GET 과 같음), 375px 가로 스크롤 없음·카드 107px, 4개 시나리오 문구.
- 알려진 배치 변화: 「공급처별 보기」 버튼(92px)만큼 도구 줄이 넓어져, 필터 칸이 약 760px 보다 좁으면 도구(공급처별 보기·표시할 열)가
  둘째 줄 오른쪽으로 내려간다. 실측 1280px = 필터 칸 674px → 두 줄(전에는 한 줄). 더 넓은 화면은 계산상 한 줄(미측정).
  375px 도 도구가 둘째 줄로 내려가며 검색칸 폭은 유지된다.

## belie 질문 (결정 전까지 기본안)
- 공급처별 비용(1건당 매입단가 · 계약 1건당 DB비용): 기본안 = 1차 제외. 구매목록 업체명과 공급처 이름을 글자까지 맞춰야 해서 2차에 「구매목록에서 고르기」 후 붙이기.
- 유입 경로 범위: 기본안 = DB관리시트(매입DB·직접생산)만. 소개처별은 lead-chain 트랙.
- 1280px 노트북에서 도구 줄이 두 줄이 되는 것(목록 시작이 약 40px 내려감)을 받아들일지(대안: 닫혀 있을 때 목록 위 한 줄 「공급처별 성과 · 계약률 1위 ‘X’ [펼치기]」 띠로 옮기기).

## 수용 기준
- [x] 토글·기억·딥링크(기억 안 바꿈) — 목업 확인 + `db-sheet-supplier-summary-ui.test.ts` 소스 검사.
- [x] 기대 숫자·한 줄 요약·기간 칩 — 목업 + `db-sheet-supplier-summary.test.ts` 「reproduces the browser fixture numbers exactly」.
- [x] 해지만 → 미팅 · 취소/삭제 → 상담 · 미팅 상태 계약 → 계약 — `db-sheet-status.test.ts` 표 테스트.
- [x] save 응답 lineage · 저장 행에 투영 키 없음 — `db-sheet.pglite.test.ts`.
- [x] 저장 후 즉시 갱신(accept 가 funnel 복사) — `db-sheet-autosave.test.ts`.
- [ ] 목업 belie 승인(링크·기준 SHA 기록).
- [ ] check.sh 초록(총괄이 커밋 시).

## 워크로그 초안 (총괄이 커밋 때 docs/worklog.md 맨 위에)
```
### 2026-10-12 · DB관리시트 공급처별 성과 (db-sheet-supplier-summary, 유입 경로 #10)
- 한 것: [공급처별 보기] 패널(공급처별 들어온 DB·상담·미팅·계약·계약률 + 1위 한 줄, 줄 누르면 공급처 필터, ?view=suppliers).
  서버는 읽기 전용 lead.funnel 투영(dbSheetFunnelStep) + save() 응답 lineage. 새 API·쓰기·시트 호출 없음.
- 구역: app/(app)/db-sheet/**, lib/service/db-sheet-status.ts, lib/repo/db/db-sheet.ts, lib/types/db-sheet.ts.
- 자율결정: 표본 20·처음 8곳 상수, 비용 열 보류(belie), 대시보드와 다른 셈법은 각주로 안내.
- 되돌리기: PR revert(저장된 값 없음).
```

## Codex 인계 — 승인 후 할 일 (2026-10-12)

> 이 기능을 처음 보는 사람이 이 절만 읽고 E를 끝낼 수 있게 썼다. 줄 번호는 가지 `feat/dashboard-followups` @ `ecf241c2` 기준이다
> (origin/master `b51d04b8` 위 1커밋, push 됨, PR 없음). 승인 페이지는 https://claude.ai/artifact/MKmsiGtAPy9iouKWiHB2QG 이다.
> belie의 답은 총괄 대화로 받는다. 답이 없거나 「권장대로」라고 하면 아래 기본안을 따른다.

### 1. 지금 상태 — 무엇이 실제이고 무엇이 목업인가
- **실제(그대로 출시 가능한 제품 코드)**
  - 서버 단계 계산 `dbSheetFunnelStep`: `lib/service/db-sheet-status.ts:22-31`. 미팅 없는 목록은 `:35`, 계약 연결 경로는 `:48-53`.
    GET(`lib/service/db-sheet.ts:35`)과 모든 POST(`:50,:73`)가 이 함수를 지난다.
  - 저장 응답 lineage: `lib/repo/db/db-sheet.ts:83-85`. 저장할 때 `:24`가 funnel·lineage를 지운다.
  - 단계 이름 상수: `lib/types/db-sheet.ts:22-28`. 저장소 `lib/repo/db/db-sheet.ts:52,55`가 이 상수를 쓴다.
  - 집계 `app/(app)/db-sheet/_components/supplier-summary.ts`, 화면 `SupplierSummary.tsx`.
  - 페이지 연결 `page.tsx:14-15,21-22,26-28,35,39-40`, CSS `db-sheet.css:115-116`, 저장 직후 갱신 `use-db-sheet.ts:53`.
- **목업(합성 데이터 전용)**: `tests/browser/db-sheet-supplier-server.mjs`가 메모리 PGlite 위에서 실제 route → service → repo를 돌린다.
  로그인·시트 동기화만 모의다(`:39-46`). 운영 DB·시트·OAuth에는 닿지 않는다.
- 그래서 승인 뒤 「모의를 실제로 바꾸는」 작업은 없다. 남은 일은 결정 반영, E만 떼어 PR, 검증, 배포, 운영 확인이다.
- **이 인계를 쓰며 다시 확인함(2026-10-12)**
  - §6 첫 명령: E 테스트 6파일 104개 통과(17.5초).
  - 목업 서버가 `SEED_OK 98 leads (A 40/16/6/2 · B 25/6/1/0 · 메타 30/14/4/2 · 미입력 3)`를 다시 냈다.
  - 위 계획 내용(범위, 서버, 단계 규칙 표, 검수 반영 1~14, 자율결정)을 코드와 대조했다. 어긋난 곳은 없다.
- **NOT_RUN**: `scripts/check.sh` 전체, `npm run build`, 375/1280 화면 재측정. 위 「확인한 것」은 제작 당시 기록이다.

### 2. E에 속한 파일 — 가지 커밋 하나에 A~F가 섞여 있다
- **E 전용(통째로 가져감)**
  - `app/(app)/db-sheet/_components/{SupplierSummary.tsx,supplier-summary.ts,use-db-sheet.ts}`
  - `app/(app)/db-sheet/{page.tsx,db-sheet.css}`
  - `lib/service/db-sheet-status.ts` · `lib/repo/db/db-sheet.ts`
  - `tests/api/db-sheet.test.ts` · `tests/service/db-sheet-status.test.ts` · `tests/repo/db-sheet.pglite.test.ts`
  - `tests/components/{db-sheet-autosave,db-sheet-supplier-summary,db-sheet-supplier-summary-ui}.test.ts`
  - `tests/browser/{db-sheet-supplier-server.mjs,db-sheet-supplier-fixture.tsx}`
  - **이 문서(plan)는 이 목록에 넣지 않는다.** `git checkout ecf241c2 --` 로 가져오면 이 인계 절이 없는 옛 판이 온다. README §4 대로 `git checkout $bak -- docs/plans/active/db-sheet-supplier-summary.md`(백업 커밋)로 따로 가져온다.
- **다른 항목과 함께 고친 파일(E 줄만 손으로 옮김)**
  - `lib/types/db-sheet.ts`: E는 `:4`의 `type MeetingState` import와 `:22-28`(두 상수, `DbSheetFunnelStep`, `funnel?`)이다.
    `:8-10` `isDbSheetFollowUpResult`는 **A** 것이다.
  - `docs/domains/data-model.md`: E는 `:756-757`이다. `:753`은 A, 위쪽 `Dashboard*`는 C, `CompanyInfo` 줄은 D 것이다.
  - `docs/design/components.md`: 「## DB관리시트」(`:1742`) 아래 `SupplierSummary` 블록(`:1748~`)만 E다.
  - `docs/worklog.md`: A~F 공동 항목은 쓰지 않는다. 이 문서의 「워크로그 초안」을 쓴다.
- **E가 아닌 파일(가져가지 않음)**: `ContactDbLeads.tsx`, `model.ts`, `lib/query/db-sheet-hooks.ts`, `tests/components/db-sheet-hooks.test.ts`는 A 것이다.

### 3. belie 결정과 코드 연결
- **⑥ 공급처별 비용 열**
  - 기본안: 1차에는 넣지 않는다. 지금 코드 그대로 간다.
  - 「지금 넣는다」를 고르면 아래를 바꾼다. 화면이 바뀌므로 변경 목업을 belie에게 먼저 보인다.
    1. `page.tsx`: `useDBOverview()`(`lib/query/db-hooks.ts:44-52`, 응답 `purchases` = `lib/service/db.ts:71-72`)를 읽는다.
       `업체명` → `{spend: Σ 개당단가×주문개수, count: Σ 주문개수}` Map을 만든다(`lib/types/db.ts:9-15`, 부가세 제외 값). 원래 글자 그대로 맞춘다(필터와 같은 규칙).
    2. `supplier-summary.ts`: `summarizeSuppliers(leads, range, costs?)`에 인자를 하나 더한다. `SupplierRow`에 `spend: number|null`를 더한다.
       DB 1건 값 = spend÷total, 계약 1건 값 = contracts>0일 때만 spend÷contracts, 아니면 「—」. 직접생산과 이름이 안 맞는 곳은 null이다.
    3. `SupplierSummary.tsx`: 머리(`:126-133`)와 `TableRow`(`:76-78`)에 열 2개를 더한다. 카드 셋째 줄(`:86`)에 「DB당 N원」을 더한다.
       title은 「구매목록 업체명과 공급처 이름이 같을 때만 보여요」로 한다.
    4. 테스트에 이름이 맞을 때, 직접생산 「—」, 계약 0 「—」 경우를 넣고 `components.md`를 갱신한다.
    - 위험: DB관리시트를 열 때마다 `/api/db`가 시트 존재 확인 읽기(`lib/service/db.ts:141-144`)를 한다.
      구매일 기간과 유입일 기간을 어떻게 맞출지도 정해야 한다. 그래서 권장안은 「2차」다.
  - 「2차」를 고르면 이 PR은 그대로 낸다. 별도 카드에서 가져오기·직접 입력의 공급처 칸을 「구매목록 업체명에서 고르기」로 바꾼 뒤 위 1~4를 한다.
- **⑦ 토글 위치**
  - 기본안: 도구 줄 버튼(`page.tsx:35`), 지금 코드다. 1280px에서 도구 줄이 두 줄이 되는 것(목록이 약 40px 내려감)을 받아들인다는 뜻이다.
  - 「목록 위 한 줄 띠」를 고르면 아래를 바꾼다. 변경 목업을 먼저 보인다.
    1. `page.tsx:35`의 「공급처별 보기」 버튼을 지운다. 도구 줄이 다시 한 줄이 된다.
    2. `page.tsx:39`의 `summaryOpen&&`를 지워 늘 렌더한다. `open={summaryOpen}`와 `onOpen={()=>toggleSummary(true)}`를 넘긴다.
    3. `SupplierSummary.tsx`에 `open`·`onOpen` prop을 더한다. `!open`이면 `<button aria-expanded="false" aria-controls="db-supplier-summary">`인 한 줄
       「공급처별 성과 · {headlineText(summary.headline)} [펼치기]」만 그린다. 불러오는 중·실패·빈 목록이면 요약 없이 「공급처별 성과 [펼치기]」만 그린다.
       펼친 상태의 「닫기」(`:156`)는 「접기」(`aria-expanded="true"`)로 바꾼다.
    4. `db-sheet.css:116`: `body.db-sheet-route .sheet-supplier-strip{padding:8px 16px;background:#f8fafc;border-top:1px solid #e2e8f0}`를 더한다.
       쓰지 않게 된 `.sheet-btn.is-on` 규칙은 지운다.
    5. `db-sheet-supplier-summary-ui.test.ts:109-117`(도구 줄 안 토글 검사)을 띠 검사로 바꾼다. 접힌 띠 렌더와 펼치기 테스트를 더하고 `components.md` 「위치·열기」를 고친다.
    - 딥링크 `?view=suppliers`와 저장값 `'1'/'0'`의 뜻은 그대로다.
- **(번호 없음) 유입 경로 범위**: 기본안은 DB관리시트만이다. 소개처별 비교는 lead-chain 트랙이 맡는다. 이 PR은 바뀌지 않는다.
- **숫자 기준**: 표본 20은 `supplier-summary.ts:9`, 처음 8곳은 `:11`이다.
  바꾸면 `db-sheet-supplier-summary.test.ts:80,85-100,110-122`와 목업 `few`·`many` 시나리오도 함께 고친다.

### 4. 승인 후 순서
1. **승인 기록**: 수용 기준 「목업 belie 승인」에 날짜, 근거(belie 답), 목업 기준 SHA `ecf241c2`, 승인 페이지 링크, ⑥·⑦ 답을 적고 체크한다.
2. **작업 자리**: 자기가 만든 항목 worktree만 머지·배포 뒤 정리한다. 남의 worktree는 건드리지 않는다. 상한(12)은 `<main>/wt`만 세는 경고다(check.sh:64-89).
   ```powershell
   $main = "C:/Users/Belief-desktop/Desktop/개발프로젝트/경영일지"
   $wt   = "C:/Users/Belief-desktop/Desktop/개발프로젝트/_wt/salespt-log/db-sheet-supplier-summary"
   git -C $main fetch origin
   $bak = git -C $main log -1 --format=%H --grep "handoff-backup" origin/feat/dashboard-followups
   git -C $main worktree add $wt -b feat/db-sheet-supplier-summary origin/master
   ```
3. **파일 옮기기**: 먼저 `git diff b51d04b8 origin/master -- <§2 E 전용 파일들>`이 비었는지 본다. E 전용 파일은 `git checkout ecf241c2 -- <§2 파일들>`로 가져온다(plan 제외). 공용 파일은 §2대로 E 줄만 옮긴다. plan은 `git checkout $bak -- docs/plans/active/db-sheet-supplier-summary.md`.
   A가 이미 master에 들어갔다면 `lib/types/db-sheet.ts`는 통째로 가져와도 된다(내용이 같다).
4. ⑥·⑦이 기본안이 아니면 §3대로 바꾸고 변경 목업(375/1280 캡처)을 belie에게 먼저 보인다(workflow.md 「승인한 화면이 달라지면 변경 목업 먼저」).
5. `Set-Location $wt; npm ci`를 하고 §6 검사를 모두 돌린 뒤 `npm run build`를 한다.
6. **목업 재확인**: §6 목업 명령으로 375/1280, 시나리오 4개를 본다. 줄 누르기, 기간 변경, 미컨택 → 컨택진행 저장 직후 반영도 본다.
   E 서버·fixture는 이 PR에 들어 있으므로 커밋한 PR head에서 그대로 찍는다. 스크린샷과 DOM 스냅샷을 PR에 붙인다(head SHA 포함).
7. **독립 검증**: 계산·공용 계약·저장 응답이 바뀌므로 작성자와 다른 검증자가 필수다(`docs/playbooks/codex-reviewer.md`). README §4 「독립 검증」의 방법·템플릿을 쓰고, **현재 PR head에 대한 PASS 없이는 머지하지 않는다.**
8. **PR 열기**
   - 제목: `feat(db-sheet): 공급처별 성과 보기`.
   - 본문에 「투영 계약 변경 — `tests/api/db-sheet.test.ts:66-67`, `tests/service/db-sheet-status.test.ts:43-44·66-67`은 funnel 필드가 더해진 것(약화 아님)」을 적는다.
   - squash 본문에 `Changelog: DB관리시트에서 공급처마다 상담·미팅·계약까지 얼마나 이어졌는지 한눈에 비교할 수 있어요.`를 넣는다.
     `lib/config/anchors.ts`에 db-sheet 키가 없으므로 앵커는 넣지 않는다.
9. **머지**: CI가 초록이면 직전 `git rev-parse origin/master`를 기록하고 squash merge한다. 한 번에 하나만 머지하고 #1131 등 다른 PR과 동시에 하지 않는다. 그다음 §7 확인을 한다.
10. **배포 뒤 정리**: 이 문서에 배포 SHA, run id, 확인 결과를 적고 `docs/plans/completed/`로 옮긴다. 이 이동은 따로 PR을 만들지 않고 다음 항목 PR에 함께 넣거나 마지막 문서 PR 1개로 묶는다(README §6-6). 문서만 PR도 pre-commit이 check.sh를 돌리므로 `npm ci`가 필요하다(build는 생략·NOT_RUN 기록).
    `docs/worklog.md` 맨 위 「워크로그 초안」은 이 E PR에 넣는다. 자기 worktree는 README §5 「worktree 정리」 명령으로 정리한다.

### 5. PR 나누기와 머지 순서
- E는 PR 하나로 낸다(서버 투영 + 화면). 서버만 먼저 내면 사용자에게 보이는 변화가 없다. 되돌리기는 squash 1개 revert면 된다(저장된 값 없음).
- A와는 `lib/types/db-sheet.ts`(다른 줄)와 `data-model.md`(이웃 줄)가 겹친다. 동시에 열려 있으면 나중에 머지하는 쪽이 rebase하고 check.sh를 다시 돌린다. A와 E의 순서는 상관없다.
- F(아직 구현 안 됨)가 `lib/types/db-sheet.ts`(PR-1), `lib/repo/db/db-sheet.ts`(PR-5 :114 `registerDbSheetMeeting`, PR-6b), `tests/repo/db-sheet.pglite.test.ts`(PR-6a·6b)를 고친다. 그래서 **E를 F PR-5보다 먼저** 머지한다(README §4·F plan §12와 같은 규칙). F PR-1과는 `lib/types/db-sheet.ts`의 다른 줄만 겹치므로, E가 결정 대기로 늦어지면 PR-1~4는 먼저 가고 나중 쪽이 rebase한다.
- B·C·D와는 코드가 겹치지 않는다(SSOT 문서만 겹침). PR #1131(세션 리플레이)과는 관계없다. 직렬 머지만 지킨다.

### 6. 검사 명령 (E worktree에서, PowerShell)
- `npx vitest run tests/service/db-sheet-status.test.ts tests/components/db-sheet-supplier-summary.test.ts tests/components/db-sheet-supplier-summary-ui.test.ts tests/components/db-sheet-autosave.test.ts tests/api/db-sheet.test.ts tests/repo/db-sheet.pglite.test.ts`
  - 2026-10-12 결과(`ecf241c2`): 104 passed. 나눈 PR에서는 실패 0으로 판정하고 건수는 새로 적는다.
- `npm run test:structural`: 레이어 검사와 `sheets-request-path-guard` 확인. 새 시트 호출이 없어야 통과한다.
- `& "C:/Program Files/Git/bin/bash.exe" scripts/check.sh`: 초록이어야 한다. doc-drift는 `SupplierSummary`와 `DbSheetFunnelStep` 등재로 통과해야 한다. 맨 `bash`·`npm run check`는 WSL로 가므로 쓰지 않는다.
- `npm run build`: 앱 코드가 바뀌므로 필수다. 목업 서버도 `.next` 폰트를 쓴다.
- 목업 서버 `tests/browser/db-sheet-supplier-server.mjs`는 README §5 「목업 서버」대로 **백그라운드로** 띄운다(watch 때문에 앞에서 돌리면 셸이 멈춘다. PORT를 읽는다 — 예: `$env:PORT="4520"`, 없으면 자동 포트, 3000·3100 피함). 로그에 `SEED_OK 98 leads …` 줄이 나와야 한다.
  출력된 `/db-sheet?view=suppliers`를 375·1280에서 연다. `&empty=1`·`&few=1`·`&many=1`·`&error=1`도 본다. 끝나면 자기가 띄운 PID만 `taskkill /PID <id> /T /F`로 끈다.
- `git diff --name-only origin/master...HEAD`: §2의 E 목록과 같아야 한다.
  A가 master에 아직 없다면 `git grep -n isDbSheetFollowUpResult -- lib app`가 비어 있어야 한다(A 코드가 섞이지 않았는지).

### 7. 배포 뒤 운영 확인 — 실데이터 쓰기 없음
1. `gh run list --workflow="Deploy to VPS" -L1`과 `gh run view <id> --json conclusion,status,headSha`를 본다. success이고 headSha가 squash SHA여야 한다.
2. `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online`과 `…/api/health`가 모두 200이어야 한다. 200만으로 새 버전이 성공했다고 쓰지 않는다.
3. 로그인 없이 `curl.exe -s -o NUL -w "%{http_code}" https://salesptlog.online/api/db-sheet`를 보낸다. 인증 오류 코드(401 계열)가 나오고 데이터는 나오지 않아야 한다.
4. 로그인된 운영 화면에서 `/db-sheet?view=suppliers`를 본다(belie 본인 계정, 보기만). 확인할 것:
   - 요약이 열린다.
   - 필터가 비어 있을 때 합계 「들어온 DB」 = 「DB 목록 N」이다.
   - 공급처 줄을 누르면 목록이 걸러지고 「총 N건」이 맞는다.
   - 브라우저 오류가 없다.
   - 컨택결과 기록, 가져오기, 직접 입력은 **하지 않는다**. 토글은 브라우저 저장값만 바꾼다.
   - Codex가 로그인할 수 없으면 belie에게 화면 확인을 부탁한다(선례: `docs/plans/completed/db-management-sheet-backend.md:42`).
5. `/dashboard`가 그대로인지 본다(카드 순서·높이, `ChannelPerformance`).

### 8. 위험과 알려진 동작
- 숫자는 대시보드와 일부러 다르다(위 「대시보드와 다른 점」). 각주가 알려 준다. 둘을 맞추려고 어느 쪽도 고치지 않는다.
- GET·POST 응답에 `funnel` 필드가 하나 더 붙는다. 다른 사용처(`ContactDbLeads`, A의 대시보드 카드)는 이 필드를 무시한다.
  배포 중 옛 응답을 받으면 `funnel`이 없고, 그 행은 유입으로 셈한다(깨지지 않음).
- `save()` 응답 변경은 트랜잭션 파일 안이지만 응답에만 붙는다. `tests/repo/db-sheet.pglite.test.ts:102-117`이 저장 행·이력에 투영 키가 없음을 지킨다.
- 공급처는 자유 글자다. 「디비딩」과 「디비딩 」은 두 줄로 보인다(필터와 같은 규칙).
- `?view=suppliers`로 들어와 닫은 뒤 같은 주소를 새로고침하면 다시 열린다(딥링크가 이긴다). 의도한 동작이다.
- 기존 결함은 범위 밖이다. 따로 작은 수정으로 다룬다.
  - `Grid.tsx:24,38`에 서버가 더 이상 만들지 않는 `실무진행`이 남아 있다.
  - `page.tsx:23`의 `db-sheet-v3-columns` 저장은 try/catch가 없다.
- 워크트리: 자기가 만든 항목 worktree만 머지·배포 뒤 정리한다. 남의 worktree는 건드리지 않는다. 상한(12)은 `<main>/wt`만 세는 경고다(check.sh:64-89 — 지금 그 폴더에 옛 폴더까지 36개라 경고가 늘 뜬다. 경고일 뿐이다).

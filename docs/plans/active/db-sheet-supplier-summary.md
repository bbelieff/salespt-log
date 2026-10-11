> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리시트 「공급처별 보기」(유입 경로 #10) — 공급처마다 들어온 DB → 상담 → 미팅 → 계약을 한 줄로 비교하는 패널의 범위·규칙·검수 반영·목업 확인법을 적은 작업 계획.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `app/(app)/db-sheet/page.tsx` · `_components/SupplierSummary.tsx` · `_components/supplier-summary.ts` · `_components/use-db-sheet.ts` · `db-sheet.css` · `lib/service/db-sheet-status.ts`(dbSheetFunnelStep) · `lib/repo/db/db-sheet.ts`(단계 상수·save 응답) · `lib/types/db-sheet.ts`(DbSheetFunnelStep · DB_SHEET_MEETING_STAGE)
> - **읽고 나면 알 수 있는 것**: 숫자를 어떤 규칙으로 세는지 · 대시보드 숫자와 왜 다를 수 있는지 · 목업을 어떻게 열어 확인하는지
> - **관련 문서**: [components.md DB관리시트 SupplierSummary](../../design/components.md) · [data-model.md DbSheetFunnelStep](../../domains/data-model.md) · [db-management-sheet-backend.md](../completed/db-management-sheet-backend.md) · [contract-count-exclude-terminated.md](../completed/contract-count-exclude-terminated.md)

# DB관리시트 공급처별 성과 (db-sheet-supplier-summary, 2026-10-12)

## 범위
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
- `node tests/browser/db-sheet-supplier-server.mjs` → 출력 주소(`/db-sheet?view=suppliers`). 실제 route → service → repo 를 PGlite 에서 돌리고,
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

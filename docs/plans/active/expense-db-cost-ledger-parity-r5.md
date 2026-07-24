---
slug: expense-db-cost-ledger-parity-r5
status: active
created: 2026-07-24
owner: belie
feature_owner: CODEX-DEV-C
track: EXPENSE-DB-COST-LEDGER-PARITY-R5
base_sha: 4325e89ead1e18ee714f326634964b406f3a3f44
---

# DB 자동 비용 원장 정합

`03 DB관리`의 매입DB·직접생산·현수막 비용을 기존 쓰기 경로와 분리된 읽기 전용 시스템 행으로 비용 원장에 합친다. 데이터 원천은 `loadDBOverview(email)`이며, 이 함수가 제공하는 DB-primary + sheet union/fallback 및 row 중복 제거 계약을 그대로 사용한다. 대시보드의 비용·매출·영업이익 계산은 변경하지 않는다.

## 인식 규칙

- 매입DB는 `구매일`에 `주문금액`, 현수막은 `날짜`에 `주문금액` 전액을 한 번 인식한다.
- 직접생산의 시작일·종료일이 모두 유효하고 종료일이 시작일 이상이면 양끝 포함 일할 인식한다. 나머지 원은 앞선 날짜에 배정한다.
- 시작일은 유효하지만 종료일이 누락·비정상·시작일 이전이면 ADR-0022의 시작 시 비용 반영 결정에 따라 시작일에 `기간예산` 전액을 한 번 인식한다.
- 시작일이 누락·비정상이고 예산이 양수면 전체·카테고리에 `unallocated` 시스템 행으로 한 번 포함하고 월별에서는 제외한다.
- DB 금액은 원 단위로 반올림한 뒤 배분한다. 금액이 0 이하인 행은 비용 행으로 만들지 않는다.

## 동결 응답 계약

- 시스템 source: `db_purchase | db_production | db_banner`; 사용자 source: `one_time | recurring`.
- 모든 행은 `system`, `readOnly`, `recognitionStatus`, `recognitionNote`를 갖는다. 시스템 행은 항상 `system=true`, `readOnly=true`다.
- 상태는 `allocated | recognized_on_date | recognized_on_start | unallocated`다. 미배분 행의 `periodStart`와 `periodEnd`는 빈 문자열이다.
- 시스템 category id는 `system:db_purchase | system:db_production | system:db_banner`이고 이름은 `매입DB | 직접생산 | 현수막`이다. 편집 가능한 `categories`에는 시스템 항목을 넣지 않는다.
- `categoryTotals`는 `amountWon`, `itemCount`, `sharePercent`, `system`, `archived`를 포함한다. 비중 분모는 `totalCost`이며 비용 내림차순, 이름 오름차순으로 정렬한다.
- `dbCostTotal + additionalCostTotal = totalCost`. `selectedScope`는 `{ view, month, categoryId, label }`이다.

## parser 선행 결함과 경계

기존 공용 직접생산 parser는 종료일이 빈 신규 I:O 행을 legacy로 오인해 예산을 잘못 읽었고, 시작일이 잘못된 양수 비용 행을 service 이전에 제거했다. `parseProductionRow`의 신규 배치 판별과 `isProductionMeaningful`의 비용 행 보존만 최소 수정한다. 다른 DB repo·쓰기·UI·hook은 범위 밖이다.

## 검증

- parser: 완료·생산중·비정상 종료일·누락/비정상 시작일·legacy 회귀.
- 원장: 1,080,000원 전체 합계, 월 경계 일할, ongoing 시작일 인식, unallocated 월 제외, system/readOnly, 수동+반복+DB 합산, 카테고리 정렬·비중.
- 대시보드: DB 1,080,000 + 추가 0의 기존 산술 보존.
- targeted Vitest, `scripts/check.sh`, Next build, `git diff --check`를 실행한다.

## 구현 checkpoint

- DevD의 독립 계약 테스트 두 파일을 원본 SHA-256 그대로 통합했다.
- 독립 14/14, 전체 targeted 40/40, `scripts/check.sh` 824/824, structural 10/10, lint/typecheck/file-size/doc-drift가 통과했다.
- Next production build는 69/69 static page 생성까지 통과했다. 다음 단계는 DevD의 exact-SHA 독립 VERIFY다.

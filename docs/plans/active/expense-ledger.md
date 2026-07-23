---
slug: expense-ledger
status: active
created: 2026-07-23
owner: belie
feature_owner: CODEX-DEV-1
track: expense-ledger-pr1-data-api
base_sha: d4276761674bd78bda07efd4179a1cd29b0a61f2
---

# 비용 원장 PR-1: 데이터·API

기존 `03 DB관리` 자동 비용은 변경하지 않는다. 별도 Postgres 원장에 수동/월 반복 비용을 저장하며, 모든 범위는 서버가 로그인·대리보기 대상에서 해석한 `spreadsheet_id`로 제한한다.

## 확정 규칙

- 금액은 부가세 제외 원화 정수다. 기간 비용은 시작·종료일을 포함해 일할 인식하고, 나머지 원은 앞선 날짜에 배정한다.
- 카테고리는 재사용, 이름 변경, 보관을 지원한다. `(spreadsheet_id, normalized name)`은 고유이며 감사 행을 남긴다.
- 일회성 비용은 soft delete다. 반복은 월 단위이고 29~31일은 해당 월 말일로 clamp한다.
- 반복 중지는 `expense_recurring_pauses`의 구간으로 남긴다. 중지일부터 재개일 전까지는 materializer가 이후 재조회에도 발생을 만들지 않으며, 기존 occurrence는 변경하지 않는다.
- 이번 발생 수정은 occurrence snapshot만 바꾸고, 다음 발생부터 수정은 새 규칙을 만들어 원 규칙을 직전일에 닫는다.

## PR-1 범위와 다음 의존성

이 PR은 스키마, Zod, 소유범위 API, 일할 조회와 반복 materialization까지만 맡는다. 기존 DB 비용/매출/영업이익 카드의 합산과 UI는 DEV-3/DEV-2 범위다. 새 원장은 시트 탭이나 기존 03 DB관리 쓰기 경로에 폴백하지 않는다.

## 검증

- `npm.cmd run typecheck` 통과.
- 비용 배분, 2월 31일 clamp, pause interval, 요청 검증 단위 테스트를 추가했다.
- 이 sandbox에서는 Vitest가 workspace 상위 디렉터리 접근 거부 및 `vitest.config.ts` 해석 실패로 실행되지 않는다. DB 통합 테스트는 DATABASE_URL을 쓰지 않아 이 환경에서 수행하지 않았다.

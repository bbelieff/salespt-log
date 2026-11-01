---
status: completed
slug: payment-unlimited-work-items
created: 2026-10-31
owner: belie
completed: 2026-10-31
---

> **이 문서는**: 실무진행(진행건) 개수 제한 없애기 계획·결과. 읽는 대상: 개발자. 관련: [data-model](../../domains/data-model.md) `ContractPayment`, `lib/analytics/contract-slots.ts`.

# 실무진행 무제한

## 목표·수용조건
- 실무/수납에서 「진행 추가」를 몇 번이든 누를 수 있다(전에는 3회차까지).
- 진행 4번부터도 저장·새로고침 뒤 그대로 보이고, 승인·수납 합계·기간 매출·대시보드 매출·업무 현황·오늘 챙길 일·할 일 연결·내보내기에 들어간다.
- 진행 1~3 저장 자리(시트 M~AH)와 옛 계약은 바꾸지 않는다.

## 설계
- `ContractPayment.추가진행?: PaymentSlot[]` — 진행 4 = 배열 0번. DB JSONB 확장(`USER_AREA_KEYS`), 시트 열 없음.
- 번호 접근은 한 곳: `slotsOf`·`slotOf`·`withSlot`·`withoutSlot`·`slotCount`(contract-slots). `SlotNo` = number.
- Todo `slot`(Q 칸)·주소 `?slot=`·API 검증은 1 이상의 정수.
- 시트를 정본으로 읽는 옛 기수(1·2·3·5기 등)는 진행 4번부터 저장을 막는다(다시 읽히지 않으므로).

## 범위 밖
- 시트 백업에 4번부터 열 추가(시트는 미러·백업, 새 동기 Sheets 호출 금지 규칙).

## 검증
- 단위: tests/components/payment-unlimited-slots.test.ts, write-gate 차단, todo Q 칸·주소 번호.
- 합성 화면: tests/browser/payment-live(업체 1곳에 진행 4) — 목록·상세·진행 추가·저장 payload.

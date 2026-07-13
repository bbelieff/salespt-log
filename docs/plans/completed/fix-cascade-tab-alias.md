---
status: completed
slug: fix-cascade-tab-alias
created: 2026-06-02
completed: 2026-06-02
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 계약카드 삭제 시 "Unable to parse range: '02 계약수납관리'!C26:D26" 에러 — 6기 legacy 탭 alias 미처리 bugfix
> - **누가 읽나요**: 개발자

# fix-cascade-tab-alias

## 사용자 보고 (2026-06-02)
투두까지 기록한 업체 내용을 삭제하려고 하는데 삭제가 안 되고 `Unable to parse range: '02 계약수납관리'!C26:D26` 에러 발생.

## Root Cause
`lib/service/contract-payment.ts:removeContractPaymentWithCascade` 의 단계 1)
(삭제 전 cascade key 읽기) 에서 `SHEET_RANGES.contractPayment.tab` 을 하드코딩
→ 6기 양식 시트(`02 계약관리` 탭)에서 `'02 계약수납관리'!C26:D26` 쿼리 → "Unable to parse range".

`clearRow` 는 `resolveLayout()` 을 경유해 올바른 탭을 쓰는데, 그 위 C:D 읽기만 하드코딩이었음.

## Fix
- `lib/repo/contract-payment.ts` 에 `readContractCascadeKey(spreadsheetId, row)` 신규 export.
  resolveLayout 경유 → 7기(`02 계약수납관리`) / 6기(`02 계약관리`) 자동 분기.
- `lib/service/contract-payment.ts:removeContractPaymentWithCascade` 가 신규 함수 호출.
  `SHEET_RANGES` / `sheetsClient` 직접 import 제거 (Sheets 격리 원칙 강화).

## Acceptance
- [ ] 6기 양식 시트 계약카드 삭제 시 에러 없음
- [ ] 7기 양식 삭제도 정상
- [ ] check.sh 통과

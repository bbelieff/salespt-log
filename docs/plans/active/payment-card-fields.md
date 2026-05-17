---
slug: payment-card-fields
status: active
created: 2026-05-17
worktree: ../wt/pay-fields
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수납카드 필드 — 현황 → 실무진행 리네임 + 로드맵메모(AE) + 메모사항(AF) 추가
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: payment 탭 ContractRow / PaymentSlotForm

# payment-card-fields — [4]

## 사용자 요청 (2026-05-17)
"수납카드 필드 추가/리네임 (3 sub-items): 실무진행 리네임 + 로드맵 메모 2 ROW + 메모사항 1 ROW"

## 변경 (3 sub-items)

### 1. 실무진행 리네임 (UI 라벨만, schema 무손상)
- `PaymentSlotForm.tsx` — 슬롯의 "현황" 라벨을 "실무진행" 으로 변경
- schema 의 `현황` 필드명·시트 컬럼은 그대로 유지 (역호환)

### 2. 로드맵메모 추가 — 시트 AE (column index 30)
- `ContractPayment` schema: `로드맵메모: z.string().default("")`
- repo rowToCP/cpToRow: idx 30 매핑
- UI: `ContractRow` 액션 직전, 2-row textarea

### 3. 메모사항 추가 — 시트 AF (column index 31)
- `ContractPayment` schema: `메모사항: z.string().default("")`
- repo: idx 31 매핑
- UI: `ContractRow` 1-row input

### Range 확장
- `readAll`: `A:AD` → `A:AF`
- `updateUserFields`: `F:AD` → `F:AF`, slice(5,30) → slice(5,32)
- `clearRow`: `C:AD` → `C:AF`

## 시트 헤더 (사용자 작업 필요)
- 02 계약수납관리 row 1 (헤더) 에 AE/AF 컬럼명 추가 필요 (사용자 시트 템플릿 작업)
- 없어도 동작은 OK (빈 값으로 저장됨), 다만 시트에서 컬럼 의미가 안 보임

## Acceptance
- [ ] 수납 슬롯 라벨 "현황" → "실무진행"
- [ ] 카드 펼침 시 로드맵메모 (2 row) + 메모사항 (1 row) 보임
- [ ] 입력 → 저장 → 시트 AE/AF 에 기록
- [ ] check.sh 통과

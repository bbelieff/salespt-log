---
slug: payment-card-restructure
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수납카드 재구성 — 로드맵=카드위, 메모=슬롯별, 진행내용 라벨
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: payment 탭 ContractRow + PaymentSlotForm + 시트 컬럼 AE~AH

# payment-card-restructure

## 사용자 요청 (2026-05-17)
"로드맵은 개별 업체의 모든 수납기관에 대한 로드맵이니 수납현황 위에. 메모는 각 수납박스 내에 진행기관 다음에. 실무진행 → 진행내용"

## 슬롯 카드 새 구조
```
수납N
[진행도 슬라이더]
[진행기관]
[메모]                ← NEW per-slot
[진행률] [진행내용]   ← 실무진행 → 진행내용 라벨
[승인금액] [수납일] [수납액]   ← 3 col
[수납 추가]
```

## 변경
- **Schema** (`lib/types/index.ts`):
  - PaymentSlot: 메모 필드 추가 (7필드)
  - ContractPayment: 메모사항 제거 (옛 AF 카드 차원, 사용자 의도와 어긋남)
- **Repo** (`lib/repo/contract-payment.ts`):
  - 시트 컬럼 매핑: AE=로드맵메모, AF=수납1.메모, AG=수납2.메모, AH=수납3.메모
  - 배열 길이 32 → 34, range A~AF → A~AH, slice(5,32) → slice(5,34)
  - `slot(start, memoCol)` helper 로 메모 컬럼 분리 read
- **UI** (`PaymentSlotForm.tsx`):
  - "실무진행" 라벨 → "진행내용"
  - 진행기관 다음 메모 input (full width)
  - 진행률+진행내용 (2 col), 승인금액+수납일+수납액 (3 col)
- **UI** (`ContractRow.tsx`):
  - 로드맵 메모 — 카드 차원, 수납 현황 **위**에 amber 박스
  - 옛 메모사항 박스 제거
- **SSOT** (`data-model.md`) 갱신

## 시트 헤더 (사용자 작업)
- 02 계약수납관리!1행: AE=로드맵메모, AF=수납1메모, AG=수납2메모, AH=수납3메모 추가
- 기존 데이터: AE 는 그대로 (로드맵), AF 옛 메모사항 → 수납1메모로 자동 재해석 (재배치 충격 없음, 새 컬럼)

## Acceptance
- [ ] 슬롯 카드 새 구조대로 렌더
- [ ] 로드맵 메모 = 수납 현황 위
- [ ] 라벨 = 진행내용
- [ ] check.sh 통과

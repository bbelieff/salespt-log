---
slug: payment-master-detail-connected
status: active
created: 2026-06-04
owner: belie
related: payment-master-detail, practice-payment-polish
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 데스크탑 마스터-디테일에서 선택 카드와 우측 상세 패널이 **같은 진행상태색 하나의 윤곽선(탭처럼)**으로 이어지게. 강조색을 고정 blue → 카드 상태색(teal/cyan/fuchsia/green/slate)으로.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/page.tsx`, `_components/ContractRow.tsx`, `_lib/contractAccent.ts`(신규)
> - **읽고 나면 알 수 있는 것**: 연결 윤곽선 CSS 기법, 상태색 패밀리 공유, bare 모드
> - **관련 문서**: [[docs/plans/active/payment-master-detail]], [[docs/design/tokens]]

# 마스터-디테일 "이어지는 윤곽선" + 상태색 (시안 확정)

## Intent
시안 확정: 선택 카드가 우측 패널에 붙은 **탭처럼 하나의 윤곽선**. 색은 그 카드의 **진행상태색**이라 "한 덩어리"로 읽힘. 기존 master-detail(#271)·중복박스 제거(#277·[A])는 완료 — 본 작업은 **연결 윤곽선 + 상태색** 마감.

## 변경
- **`_lib/contractAccent.ts`(신규)**: `contractAccentFamily(cp)`(완료 green / 활성 teal·cyan·fuchsia / 전 slate) + `ACCENT` 클래스맵(border/tint/leftBar, 전부 표준 토큰). page·ContractRow 공유 → 선택카드·패널 색 일치.
- **`ContractRow`**:
  - 강조색을 `accentFamily ?? contractAccentFamily(draft)` 로(고정 blue 제거). open/닫힘/좌측바 모두 상태색.
  - `[C]` 모바일 open = 상태색 2px 테두리 + 헤더 동일색 틴트 + border-t 없음(이미) + 부드러움. 닫힘 평평+좌측 상태바.
  - `bare` prop: 자체 테두리/라운드/그림자 생략(데스크탑은 page 가 윤곽선 소유). `accentFamily` override. `selected`→`aria-current`.
- **`page.tsx`(데스크탑 `[B]`)**: grid→flex(좌 `w-56` 목록 / 우 flex-1 상세).
  - 선택 카드: `border-2 selAccent + border-r-0 + rounded-l-xl + -mr-0.5 + z-10` → 패널 왼쪽 테두리에 맞물림.
  - 패널: `border-2 selAccent + rounded-r-xl`(왼쪽 각짐) + `sticky top-24`.
  - 비선택 카드: 회색 테두리 + `mr-1` 간격으로 대비.
  - `selAccent = ACCENT[contractAccentFamily(selectedCp)]` → 선택 바뀌면 색도 그 카드 상태색.
- 저장·삭제·슬롯·todo 로직 보존. transition-all 200ms.

## Acceptance Criteria
- [ ] 데스크탑: 좌 클릭→우 상세, 선택 카드+상세가 **같은 상태색 하나의 윤곽선**으로 이어짐.
- [ ] 색이 카드 진행상태(teal/cyan/fuchsia/green/slate)에 따라 자동, 선택 변경 시 추종.
- [ ] 모바일 아코디언 유지 + open 시 상태색 한 덩어리(회귀 0).
- [ ] 중복 업체정보 박스 없음(#277 유지).
- [ ] 토큰 외 arbitrary value 없음. `npm run check` 통과.

## 범위 밖
- 데이터 모델·02 구조 변경, 신규 색 토큰.

## Log
- 2026-06-04 구현. _lib/contractAccent + ContractRow bare/accentFamily + page flex 연결 윤곽선.

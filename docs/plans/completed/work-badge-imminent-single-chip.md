# 실무/수납 D-day 배지 — 대표는 가장 임박한 할 일, 칩은 하나

- 목적: belie 2026-11-18 ① 「진행건이 복수인 경우 어떤 진행건을 D데이로 올릴 건지는 더 임박한 건으로」 ② 「히스토리·투두를 써 놓고 H+00·D+00 써 놓는 건 정보 과다」. 관련: [components](../../design/components.md) ContractListTable·WorkActivityBadge.

## 확인한 것
- 업체 카드 대표 진행건을 목록 정렬 순서(미지정 → 연체 → 오늘 → History → 미래 Todo)로 골라, 진행 1의 History(H+28)가 진행 2의 앞으로 올 Todo(D-06)를 가렸다.

## 수용 조건
- 진행건이 여럿이면 업체 카드 D-day = 미완료 Todo 중 날짜가 가장 이른 진행건. Todo 가 없으면 전과 같다(미지정 → 오래된 History).
- 중도중지 진행건을 대표에서 빼는 규칙, 목록 「D-day순」 정렬 순서는 그대로.
- 배지는 `H+28`·`D-06`·`D?` 칩 하나. 「History/Todo」 글자 칩 없음. 설명은 title·aria-label.

## 변경
- `payment-progress.ts` `compareRepresentativeActivity` 추가, `company-work-view.ts`·`institution-view.ts` 대표 고르기에 사용.
- `WorkActivityBadge.tsx` 종류 칩 제거(업체 목록·진행기관 목록·계약 줄·진행건 제목 줄 공통).

## 검증
- `payment-company-work-view`·`payment-institution-view`·`payment-contract-list-table` 시험, 실제 브라우저(합성 값), `bash scripts/check.sh`, production build.

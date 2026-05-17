---
slug: weekly-summary-1row
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정·계약 SummaryBar 5 카운터 + 매출 1 row 통합
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: schedule SummaryBar

# weekly-summary-1row — [A2]

## 사용자 요청 (2026-05-17)
"주간매출합계와 활동합계를 한 바로 통합하고 row도 1줄만 사용"

## 변경
- SummaryBar 재구성: 5 카운터 + RevenueChip 단일 row
- 카운터 inline-flex (숫자 옆 라벨 작게)
- 매출은 우측 정렬 `ml-auto`, 흰 칩 안에 ₩X + 수임/수수료 작게
- mobile 좁을 시 `flex-wrap` 로 자동 줄바꿈
- height 절약: 4 row → 1 row (모바일 ~30px 절약)

## Acceptance
- [ ] 단일 row 표시
- [ ] 모바일에서 wrap 동작
- [ ] check.sh 통과

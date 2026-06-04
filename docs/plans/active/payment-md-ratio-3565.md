---
slug: payment-md-ratio-3565
status: active
created: 2026-06-04
owner: belie
related: payment-master-detail-connected
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 데스크탑 마스터-디테일 좌:우 비율을 약 2:8(w-56 고정) → 정확히 3.5:6.5(grid)로. 연결 윤곽선 보존.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/page.tsx`
> - **관련 문서**: [[docs/plans/completed/payment-master-detail-connected]]

# 마스터-디테일 비율 3.5:6.5

## Intent
좌 목록이 `w-56`(224px) 고정이라 약 2:8 — 좌 카드가 좁아 텍스트 줄바뀜. 좌:우를 3.5:6.5 로 키워 좌 카드 가독성↑.

## 변경 (payment/page.tsx)
- 컨테이너 `flex items-start` → `grid items-start` + `style={{ gridTemplateColumns: "3.5fr 6.5fr" }}` (요약카드 139줄과 동일한 인라인 grid 패턴 — arbitrary class 회피). gap 0 → seam 연결 유지.
- 좌 컬럼: `w-56 shrink-0` 제거 → `min-w-0`(grid 3.5fr 가 폭 결정, truncate 안전).
- 우 패널: `flex-1` 제거(grid 6.5fr 가 폭 결정). `sticky top-24`·상태색 `border-2`·`rounded-r-xl`·`min-w-0` 보존.
- 연결 overlap(선택카드 `-mr-0.5 border-r-0 rounded-l` ↔ 패널 `rounded-r border-2`)·비선택 `mr-1` 간격 그대로.

## Acceptance Criteria
- [ ] 데스크탑 좌:우 ≈ 3.5:6.5, 좌 카드 넓어져 줄바뀜 거의 없음.
- [ ] 선택카드↔상세 하나의 상태색 테두리 연결 유지.
- [ ] 모바일 아코디언 회귀 0. `npm run check` 통과.

## 범위 밖
- 색·연결 로직·모바일 변경.

## Log
- 2026-06-04 flex→grid 3.5fr/6.5fr.

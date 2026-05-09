---
slug: mobile-overflow-tabbar
status: active
created: 2026-05-09
worktree: ../wt/mobile-fixes
---

# fix(mobile): DB 날짜 input 오버플로 + TabBar 양끝 모서리 잘림

## 1. DB관리 RowForm 날짜 input
`app/(app)/db/_components/RowForm.tsx`: 부모 div `min-w-0`, date 타입에 `appearance-none` 추가.
PaymentSlotForm 과 동일 패턴.

## 2. TabBar safe-area-inset
`components/TabBar.tsx`: `padding{Left,Right,Bottom}: env(safe-area-inset-*)` 추가.
iOS 라운드 디스플레이 양끝 탭 잘림 + 홈 인디케이터 영역 침범 방지.

`app/(app)/layout.tsx`: main `padding-bottom: calc(76px + env(safe-area-inset-bottom))` —
TabBar 가 safe-area 만큼 커진 만큼 컨텐츠도 추가 패딩.

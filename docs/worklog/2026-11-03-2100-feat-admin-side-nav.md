## 2026-11-03 · 관리자모드 PC 왼쪽 메뉴
- feat/admin-side-nav. belie 「풀사이즈시 관리자모드도 사이드탭으로」 → 「사이드탭 권장대로 진행하고 PR 병합·배포까지」.
- 담당 파일: `components/auth/AdminSideNav.tsx`·`lib/service/admin-pending.ts`(신규, service index export), `app/admin/layout.tsx`, 관리자 화면 머리줄(`app/admin/page.tsx`·`arena/page.tsx`·`popup/page.tsx`·`users/_components/UsersRoster.tsx`·`UsersSkeleton.tsx`, `components/auth/AdminUserPicker.tsx`·`CohortMgmtPanel.tsx`·`TrainerMgmtPanel.tsx`), `docs/design/components.md`, 시험 1개, [plan](../plans/completed/admin-side-nav.md). 선행 = #1301(병합됨).
- 1024px+ 에서만 메뉴. 승인 대기 수는 홈 카드와 같은 registry 캐시 — 실패하면 0으로 두고 화면은 뜬다. 캡쳐용 전광판·공유왕은 메뉴 없음.
- 검증: 합성 화면 1280·1024px(메뉴·격자 2열·머리줄 숨김), 375px(메뉴 숨김·머리줄 그대로, 가로 밀림 없음). 실제 운영 화면은 배포 뒤 확인.
- docs/design/preview.html 은 관리자 화면 미수록이라 갱신 없음.
- 되돌리기 = squash revert.

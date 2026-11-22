> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리(STEP 2) 화면에서만 사이드탭 모양이 달라지던 옛 CSS 를 걷어내 STEP 1·3·4 와 같게 맞춘다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/db-sheet/db-sheet.css`, `components/desktop/DesktopNav.tsx`, `app/globals.css`
> - **읽고 나면 알 수 있는 것**: 무엇이 달랐는지, 왜 생겼는지, 재발을 어떻게 막는지
> - **관련 문서**: [PC 머리줄 한 줄](pc-header-one-row.md)

# DB관리 화면 사이드탭 일관성

belie(2026-11-22): 「DB관리 탭은 사이드바가 STEP 1,3,4 랑 다른 폼으로 되어 있다 — 일관성 유지」.

- 원인: `db-sheet.css` 에 STEP 1.5 「DB관리시트」 시절(하위 메뉴) 규칙이 남아, `body.db-sheet-route` 일 때만 사이드탭을 다시 칠함.
  - 머리 칸 60px(다른 화면 48px — PC 머리줄 한 줄 정리 후 본문 줄과 어긋남), STEP 줄 여백·글자 칸 58px 가운데 정렬, STEP 2 줄 글자 크기·여백, 지금은 없는 아이콘 클래스(db-nav-icon·db-step-badge).
- 조치: 해당 규칙 전부 삭제 → 사이드탭은 `globals.css` 의 공통 규칙만 따름.
- 재발 방지: `tests/structural/route-css-no-sidebar-override.test.ts` — globals.css 밖 CSS 에 `.desktop-nav` 규칙이 생기면 실패.
- `tests/browser/db-sheet/*` 의 옛 가짜 화면(STEP 1.5)은 수동 시험 도구라 이번 범위 밖.
- 되돌리기: squash revert 1번.

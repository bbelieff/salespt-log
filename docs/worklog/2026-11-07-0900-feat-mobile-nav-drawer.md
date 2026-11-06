> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 폰·태블릿 하단 탭을 없애고 사이드탭을 덮는 서랍으로 바꾼 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 앱 셸 메뉴(DesktopNav · TopHeader 배너)
> - **관련 문서**: [계획](../plans/completed/mobile-nav-drawer.md) · [ADR-0036](../decisions/0036-mobile-nav-drawer.md)

# 2026-11-07 feat(nav): 1024px 미만 하단 탭 → 덮는 사이드탭 서랍

- belie 요청. 담당 파일: components/desktop/DesktopNav.tsx · components/desktop/mobile-nav.ts(신규) · components/TopHeader.tsx · app/(app)/layout.tsx · app/globals.css · tests/components/desktop-nav.test.ts · desktop-glass-shell.test.ts · docs(ADR-0036, components.md §5).
- 손가락 밀기(belie 추가): document 터치 리스너 passive, 열기 판정 swipeIntent·제외 swipeBlocked(mobile-nav.ts), 시험 tests/components/mobile-nav-swipe.test.ts. 실제 브라우저 합성 터치로 375px 열림/닫힘·짧은·비스듬한 밀기 무시·1280px 무시 확인.
- 폭 분기는 CSS 만(matchMedia 금지 규칙 유지). 스크롤 잠금도 CSS `body:has(.desktop-nav[data-open=true])`.
- 사라지는 것: 하단 탭의 새 기능 점(dot). 화면 안 NEW 뱃지는 그대로. `TabBar.tsx` 는 `NAV_STEPS` 정본으로 남김(셸에서 렌더 안 함).
- 위험/복구: 셸 배치만, 데이터 무관. 되돌리기 = revert.

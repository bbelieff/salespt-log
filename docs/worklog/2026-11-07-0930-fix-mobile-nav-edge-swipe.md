> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 메뉴 서랍 왼쪽 끝 밀기가 브라우저 뒤로 가기로 새던 것을 막은 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 메뉴 서랍(#1349, ADR-0036)
> - **관련 문서**: [계획](../plans/completed/mobile-nav-edge-swipe.md)

# 2026-11-07 fix(nav): 왼쪽 끝 밀기는 뒤로 가기 대신 메뉴 서랍

- 담당 파일: components/desktop/DesktopNav.tsx · components/desktop/mobile-nav.ts · app/globals.css · tests/components/mobile-nav-swipe.test.ts · docs/design/components.md.
- touchstart 만 non-passive(왼쪽 24px·누를 수 없는 곳에서만 preventDefault), touchmove 는 passive 유지(PullToRefresh 스크롤 성능 규칙).
- 한계: iPhone 사파리·카카오톡 등 인앱 브라우저의 시스템 가장자리 뒤로 가기는 웹에서 완전히 막을 수 없을 수 있다 — 실제 기기 확인 필요. 홈 화면 앱(PWA)은 뒤로 가기 제스처 없음.
- 위험/복구: 제스처만. 되돌리기 = revert.

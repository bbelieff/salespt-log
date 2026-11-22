> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PC 학생 화면 위쪽 두 줄(로고·이름 줄 + 탭 이름 배너)을 한 줄로 줄이고, 로고·이름을 사이드탭 맨 위로 옮긴 작업 기록.
> - **누가 읽나요**: 개발자, 에이전트, belie
> - **어떤 기능·작업과 연결?**: `components/TopHeader.tsx`, `components/desktop/{DesktopNav,SideIdentity}.tsx`, `components/desktop/header-identity.ts`, `app/globals.css`(.desktop-shell)
> - **읽고 나면 알 수 있는 것**: 사이드탭 열림·닫힘에 따라 이름이 어디 보이나 · 계정 메뉴·역할 전환은 어디로 갔나 · 폰은 바뀌나
> - **관련 문서**: [components](../../design/components.md) · 목업 https://claude.ai/artifact/H82K8DFUChFFtM3uYQ2KKG

# PC 머리줄 한 줄 정리 (2026-11-22 belie 확정)

## 결정 (belie)
- 로고는 사이드탭이 열리든 닫히든 사이드탭에 둔다.
- 이름은 사이드탭이 열려 있으면 로고 옆 같은 줄, 닫혀 있으면 본문 배너의 탭 이름 앞에 — 늘 한 곳에만.
- 목업 2판(로고 | 이름 한 줄)으로 확정.

## 구현
- PC(.desktop-shell, 1024px+)에서 TopHeader 머리 줄 숨김 + `--app-header-height: 0`(배너·아래 sticky 가 그만큼 위로).
- 사이드탭 맨 위(SideIdentity): 로고 | 이름 · 점 / 접힘 = 앱 아이콘(`/icon`). 누르면 계정 메뉴(TopHeader 가 그대로 그림).
- 접힘이면 배너에 「이름 ›」(`.banner-identity`), 역할 전환은 배너 오른쪽(`.banner-role`).
- 사이드탭 맨 위 칸 높이 = 배너 높이(`pc:h-12`). 접힘의 펼치기 단추는 메뉴 첫 줄로.
- 폰(1024px 미만)·관리자·트레이너 화면은 그대로.

## 남은 일
- 앱 아이콘(파비콘) 새 시안을 고르면 `/icon` 이 바뀌어 접힌 사이드탭 아이콘도 같이 바뀐다(별도 작업).

## 검증
- [x] 관련 시험(헤더·사이드탭 11파일) + check.sh
- [x] 화면 확인 — 대시보드 화면 합성 서버(tests/browser/dashboard-followups-server.mjs)에서 1280px 열림·닫힘
- [ ] 운영 화면(belie)

## 되돌리기
squash revert 1번.

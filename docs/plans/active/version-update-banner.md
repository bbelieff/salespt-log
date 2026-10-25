> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 화면을 열어 둔 사이 운영 반영(배포)이 끝나면 아래 가운데에 「새 버전이 나왔어요 · 버전명 · 새로고침」을 띄우는 알림.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `next.config.mjs`(버전명), `app/api/version/route.ts`, `components/app-version/VersionUpdateBanner.tsx`, `app/(app)/layout.tsx`
> - **읽고 나면 알 수 있는 것**: 버전명을 어떻게 정하는지 · 언제 확인하는지 · 어디에 뜨는지
> - **관련 문서**: [deploy-vps](../../playbooks/deploy-vps.md) · 새소식 팝업(announcement-popup)

# 새 버전 알림 (2026-10-26 belie)

belie 지시: 「라이브 중 새 업데이트 운영반영이 완료되어 새 버전이 나오면 새로고침할 수 있게 중앙 하단에 새 버전 업데이트 되었다고 하고 버전명이랑 새로고침 버튼」.

- 버전명 = 빌드한 한국 시각 `YYYY.MM.DD-HHmm`(예 2026.10.26-1405). `next.config.mjs` 가 `NEXT_PUBLIC_APP_VERSION` 으로 화면 번들과 서버 코드에 같이 박는다(`APP_VERSION` 환경변수로 덮어쓰기 가능).
- `GET /api/version` → 지금 서버의 버전(no-store, 개인정보 없음, 로그인 불필요).
- 화면(`VersionUpdateBanner`, 로그인 후 화면 공통): 처음 1분 뒤 · 5분마다 · 탭/앱으로 돌아왔을 때 확인. 서버 버전 ≠ 화면 버전이면 알림.
  「새로고침」= 페이지 다시 불러오기. ×로 닫으면 그 버전은 이 탭에서 다시 묻지 않는다(sessionStorage). 운영 빌드에서만 확인한다.
- 위치: 모바일·태블릿 = 탭바와 오른쪽 아래 빠른 보기 버튼 위 가운데, PC = 화면 아래 가운데. 적층 50(빠른 보기 45 위, 모달 60 아래).
- 배포는 빌드 → 원자 교체 → pm2 reload 라, 새 서버가 뜬 뒤에야 새 버전을 돌려준다(반쯤 배포된 상태에서 새로고침을 권하지 않음).
- 시험: `tests/components/version-update-banner.test.ts`. 되돌리기: squash revert.

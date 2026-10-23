> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 「오늘 챙길 일」 카드를 영업생산성 상자 색으로 바꾸고, 지연이 있으면 사선 무지개 테두리로 강조하며, 대시보드 밖 화면 좌하단에 빠른 보기 버튼을 둔다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/dashboard/DashboardFollowUps*.tsx`, `FollowUpsLauncher*.tsx`, `useTodayFollowUps.ts`, `followups-table.css`, `followups-launcher.css`, `app/(app)/layout.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇을 바꿨나 / 강조 규칙 / 빠른 보기가 보이는 화면 / 확인·되돌리기
> - **관련 문서**: [dashboard-follow-ups](dashboard-follow-ups.md), `docs/design/components.md` §DashboardFollowUps

# 오늘 챙길 일 카드 옷 바꾸기 + 좌하단 빠른 보기 (2026-10-23, belie 승인 목업)

## 범위
1. 카드: 영업생산성 상자와 같은 indigo-50→purple-50 배경, indigo-200 테두리, 제목 indigo-900, 전체 숫자 purple-700 굵게. 표·행·동작 그대로.
2. 강조(사선 무지개): 경과·장기누락이 1건 이상일 때만 3px 테두리에 135° 무지개가 3.5초에 한 바퀴 흐른다. 배경·숫자 그대로. 움직임 줄이기 설정이면 멈춘 테두리. 규칙 = `hasOverdueFollowUps`.
3. 빠른 보기: 로그인 후 화면 좌하단 56px 원형 버튼 + 빨간 건수 배지(대시보드 전체 숫자와 같은 범위, 0이면 숨김). 누르면 버튼에서 원형으로 퍼지는 창(0.48s) — 긴급순 5건·열기·나머지 N건·대시보드에서 전체 보기. ×·Esc(초점 복귀)·바깥 누르기로 닫힘.
   - **belie 결정(2026-10-23)**: 대시보드에서는 숨김(카드가 이미 있음). 그 외 모든 로그인 화면에 표시.
   - 관리자 본인 화면(대리접속 대상 없음)은 숨김 — 조회할 수강생이 없다.
   - 조회는 대시보드 카드와 같은 훅(`useTodayFollowUps`)·같은 캐시, 새 API 없음. 화면의 첫 조회가 끝난 뒤 보조 조회(`meta.background`)로 시작해 전역 로딩 팝업을 띄우지 않는다.
   - 모바일·태블릿: 하단 STEP 탭바 위(안전영역 포함), 본문 아래 여백 +76px. PC: 사이드탭 오른쪽(펼침 240px / 접힘 84px), 본문 아래 여백 84px. 높이 고정 화면(DB관리시트, PC 실무/수납)은 여백 추가 없음.

## 확인
- 단위: `tests/components/follow-ups-launcher.test.ts`(강조 규칙·5건·열기/닫기/초점), `follow-ups-launcher-route.test.ts`(대시보드 제외).
- 실화면: `tests/browser/dashboard-followups-server.mjs` 합성 화면 1280·375 — 대시보드 카드, 실무/수납·일정 화면 빠른 보기.

## 되돌리기
squash 커밋 revert. 데이터·저장 변경 없음.

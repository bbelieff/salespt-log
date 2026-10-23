> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 모바일 대시보드에서 「오늘 챙길 일」을 첫 화면 맨 앞에 두는 순서 변경(PC 불변).
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `app/(app)/dashboard/page.tsx`, `components/dashboard/DashboardActionOverview.tsx`, `components/dashboard/dashboard-action-overview.css`
> - **읽고 나면 알 수 있는 것**: 무엇을 왜 바꿨는지 · PC 가 그대로인지 어떻게 확인했는지 · 되돌리는 법
> - **관련 문서**: [web-push-notifications](web-push-notifications.md) · [dashboard-follow-ups](dashboard-follow-ups.md)

# 모바일 대시보드 첫 시선 순서 (2026-10-23)

## 목표·결정
- belie 2026-10-23: 대시보드 첫 시선 후보 리스트업 → 실제 화면 목업 확인 → 「모바일만 이렇게 바꿔줘」.
- 모바일(<1024px): 날짜 띠 → **오늘 챙길 일** → 주간 목표 → 진행건 → 생산성 → 매출·비용 → 분석 차트. 주차(8주/9주)에 따라 순서를 바꾸던 규칙은 없앤다.
- PC(≥1024px): 지금 배치 그대로(매출·비용 맨 위 한 줄, 왼쪽 진행건+오늘 챙길 일, 오른쪽 생산성+목표).
- 「오늘 영업활동」 자리 카드는 목업에만 두었고 넣지 않는다(영업활동일 판정 연결 후 별도 결정).

## 구현
- PC grid 배치는 DOM 순서와 무관하므로 DOM 은 그대로 두고, 모바일만 CSS `order` 로 바꾼다. `.dashboard-action-work` 는 모바일에서 `display: contents` 로 풀어 오늘 챙길 일·진행건을 따로 배치한다.
- 페이지 컨테이너를 `space-y-3` → `flex flex-col gap-3` 으로, 매출·비용을 액션 영역 뒤로 옮기고 PC 에서만 `pc:order-first`.
- 한계: 모바일 화면 읽기 순서(DOM)는 진행건이 오늘 챙길 일보다 앞이다(시각 순서와 다름). PC 를 바꾸지 않기 위한 선택.

## 검증 (합성 데이터 미리보기 `tests/browser/dashboard-followups-server.mjs`, 실제 부품·글꼴)
- 모바일 375×812: 오늘 챙길 일 시작 위치 1018px → 209px(첫 화면 안), 주간 목표 575 · 진행건 821 · 생산성 939 · 매출 1175. 320×700 도 209px. 가로 넘침 0.
- PC 1280: 변경 전(origin/master)과 블록 위치 동일, 스크린샷 PSNR 74dB(애니메이션 타이밍 차이 수준).
- 시험: `tests/components/dashboard-action-overview.test.ts` 를 새 계약(주차 무관 구성, 모바일 order 오름차순)으로 갱신.

## 되돌리기
squash revert 1개. 데이터·저장값 변화 없음.

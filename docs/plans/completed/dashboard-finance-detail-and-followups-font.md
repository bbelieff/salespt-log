# 대시보드 — 영업이익 상세 폭·중복 미리보기·진행건 늘 펼침·「← 대시보드」·오늘 챙길 일 글자

- 목적: belie 2026-11-16 대시보드 5건. 관련: [components](../../design/components.md) §9-2·TopHeader·DashboardFollowUpsView.

## 수용 조건
1. 폰(1024px 미만)에서 영업이익 상세는 세 칸 전체 폭으로 펼쳐져 표가 잘리지 않는다.
2. PC에서 칸을 누르면 그 칸의 미리보기 두 줄은 숨는다 — 눌러도 같은 내용이 또 나오던 것.
3. PC 진행건 칸은 누르지 않아도 상태 막대·범례가 늘 보인다.
4. 머리의 「← 대시보드」를 모든 화면에서 제거한다(2026-11-16 belie 추가 지시 — 처음엔 `/dashboard` 에서만 숨겼다). 복귀는 사이드 메뉴·메뉴 서랍의 「대시보드」. 수강생↔트레이너 토글은 두 역할을 다 가진 계정에만(기존 조건 확인, 변경 없음).
5. 「오늘 챙길 일」 표 글자를 한 단계 키운다(단계 14px·건수 15px·열 제목 12px).

## 변경
- `components/dashboard/FinanceSummaryBoxes.tsx`·`FinanceWorkColumn.tsx`·`dashboard-action-overview.css`·`followups-table.css`, `components/auth/nav-entitlements.ts`, `components/TopHeader.tsx`(링크 블록 삭제).

## 검증
- dashboard-hero-a·dashboard-finance-column-detail·nav-entitlements·top-header-regression·header-dashboard-entry 시험, `bash scripts/check.sh`. 실제 화면 확인은 배포 뒤(로컬은 로그인 데이터가 없어 NOT_RUN).

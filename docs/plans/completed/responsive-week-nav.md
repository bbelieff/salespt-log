---
slug: responsive-week-nav
status: completed
completed: 2026-06-03
created: 2026-06-03
owner: belie
related: responsive-desktop-toss-copy
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택·일정계약 탭의 주간 네비(WeekHeader)가 태블릿/데스크탑에서 7일 버튼이 전폭으로 흩어지고 ‹›화살표가 멀어지는 문제를 중앙 max-width로 모아 해결.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/contact/_components/WeekHeader.tsx`, `app/(app)/schedule/_components/WeekHeader.tsx`
> - **읽고 나면 알 수 있는 것**: 반응형 전략(2xl≥768 중앙정렬), 추출 대신 일관수정 택한 이유
> - **관련 문서**: [[docs/plans/active/responsive-desktop-toss-copy]], [[docs/design/tokens]]

# 주간 네비 헤더 반응형 (A)

## Intent (왜)
PostHog + 데스크탑/태블릿 피드백: 풀사이즈에서 WeekHeader의 7일 버튼이 화면 전폭으로 흩어지고, 주이동 ‹ › 화살표가 양 끝에 멀어 클릭이 어렵다. 아이패드/갤럭시폴드(~768~820)에서도 간격이 어색.

## 현재 동작 (root cause)
- WeekHeader가 **컨택·일정계약 탭에 각각 중복 구현**(거의 동일 구조).
- 화살표 행 `flex justify-between` + 7일 스트립 `grid grid-cols-7` 모두 **폭 제한 없음** → 넓은 화면에서 전폭 분산.

## 결정 — 추출 대신 일관 수정 (fallback)
- 두 WeekHeader는 props/세부가 달라(컨택=daily 이동·퍼널 라벨 / 일정=scrollIntoView) **완전 추출은 회귀 위험**.
- 사용자 허용대로 **두 파일에 동일 반응형 수정 일관 적용**. 공통 컴포넌트 추출은 후속 과제로 남김.

## 변경 (A2+A3)
- 화살표 행 + 7일 스트립 컨테이너에 `2xl:mx-auto 2xl:max-w-xl` 추가 → **태블릿(≥768)·데스크탑에서 중앙 정렬 + 폭 제한**.
  - 효과: 스트립이 모이고(7칸 균등), `justify-between` 화살표가 타이틀에 근접.
- 탭타깃은 이미 `h-11 w-11`(44px) — 유지(A3 충족).
- 모바일(<768) 레이아웃 불변(회귀 0).

## Acceptance Criteria
- [ ] 데스크탑(≥1280)·태블릿(~768~820)에서 7일 스트립이 중앙으로 모이고 ‹›화살표가 타이틀 근처.
- [ ] 모바일(~390) 기존과 동일.
- [ ] 컨택·일정계약 두 탭 동일 적용.
- [ ] 토큰 외 신규 arbitrary value 없음(표준 클래스 `2xl:max-w-xl` 등).
- [ ] `npm run check` 통과.

## 범위 밖
- WeekHeader 완전 공통 컴포넌트 추출(후속), 캘린더 월 헤더(B에서 별도), 색·구조 변경.

## Log
- 2026-06-03 plan 작성, fallback(일관수정) 방식 채택.

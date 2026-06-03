---
slug: header-width-unify
status: active
created: 2026-06-03
owner: belie
related: responsive-desktop-toss-copy, calendar-desktop-expand
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 5탭 상단 바(브랜드바·페이지배너·sticky 서브헤더) 내용을 데스크탑에서 대시보드와 동일한 중앙 max-w-6xl 컬럼에 정렬. 캘린더 그리드만 더 넓게(xwide) 예외.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/TopHeader.tsx`, `app/(app)/calendar/page.tsx`, `components/PageContainer.tsx`
> - **읽고 나면 알 수 있는 것**: full-bleed 배경 + 중앙정렬 내용 패턴, 대시보드 폭 정책, 캘린더 예외
> - **관련 문서**: [[docs/design/components]], [[docs/plans/active/responsive-desktop-toss-copy]]

# 상단 바 폭 통일 (대시보드 정책)

## Intent (왜)
데스크탑에서 본문(PageContainer)만 중앙으로 모이고, 공통 상단 바(브랜드바·페이지배너)와 sticky 서브헤더는 풀폭으로 끝까지 늘어져 부조화. 대시보드처럼 상단 바 "내용"도 중앙 max-width 컬럼에 정렬한다.

## 현재 동작 (root cause)
- `TopHeader` 브랜드바(`<header sticky top-0>`)·페이지배너(`<div sticky top-12>`)가 자체가 flex 컨테이너 = 풀폭 + 내용 좌우 끝 분산.
- 캘린더 월 `<header sticky top-24>`(month nav)도 풀폭.
- (주간 헤더 contact/schedule 는 #267 에서 이미 중앙정렬 완료 → 본 PR 범위 밖.)

## 수정 — 대시보드와 동일 정책
- **배경/보더는 full-bleed 유지**(스크롤 가림 자연스럽게), **내용만** `PageContainer width="wide"`(= `mx-auto w-full pc:max-w-6xl pc:px-6 wide:px-8`)로 감싸 중앙 정렬.
- 적용:
  1. `TopHeader` 브랜드바 — `<header>` 는 sticky/bg/border/h-12 만, 안쪽 4그룹을 `PageContainer(wide, flex)` 로.
  2. `TopHeader` 페이지배너 — 동일.
  3. 캘린더 월 nav `<header>` — 동일.
- 모바일(<pc): `pc:max-w-6xl` 이라 폭 제한 미적용 = 기존 풀폭 그대로(회귀 0).
- TopHeader 는 5탭 공통 → 한 번 고치면 전 탭 반영.

## 캘린더 예외
- 월 그리드 영역은 이미 `PageContainer width="xwide"`(#268) + grid-cols-6(4:2) + 셀 확대(#264) 적용됨. 상단 월 nav 만 본 PR 로 6xl 통일. (그리드 6xl 로 좁히지 않음.)

## Acceptance Criteria
- [ ] 데스크탑(≥1280): 브랜드바·페이지배너·캘린더 월nav 내용이 본문과 같은 6xl 한계선에 정렬, 끝까지 안 늘어짐.
- [ ] 모바일/태블릿 회귀 없음(풀폭 유지).
- [ ] 캘린더 그리드는 계속 더 넓게(xwide).
- [ ] 토큰 외 신규 arbitrary value 없음. `npm run check` 통과.

## 범위 밖
- 주간 헤더(#267 완료), 색·구조 변경, 본문 폭 변경.

## Log
- 2026-06-03 plan 작성.

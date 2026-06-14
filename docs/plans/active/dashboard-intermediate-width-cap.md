---
slug: dashboard-intermediate-width-cap
status: active
created: 2026-06-14
owner: belie
related: design-system-unified
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 중간 너비(약 672~1024px)에서 1단 카드가 화면 전체로 과대해지던 문제를 PageContainer md 캡으로 수정.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: components/PageContainer.tsx, 대시보드·실무수납·관리자 wide 화면
> - **읽고 나면 알 수 있는 것**: md 중간 캡 메커니즘, breakpoint 값
> - **관련 문서**: docs/design/components.md §8

# 중간 너비 카드 과대화 수정

## 원인
PageContainer 폭 제한이 pc(1024)부터만 → 약 672~1024 구간은 1단 + 폭 무제한 →
퍼널·8주추이·채널 카드가 화면 전체로 늘어남.

## 수정
PageContainer maxW 에 md 캡 추가(이 프로젝트 md=402px이나 max-w 는 화면이 그보다
클 때만 적용 → 실질 672~1024 구간 캡): wide=md:max-w-2xl, narrow=md:max-w-md,
xwide=md:max-w-2xl(캘린더는 좌우로 열려야 해 좁지 않게). md:px-4 여백. mx-auto 가운데.
대시보드 2단(pc:grid-cols-2)·정렬은 불변 — 폭만 제한. components.md §8 갱신.

## 상태
- 2026-06-14 완료(fix/dashboard-intermediate-width-cap). 시각 검증: wide=대시보드는
  admin 인증 필요해 preview 생략, md:max-w 표준 동작 + check/build 로 검증.

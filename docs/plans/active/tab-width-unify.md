---
slug: tab-width-unify
status: active
created: 2026-06-04
owner: belie
related: header-width-unify, calendar-desktop-expand, responsive-week-nav
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 비캘린더 5탭(컨택·일정계약·DB)의 본문·sticky 헤더·fixed 버튼 좌우 여백을 TopHeader/대시보드와 같은 6xl 한 폭으로 통일. 캘린더만 본문 그리드 xwide 예외(이미 완료).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/{contact,schedule,db}/page.tsx`, 두 `WeekHeader.tsx`, (캘린더는 확인만)
> - **읽고 나면 알 수 있는 것**: full-bleed 배경+wide 내용 패턴, 주간 헤더 정렬(구글캘린더식), 캘린더 예외
> - **관련 문서**: [[docs/plans/completed/header-width-unify]], [[docs/plans/completed/calendar-desktop-expand]]

# 탭 좌우 여백 통일 (6xl) + 캘린더 그리드 예외

## Intent
한 화면에 폭 3종(6xl 바 / 2xl 본문 / 풀폭 헤더·버튼)이 섞여 부조화. TopHeader는 이미 full-bleed 배경 + 내용 6xl(PageContainer wide). 나머지를 같은 6xl로 정렬.

## A. 비캘린더 5탭 — 6xl 통일
- **본문**: 컨택·일정계약·DB `PageContainer width="narrow"`(2xl) → **`wide"`(6xl)**. (payment 는 이미 wide.)
- **sticky 주간/요약 헤더**: 바 배경·보더 full-bleed 유지 + 내부 내용만 `PageContainer width="wide"` 로 중앙정렬.
  - contact: WeekHeader 감싼 sticky div / schedule: WeekHeader+SummaryBar sticky div(+bg-white).
- **fixed 저장 바(contact)**: 바 full-bleed 유지, 버튼만 wide 컨테이너 → 좌우 끝이 본문과 동일 한계선. 토스트는 중앙 pill(변경 불필요).
- **주간 헤더 스트립**: #267 의 화살표 근접(arrow row `2xl:max-w-xl`)은 **유지**, **7일 스트립의 `2xl:max-w-xl` 만 제거** → 스트립이 wide 컨테이너를 채워 본문 좌우 한계선과 정렬. (구글캘린더식: 중앙 nav + 넓은 day 그리드. #267 의 "끝 화살표" 문제는 arrow row 유지로 방지.)

## B. 캘린더 예외 — 이미 완료(#264·#268), 회귀 확인만
- 본문 `PageContainer width="xwide"`(7xl), 그리드:패널 `grid-cols-6`(4:2), 셀 확대 + 시간+업체명 pill + `+N` 오버플로. 본 PR 에서 변경 없음(회귀만 점검).

## Acceptance Criteria
- [ ] 데스크탑(≥1280): 비캘린더 5탭의 상단바·주간헤더(스트립)·본문·저장버튼 좌우 여백이 모두 6xl 동일, 끝까지 늘어지는 요소 없음.
- [ ] 캘린더만 본문 그리드 xwide(더 넓음), 칸 시간+업체명 노출(유지).
- [ ] 모바일/태블릿 회귀 없음(본문·헤더 모두 동일 폭으로 따라감).
- [ ] `npm run check` 통과.

## 범위 밖
- 색·구조 변경, 캘린더 추가 확대(이미 완료), PageContainer 태블릿 캡(별도).

## Log
- 2026-06-04 A 구현(본문 wide + 바 full-bleed/wide 내용 + 스트립 정렬). B 회귀 확인.

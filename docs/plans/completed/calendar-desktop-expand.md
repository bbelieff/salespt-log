---
slug: calendar-desktop-expand
status: completed
completed: 2026-06-03
created: 2026-06-03
owner: belie
related: practice-and-drive
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 데스크탑에서 캘린더를 더 넓게(PageContainer xwide), 그리드:패널 비율 4:2로, day 패널 이동 버튼 2개 항상 노출.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/PageContainer.tsx`, `app/(app)/calendar/page.tsx`, `MonthGrid.tsx`
> - **읽고 나면 알 수 있는 것**: xwide 폭 토큰, 캘린더 비율, day패널 허브 버튼 규칙
> - **관련 문서**: [[docs/design/components]], [[docs/design/tokens]]

# 캘린더 데스크탑 확대 (B)

## Intent (왜)
데스크탑/태블릿 피드백: 캘린더가 좌우로 덜 열려 남는 공간이 많고, day 상세 패널의 탭 이동 버튼이 조건부라 한쪽만 떠 사라진 것처럼 보임. 캘린더는 일정·계약 / 실무·수납 두 탭의 허브.

## 변경
- **B1 PageContainer `xwide`**: 신규 width 옵션 `xwide`(`pc:max-w-7xl`, wide(max-w-6xl)보다 넓음) 추가 → 캘린더에 적용. components.md §8 등재.
- **B3 비율 4:2**: 캘린더 영역 `pc:grid-cols-5`(3:2) → `pc:grid-cols-6` + 캘린더 `pc:col-span-4` / day패널 `pc:col-span-2` (= 2:1, 캘린더 더 큼).
- **B4 두 버튼 항상**: day 패널 이동 버튼(← 일정·계약 / 실무·수납 →)을 `selectedMeetings>0`·`selectedTodos>0` 조건 제거하고 **항상 둘 다 노출**(허브). B2(셀 높이·업체명)는 #264에서 완료 — 본 PR 범위 밖.

## Acceptance Criteria
- [ ] 데스크탑에서 캘린더 폭이 기존(6xl)보다 넓고(7xl), 그리드:패널 4:2.
- [ ] day 패널에 두 이동 버튼이 항상 함께 노출.
- [ ] 모바일 불변(회귀 0).
- [ ] 토큰 외 신규 arbitrary value 없음(`pc:max-w-7xl`/`grid-cols-6`/`col-span-*` 표준).
- [ ] `npm run check` 통과.

## 범위 밖
- 셀 높이/업체명(B2, 완료), 색·구조 변경.

## Log
- 2026-06-03 plan 작성.

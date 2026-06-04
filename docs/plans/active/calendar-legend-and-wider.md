---
slug: calendar-legend-and-wider
status: active
created: 2026-06-04
owner: belie
related: calendar-desktop-expand
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 캘린더 범례가 좁은 우측 패널에서 '콜·지·기·소' 줄바뀜되던 것을 grid 아래 full-width 한 줄 스트립으로 이동(nowrap) + 월 그리드를 더 넓게(xwide 120rem, grid 5:2).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/calendar/page.tsx`, `MonthGrid.tsx`, `components/PageContainer.tsx`
> - **관련 문서**: [[docs/plans/completed/calendar-desktop-expand]], [[docs/design/components]]

# 캘린더 범례 줄바뀜 + 그리드 확대

## Intent
1. 범례(영업 4색 + 실무 4아이콘)가 우측 day 패널(좁은 col-span-2) 안에 있어 영업 행 4채널이 wrap('콜·지·기·소' 떨어짐).
2. 월 그리드가 더 넓었으면(화면 대부분 차지).

## 변경
1. **범례 이동·nowrap**: 우측 패널에서 빼서 grid+패널 **아래 full-width 스트립**으로. 영업/실무 각각 `flex-nowrap` + `whitespace-nowrap break-keep` + 라벨/칩 shrink-0, gap 축소. 좁아도 안 깨지게 `overflow-x-auto`. (sm+ 한 줄, 모바일 세로 2줄.)
2. **그리드 확대**:
   - `PageContainer xwide` 폭 `pc:max-w-7xl`(1280) → **`pc:max-w-[120rem]`**(1920, 사실상 화면폭-여백). 캘린더 전용. components.md 갱신.
   - 비율 `grid-cols-6`(4:2) → **`grid-cols-7`** + 그리드 `col-span-5` : 패널 `col-span-2`(≈71:29).
   - `MonthGrid` 셀 데스크탑 `pc:min-h-[128px]` → **`pc:min-h-[150px]`** + `pc:p-2` (시간+업체명 pill 더 시원).
   - 상단 공용 바(TopHeader)는 6xl 유지(전 탭 공통).
3. 모바일(<pc) 1열 유지(회귀 0).

## Acceptance Criteria
- [ ] 데스크탑 어느 폭에서도 범례 영업/실무 각 한 줄, '콜·지·기·소' wrap 없음.
- [ ] 그리드가 확연히 넓어지고 칸 시간+업체명 보임. 상단 바 6xl 유지.
- [ ] 모바일 회귀 없음. `npm run check` 통과.

## 범위 밖
- 색·구조 변경, 상단 바 폭 변경.

## Log
- 2026-06-04 범례 full-width 이동 + xwide 120rem + grid 5:2 + 셀 150px.

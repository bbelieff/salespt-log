---
slug: fix-calendar-jump-week
status: active
created: 2026-06-03
worktree: ../wt/fix-calendar-jump-week
---

# 캘린더 점프 시 선택 주차 유지

## Intent (왜)
캘린더에서 다른 주차 날짜를 선택한 뒤 "일정·계약 탭으로 이동"을 누르면,
일정·계약 탭이 선택한 주차가 아니라 항상 오늘(현재 주)로 열린다.
사용자가 본 날짜의 맥락을 잃어버려 다시 주차를 넘겨야 하는 불편이 있다.
선택한 날짜의 주(금~목)로 열리도록 점프 시 날짜를 넘기고, 도착 탭에서 today-스냅을 막는다.

## 원인
- `app/(app)/calendar/page.tsx` `jumpToSchedule` — `router.push("/schedule")` 로
  선택일(`selectedDate`)을 넘기지 않음.
- `app/(app)/schedule/page.tsx` — `weekStart` 초기값=오늘, 첫 데이터 로드 후
  `aligned` useEffect 가 무조건 `friOf(오늘)` 로 스냅 → 넘긴 날짜도 덮어씀.

## 수정 (문서 요약 카드)
1. **calendar/page.tsx**: `jumpToSchedule` 를
   `router.push("/schedule?date=" + selectedDate)` 로 변경 (선택일 전달).
2. **schedule/page.tsx**: 마운트 시 `?date=` 를 읽어 그 날짜의 주(금~목)로 초기화하고
   today-스냅을 막는다.
   - Next 15 `useSearchParams` Suspense 경계 회피 → mount `useEffect` 에서
     `window.location.search` 직접 파싱 (컨택탭 `page.tsx` 기존 패턴 동일).
   - 유효한 `YYYY-MM-DD` 이면 `setWeekStart(fmtISO(friOf(parseISO(d))))` +
     `aligned.current = true` 로 기존 `friOf(오늘)` 스냅 방지.
   - 파일 500줄 캡 준수를 위해 weekStart 동기화(2개 effect)를
     `_lib/useWeekStartSync.ts` 훅으로 추출.

## Acceptance Criteria (수용 기준)
- [ ] 캘린더에서 5/18~24 주 날짜 선택 → "일정·계약 탭으로 이동" →
      일정·계약이 5/18~24 주차로 열림 (오늘 6/3 주 아님).
- [ ] `date` 파라미터 없이 `/schedule` 직접 진입 시엔 종전대로 오늘 주차.
- [ ] 편집기간(1~10주) 밖 날짜를 넘겨도 깨지지 않음
      (서버 라우트는 날짜 형식만 검증·해당 주 read, `weekIndexOf` 는 0/큰 수 반환 — 크래시 없음).
- [ ] `npm run check` 통과 (typecheck · lint · structural · tests · 파일크기)
- [ ] dev 에서 캘린더→일정계약 점프 여러 주차 직접 확인.

## Context (참고)
- `app/(app)/calendar/page.tsx` `jumpToSchedule` (121~124)
- `app/(app)/schedule/page.tsx` `weekStart`/`aligned` (45~77)
- `app/(app)/schedule/_lib/week.ts` — `friOf`/`parseISO`/`fmtISO`
- 패턴 출처: `app/(app)/contact/page.tsx` (94~) `window.location.search` 파싱

## Steps (점진적 공개)
1. calendar/page.tsx — `jumpToSchedule` 에 선택일 쿼리 추가.
2. schedule/page.tsx — mount useEffect 로 `?date=` 파싱 → weekStart 초기화 + aligned 잠금.
3. `npm run check` + dev 수동 확인.

## Log
- 2026-06-03 plan 작성. 단독 PR fix/calendar-jump-keep-week 예정.

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 재무 묶음·주간 목표 카드 맨 위 쉬운 말 한 줄(belie #8) 목업·구현 계획과 수용 기준.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `components/ui/CardHeadline.tsx`, `components/dashboard/finance-headline.ts`·`DashboardFinance.tsx`·`DashboardSkeleton.tsx`, `components/weekly-goals/goal-headline.ts`·`WeeklyGoalSummary.tsx`, `app/(app)/dashboard/page.tsx`(prop 1개)
> - **읽고 나면 알 수 있는 것**: 어떤 문장이 언제 나오는지 · 목업을 어떻게 여는지 · 무엇을 일부러 넣지 않았는지
> - **관련 문서**: [components.md §9 「대시보드 한 줄 문장」](../../design/components.md#9-dashboard) · [tokens.md 카드 한 줄 문장 tone](../../design/tokens.md) · [dashboard-follow-ups.md](./dashboard-follow-ups.md)(같은 브랜치 #3·#4)

# 대시보드 카드 한 줄 문장 (2026-10-12, belie #8)

## 범위
- 포함: ① 재무 묶음 기간 칩 아래 영업이익 문장(기간을 따라 바뀜) ② 주간 목표 카드 제목 아래 남은 목표 문장(지난 주는 과거형).
- 제외(belie 기본안): 매출 목표 문장(저장된 매출 목표 값 없음 → 실제 영업이익 문장으로 대신), 생산성·진행건·차트 문장, 카드별 가이드 링크(주제별 가이드 페이지 없음). 서버·API·DB·시트·Zod 변경 없음.
- 문구표·우선순위 정본 = components.md §9 「대시보드 한 줄 문장」.

## 스펙 리뷰 반영
1. (major) 재무 문장 자리는 불러오는 중(회색 줄)·문장 없음에도 `mb-2 min-h-5`로 항상 붙어 있다 → 3칸 위치가 불러오는 중→완료에서 그대로(목업 `?slow=1` 실측 390px: 3칸 top 316→316). `DashboardSkeleton` 자리도 h-5.
2. 영업이익 = 매출 − 비용을 한 번 반올림(칸과 같은 식) — 칸 숫자와 1원도 다르지 않다(반올림 표 테스트).
3. useMemo 없이 렌더마다 계산, `aria-live="polite"` 자리는 갈아끼우지 않는다(같은 노드 테스트).
4. 「전체」 접두어 「지금까지」 vs 「전체 기간에」 — 목업 `/headlines` 맨 위에 나란히(belie 선택 대기, 상수 `ALL_PERIOD_PREFIX` 한 곳).
5. 주간 목표: 주차 이동은 「불러오는 중…」 뒤 그 주 문장, 같은 주 재조회 동안은 이전 문장 유지(placeholderData 없음 — 코드 변경 없음).
6. tokens.md 음수 영업이익 red-600 → violet-600 정정 + CardHeadline tone 표, preview.html 예시.
7. 테스트는 `.ts` + createElement, 날짜는 가짜 시계로 고정, 진행형·과거형 둘 다 단언.
8. 가이드 근거 정정: `(app)` 페이지 라우트 9개(payment/news 포함).

## 목업
- `npm run build`(폰트) 후 `node tests/browser/dashboard-followups-server.mjs` → 출력 주소.
- `/dashboard?finance=profit|loss|cost-only|none|refund|ledger-fail|big` (줄임 `?loss=1` `?big=1`), `?goals=remaining|done|unset|zero` (줄임 `?goalDone=1`), `?slow=1`(재무 불러오는 중 확인). refund 는 「이번 달」 칩, 지난 주 과거형은 카드 ◀.
- `/headlines` — 모든 문구 상태 승인표(실제 CardHeadline + FinanceSummaryBoxes / GoalRings, 320·390·넓게 폭 전환).

## 수용 기준
- [x] 재무 문장 금액 = 영업이익 칸 금액(음수는 절대값), 칩 전환 즉시 접두어 변경(지금까지/N월에/이번 주에/고른 기간에, 날짜 덜 고르면 지금까지).
- [x] 경비장부 실패 → 「매출 N원을 올렸어요」 또는 문장 없음, 반환 > 매출 → 보라 반환 문장, 불러오는 중·실패에 문장 없음.
- [x] 주간 목표 문장 4종 + 과거형, 칸별 「N 남음/초과」 줄 없음, 카드 클릭 이동 그대로(`/weekly-goals?date=…&returnTo=%2Fdashboard`).
- [x] 트레이너 보기·compact 요약 변화 없음(`headline` opt-in).
- [x] 목업 실측: 320px 가로 넘침 0(8자리 금액도 한 줄), 390px 7자리 한 줄, 1024·1600 같은 줄 카드 바닥선 일치·PT과제 바닥 유지.
- [ ] belie 목업 승인(접두어 선택 포함) → check.sh 초록 → 커밋.

## 머지·트랙
- 같은 브랜치(feat/dashboard-followups)의 #3·#4(오늘 챙길 일)·영업이익 상세 채널 표와 `page.tsx`·`DashboardFinance.tsx`·`DashboardSkeleton.tsx`를 함께 만진다 — 한 브랜치라 직렬 머지 1회. 각 변경은 앵커 단위 작은 수정.
- `docs/plans/active/student-dashboard-followup.md`(STUDENT-DASHBOARD-260913, 2026-09-13)가 같은 구역을 아직 소유 선언 중 — 완료 여부 확인 후 completed 이동은 총괄 판단.

## 커밋 메시지(feat, §6.5)
- `Changelog: 대시보드를 열면 이번에 얼마 남겼는지, 주간 목표까지 얼마 남았는지 한 줄로 바로 알 수 있어요.`
- 전: 숫자 칸과 링을 하나씩 읽어야 이번 달에 남긴 돈이나 남은 목표를 알 수 있었어요. / 후: 카드 맨 위 한 줄이 「10월에 594,520원을 남겼어요」, 「계약 목표까지 1건 남았어요」처럼 바로 알려 줘요.

## 롤백
- 커밋 revert(서버·데이터 변경 없음).

## 승인 기록
- 목업 기준 SHA: (커밋 후 기입) · belie 승인: (대기)

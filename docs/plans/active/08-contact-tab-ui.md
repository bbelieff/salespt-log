---
slug: contact-tab-ui
status: active
created: 2026-04-28
worktree: ../wt/contact-ui
pr: feat/contact-tab-ui
---

# PR 2b — 컨택탭 UI + API

## Intent
PR 2a (`feat/sales-meetings-repo`) 머지 후 backend 가능. 이제 그 위에:
- 디자인 시스템 컴포넌트 4종 (`<MetricStepper>`, `<DateInputCustom>`, `<TimeSelectPair>`, `<ChannelBadge>`)
- API 라우트 (`/api/daily/[date]`, `/api/meeting`, `/api/meeting/[id]`)
- React Query 셋업 + 훅
- 컨택탭 페이지 (`contact-daily-input.html` v7 React 포팅)

Auth는 별도 트랙 (PR A1) — 이번엔 stub 사용자(`STUB_USER_EMAIL` 환경변수).

## Acceptance Criteria

### 디자인 시스템 컴포넌트
- [ ] `components/ui/MetricStepper.tsx` — +/- 버튼, 네이티브 스피너 숨김, inputmode=numeric
- [ ] `components/ui/DateInputCustom.tsx` — 커스텀 박스 + 0×0 native + showPicker, 요일 표시
- [ ] `components/ui/TimeSelectPair.tsx` — 시 select(09~22) + 분 select(00·15·30·45)
- [ ] `components/ui/ChannelBadge.tsx` — 4채널 배지

### API 라우트
- [ ] `app/api/daily/[date]/route.ts` — GET (loadDay) + POST (saveContactMetrics)
- [ ] `app/api/meeting/route.ts` — POST (appendNewMeeting)
- [ ] `app/api/meeting/[id]/route.ts` — PATCH (patchMeeting) + DELETE (removeMeeting)

### React Query
- [ ] `app/providers.tsx` — QueryClientProvider
- [ ] `app/layout.tsx` — Providers wrapper
- [ ] `lib/query/contact-hooks.ts` — `useDay`, `useSaveMetrics`, `useAppendMeeting`, `usePatchMeeting`, `useRemoveMeeting`

### 페이지
- [ ] `app/(app)/contact/page.tsx` — `contact-daily-input.html` v7 React 포팅
  - 주차 네비
  - 4채널 탭
  - 4지표 입력 그리드
  - 미팅 슬롯 (신규/등록완료 토글)
  - 검증: 컨택성공 ≤ 컨택진행 자동 보정, 슬롯 수 = 컨택성공

### 인증 stub
- [ ] `lib/auth/stub.ts` — `getCurrentUserEmail()` from `process.env.STUB_USER_EMAIL`
- [ ] PR A1 머지 시 `auth()`로 1줄 교체

### 검증
- [ ] `npm run check` 통과
- [ ] `npx next build` 통과
- [ ] 페이지 `npm run dev`로 수동 확인 (Drive MCP로 시트 검증 가능)

## Out of Scope (PR 3 / A1)
- 일정·계약 / 캘린더 탭 UI
- 실제 Google OAuth (PR A1)
- 신규 수강생 온보딩 (PR A1)

## Steps (3 commits)
1. 디자인 시스템 컴포넌트 4종
2. API 라우트 + React Query 셋업
3. 컨택탭 페이지 React 포팅

## Log
- 2026-04-28: 워크트리 생성, @tanstack/react-query 설치

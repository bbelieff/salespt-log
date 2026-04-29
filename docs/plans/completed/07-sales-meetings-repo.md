---
slug: sales-meetings-repo
status: active
created: 2026-04-28
worktree: ../wt/contact-tab
pr: feat/sales-meetings-repo
---

# PR 2a — 컨택탭 백엔드 (sales + meetings repo)

## Intent
PR 2를 옵션 B로 분할한 첫 번째 — backend 전용. 컨택탭 UI에서 호출할
repo·service 레이어를 먼저 구현하고 검증한 뒤, PR 2b에서 UI/API 라우트를 얹는다.

이 PR이 머지되면 컨택탭은 여전히 placeholder UI지만, 그 아래 lib/repo/service
레이어는 실제 시트 read/write가 가능한 상태가 된다.

## Acceptance Criteria

### lib/config
- [ ] `SHEET_RANGES.sales`: 좌표 상수 추가 (`blockStart=10`, `blockStride=34`)
- [ ] `SHEET_RANGES.sales.metricCols` (E/F/G/H), `revenueCols` (Q/R/S/T)
- [ ] 영업관리 수식 컬럼 (I~P) 쓰기 금지 가드 (런타임)

### lib/repo
- [ ] `lib/repo/sales.ts`:
  - `readCourseStart(spreadsheetId)` → Date (N1)
  - `salesRowFor(date, channel, courseStart)` → row number (정적 함수, 좌표 계산)
  - `readWeek(spreadsheetId, weekIndex)` → ChannelDailyRow[] + DailyRevenue[]
  - `writeChannelDailyRow(spreadsheetId, row)` → 4지표 update
  - `writeDailyRevenue(spreadsheetId, revenue)` → Q~T update (그날 매입DB 행에 기록)
- [ ] `lib/repo/meetings.ts`:
  - `appendMeeting(spreadsheetId, meeting)` → A~M, P, R 채워서 1행 append
  - `updateMeeting(spreadsheetId, id, partial)` → 특정 행 부분 update
  - `findById(spreadsheetId, id)` → Meeting | null
  - `findByDate(spreadsheetId, date, type: 'reservation' | 'meeting')` → Meeting[]

### lib/service
- [ ] `lib/service/contact.ts`:
  - `loadDay(email, date)` → { channels, meetings }
  - `saveContactMetrics(email, date, channels)` → 4지표 4채널 update
  - `appendNewMeeting(email, slot)` → 미팅 append + 그 채널 H +1
  - `removeMeeting(email, id)` → 미팅 행 클리어 + 그 채널 H -1

### 검증
- [ ] `tests/repo/sales.test.ts` (mocked sheets-client) — 좌표 계산 단위 테스트
- [ ] `tests/repo/meetings.test.ts` — append/update 단위 테스트
- [ ] `npm run check` 통과

## Out of Scope (PR 2b)
- API 라우트 (`/api/daily/[date]`, `/api/meeting`)
- 컨택탭 UI React 포팅
- 디자인 시스템 컴포넌트 (`<MetricStepper>`, `<DateInputCustom>`, etc.)

## 시트 좌표 상수 (실제 측정값)
- `SALES_BLOCK_START = 10` — 1주차 토요일 매입DB 행 (사용자 측정 2026-04-28)
- `SALES_BLOCK_STRIDE = 34` — 주차 간 행 간격
- 검증: 8주차 첫 행 = 10 + 7×34 = 248

## 좌표 공식
```ts
const week = floor((targetDate - courseStart) / 7days) + 1;  // 1~10
const dayIdx = (targetDate - weekStart) / 1day;              // 0~6
const channelIdx = CHANNEL_ORDER.indexOf(channel);           // 0~3
const row = SALES_BLOCK_START + (week - 1) * SALES_BLOCK_STRIDE + dayIdx * 4 + channelIdx;
```

## 수납(DailyRevenue) 행 위치 가정
한 날짜의 Q~T 4컬럼은 **그 날의 매입DB 행(첫 채널)에 단독 기록**.
나머지 3개 채널 행의 Q~T는 비움. (시트 디자인 확인 필요 — 다르면 사용자에게 보고)

## Log
- 2026-04-28: 사용자 좌표 측정 (E10/E44) → 상수 박음, 워크트리 생성

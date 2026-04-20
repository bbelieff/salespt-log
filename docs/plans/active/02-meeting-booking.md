---
slug: 02-meeting-booking
status: active
created: 2026-04-16
updated: 2026-04-16
worktree: ../wt/02-meeting-booking
depends_on: 01-auth-onboarding
---

# 02 — 미팅 예약 입력 + 구글 캘린더 연동

## Intent
수강생이 "미팅 잡았다"를 앱에서 한 번 입력하면:
1. 본인 시트의 전용 탭에 **구조화된 행 + 사람이 읽기 좋은 한 줄**로 기록되고,
2. 영업관리(성과관리) 탭의 해당 날짜 행에 **수식으로 자동 집계**되며,
3. 구글 캘린더에 **이벤트로 생성**되어 알림까지 받을 수 있도록 한다.

경영일지 기록을 앱으로 옮겨 와 습관을 만드는 것이 목적.

## UX (모바일 우선)
- **구글 캘린더 스타일 월뷰**. 상단 월 네비, 날짜 셀에 당일 미팅 개수 점(dot) 표시.
- 날짜 탭 → **바텀시트**가 올라와서:
  - 시간 선택 (15분 단위 휠 또는 `<input type="time">`) — 방문/미팅 시간 기준
  - 채널 선택 (매입DB / 직접생산 / 현수막 / 지인·기고객·소개)
  - 업체명 (text, 필수)
  - 지역 (text, 선택)
  - 비고 (textarea, 선택)
- **숫자 입력 UI**: +/- 스테퍼 버튼 + 직접 숫자 입력 둘 다 지원
- 저장 → 낙관적 UI 업데이트 + 서버 액션 `service.bookMeeting(...)`.
- PC 에서는 좌측 월뷰 + 우측 상세 패널 (같은 서버 액션 재사용).
- **채널 태그**: 앱 UI에서는 채널을 배지로 표시 (예: `[현수막]`). 시트 rendered에는 채널 미포함.

## 데이터 저장

### 앱\_미팅예약 탭 (SSOT)
수강생 시트에 **신규 전용 탭 `앱_미팅예약`** 을 생성한다. 컬럼:

| A: date | B: time | C: channel | D: vendor | E: region | F: rendered | G: calendarEventId |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | HH:mm | 매입DB/직접생산/현수막/지인·기고객·소개 | 업체명 | 지역 | (수식) | (캘린더 ID) |

- `F. rendered` 는 시트 수식으로 자동 생성 (채널 미포함):
  ```
  =IF(A2="","", TEXT(MONTH(A2),"0")&"/"&TEXT(DAY(A2),"0")&" "&D2&" "&E2&" "&TEXT(TIMEVALUE(B2&":00"),"H")&"시")
  ```
  → 예: `4/19 ○○치킨 방이동 13시`
  (앱이 값을 넣는 것이 아니라 **수식이 계산**. 하나의 소스에서 뷰가 파생되도록.)
- `G. calendarEventId` 는 캘린더 이벤트가 생성되면 저장. 이후 수정/삭제 시 재사용.

### 영업관리(성과관리) 탭 — 수식 연동

기존 대시보드 탭은 **절대 앱이 직접 쓰지 않음**. 아래 수식을 트레이너가 한 번 설정하면, 앱\_미팅예약 탭에 데이터가 쌓일 때마다 자동 갱신.

영업관리 탭 컬럼 구조:
| C: 날짜 | D: 채널구분 | E: 생산 | F: 유입 | G: 컨택진행 | H: 컨택성공 | **I: 미팅예약기록** | **J: 오늘미팅일정** | **K: 오늘미팅수** | L: 미팅완료 | M: 특이사항 | N: 계약 | O: 수임비 | P: 비고 |

데이터는 **10행부터** 시작. 9행에는 각 셀 작성법 메모가 있음.

#### I열 — 미팅예약기록 (10행 기준, 아래로 복사)
해당 날짜에 예약된 미팅 전체를 셀 내 줄바꿈으로 쌓기:
```
=IFERROR(TEXTJOIN(CHAR(10), TRUE, FILTER(앱_미팅예약!F2:F, 앱_미팅예약!A2:A=C10, 앱_미팅예약!F2:F<>"")), "")
```

#### J열 — 오늘미팅일정 (10행 기준, 아래로 복사)
해당 날짜의 미팅을 `업체 지역` 형식으로:
```
=IFERROR(TEXTJOIN(CHAR(10), TRUE, FILTER(앱_미팅예약!D2:D&" "&앱_미팅예약!E2:E, 앱_미팅예약!A2:A=C10, 앱_미팅예약!D2:D<>"")), "")
```

#### K열 — 오늘미팅수 (10행 기준, 아래로 복사)
```
=COUNTIF(앱_미팅예약!A2:A, C10)
```

> ⚠️ I·J 열은 **셀 서식 → 텍스트 줄바꿈(Wrap)** 필수. 하루 최대 미팅 ~5건 (실제 진행 ~4건).

### 구글 캘린더
**결정 확정 (2026-04-16)**: **A — 수강생 본인 캘린더**.
- NextAuth 로그인 시 `calendar.events` scope 동의 → 본인 primary 캘린더에 직접 이벤트 생성
- 환경변수·공용 캘린더 불필요
- 트레이너는 별도 모니터링이 필요하면 Phase 2 에서 B 병행 검토

이벤트 필드 매핑:
- `summary` ← `vendor` (없으면 "미팅")
- `location` ← `region`
- `description` ← 채널 + 비고 + 앱 링크
- `start.dateTime` ← `date + time` (Asia/Seoul). **time = 방문/미팅 시간** (컨택 시간 아님)
- `end.dateTime` ← `start + 1h` (기본값, 추후 길이 필드 추가 가능)
- `reminders.overrides` ← [{ method: "popup", minutes: 30 }]

## 레이어

- `lib/types/meeting.ts` — `MeetingBooking` (Zod)
  ```ts
  const Channel = z.enum(["매입DB", "직접생산", "현수막", "지인·기고객·소개"]);

  MeetingBooking = {
    date: "YYYY-MM-DD",
    time: "HH:mm",           // 방문/미팅 시간
    channel: Channel,
    vendor: string(1..60),
    region?: string(..80),
    note?: string(..300),
  }
  ```
- `lib/repo/meetings.ts` — `appendMeeting`, `listMeetings`, `updateEventId`. `SHEET_RANGES.meetings` 추가.
- `lib/repo/calendar.ts` — `googleapis` 의 Calendar v3 래퍼. **여기만** calendar API import 허용. 구조 테스트에 `googleapis` 허용 구역이 이미 `lib/repo/` 이라 추가 작업 불필요.
- `lib/service/meetings.ts` — `bookMeeting(user, input)`:
  1. Zod 검증
  2. `appendMeeting` (시트 쓰기)
  3. `calendar.insertEvent` (실패해도 시트 쓰기는 커밋됨 — 시트가 SSOT)
  4. 이벤트 ID 받으면 `updateEventId` 로 G 컬럼 갱신
  5. 실패한 캘린더 쓰기는 `logs/agent/calendar-retry.log` 에 남기고 재시도 잡(Phase 2)
- `app/(app)/meetings/page.tsx` — 월뷰 + 바텀시트
- `app/api/meetings/route.ts` — POST 는 `service.bookMeeting` 호출

## Acceptance Criteria
- [ ] `lib/types/meeting.ts` Zod 검증 단위 테스트 (channel enum 포함)
- [ ] `lib/service/meetings.ts` — 시트 쓰기 성공 + 캘린더 실패 시 시트는 유지됨 (역행 금지) 테스트
- [ ] 구조 테스트: `calendar.events` 호출이 `lib/repo/calendar.ts` 밖에서 일어나면 실패 (Sheets 격리 테스트와 동일 패턴 확장)
- [ ] 앱_미팅예약 탭이 없으면 첫 쓰기 시 자동 생성 (`ensureMeetingsSheet`)
- [ ] 모바일 월뷰: 스와이프로 월 네비, 날짜 선택 시 바텀시트 애니메이션 60fps
- [ ] 숫자 입력: +/- 스테퍼 + 직접입력 둘 다 동작
- [ ] 낙관적 UI — 저장 버튼 누르면 즉시 월뷰에 점 추가, 실패 시 롤백 + 토스트
- [ ] 구글 캘린더에 이벤트 생성 확인 (E2E 수동 체크, 스크린샷)
- [ ] 영업관리 탭 수식(I·J·K) 연동 확인 — 앱에서 미팅 입력 후 해당 날짜 행에 자동 반영
- [ ] `npm run check` 통과
- [ ] 모바일/PC 스크린샷 2장 이상

## TBD — 본격 구현 전 확정 필요
- [x] 캘린더 대상 → **A (수강생 본인)**
- [x] 저장 탭 이름·위치 → **`앱_미팅예약` 신규 탭**
- [x] 시간 해석 → **방문/미팅 시간** (컨택 시간 아님)
- [x] 채널 표시 → 시트 rendered에는 미포함, 앱 UI에는 배지로 표시
- [x] 셀 내 다건 표시 → **TEXTJOIN + CHAR(10)** 줄바꿈 쌓기
- [x] 숫자 입력 → +/- 스테퍼 + 직접입력 병행
- [ ] 미팅 기본 길이 (기본 1시간?)
- [ ] 미팅 수정/삭제 UX — Phase 1 에 포함할지 Phase 2 로 미룰지

## Context
- [[docs/architecture.md]] §퍼시스턴스-google-sheets
- [[docs/plans/active/01-auth-onboarding.md]] — 이 작업의 전제 (calendar scope 포함)
- [[docs/decisions/0002-stack-nextjs-sheets.md]]

## Log
- 2026-04-16 plan 작성. 사용자와 UX·저장 포맷 확정. 캘린더 대상·탭 위치는 TBD.
- 2026-04-16 스펙 확정: 앱_미팅예약 탭 컬럼(A~G), 영업관리 탭 수식(I·J·K), 채널 enum, 숫자 입력 UI, TEXTJOIN+CHAR(10) 방식 확정.

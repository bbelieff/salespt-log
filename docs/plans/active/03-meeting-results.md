---
slug: 03-meeting-results
status: active
created: 2026-04-20
updated: 2026-04-29
worktree: ../wt/meeting-results
depends_on: 08-contact-tab-ui
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 일정·계약 탭에서 미팅 결과(상태/계약/수임비/취소)를 인라인으로 입력·저장하는 기능
> - **누가 읽나요**: 개발자 (구현 가이드)
> - **어떤 기능·작업과 연결?**: `app/(app)/schedule/`, `lib/repo/meetings.ts` (`updateMeeting`), `lib/query/contact-hooks.ts` (`usePatchMeeting`)
> - **읽고 나면 알 수 있는 것**: Phase 1/2/3 분할, 데이터 흐름, 5상태 모델
> - **관련 문서**: [[docs/domains/sheet-structure.md]] §3 업체관리, [[docs/design/prototypes/schedule-weekly.html]]

# 03 — 미팅별 결과 입력 (상태·계약·수임비)

## Executive Summary
일정·계약 탭에 미팅별 결과 입력 UI를 추가한다. 컨택관리 탭은 "미팅을 잡는 입구"고, 일정·계약 탭은 "미팅 후 결과 처리장"이다. 5상태 카드(예약/계약/완료/변경/취소) + 인라인 액션 폼으로 시트 J/K/L/M/P 컬럼을 갱신한다.

## Phase 분할

이 plan은 prototype `schedule-weekly.html` (991 lines) 기준이고 한 PR로는 무리. 3개 PR로 분할:

### Phase 1 — 결과 입력 핵심 (이번 PR `feat/meeting-results`)
- **3-action**: 💵 계약 / 🟠 완료(계약X) / 🔴 취소
- API: `GET /api/meetings/week/[weekStart]` (한 주치 미팅 조회, 미팅날짜 기준)
- Service: `loadWeekMeetings(email, weekStart)` — 7일 × all channels
- Hook: `useWeekMeetings(weekStart)` (stateless, key by weekStart)
- 페이지: `/schedule` — 주차 네비 + 7일 그룹 + 5상태 카드
- 카드 펼침 → 4-action 버튼 그리드 (변경 버튼은 disabled+ "Phase 2" 라벨)
- 계약 폼: 수임비(만원) + 계약조건 → `상태=계약, 계약여부=true, 수임비, 계약조건` patch
- 완료 폼: 미팅사유(텍스트) → `상태=완료, 미팅사유` patch
- 취소 폼: 사유(선택) → `상태=취소, 미팅사유` patch
- 상단 요약 바: 총건/예약/완료/취소 카운트 + 수임비 합계

### Phase 2 — 변경(reschedule) + 처리완료 카드 액션 숨김
- ✅ 변경 액션: 새 미팅 row append + 이전 카드 `상태=변경` + `previousMeetingId` 체이닝
- ✅ 처리완료 카드(reserved 외)는 액션 그리드 숨김, 결과 요약만 표시
- 일정 수정 / 미팅결과 누적은 Phase 3로 분리

### Phase 3 — 일정 수정 + M열 누적
- ✅ 일정 수정 details: 날짜/시간/업체명/장소/예약비고 (BasicEditDetails — reserved 카드만)
- ✅ 미팅결과 누적: 완료/취소/변경 시 기존 미팅사유에 "N회차: 사유" 줄바꿈 append
- ✅ 결과 표시 whitespace-pre-wrap (줄바꿈 보존)

### Phase 4 — 캘린더 탭 + 폴리싱
- 월간뷰 캘린더 페이지 (`/calendar`)
- 시안 픽셀 매칭 폴리싱 (애니메이션, 모달, 색상 토큰화)

## Acceptance Criteria (Phase 1)

### 필수 기능
- [ ] `/schedule` 페이지: 주차 네비, 7일 day-section, 미팅 카드 리스트
- [ ] 카드 헤더: 시간 + 업체명 + 장소 + (계약 시) 수임비 요약
- [ ] 5상태별 색상 (reserved=노랑, contract=초록, done=주황, rescheduled=보라, canceled=빨강)
- [ ] 카드 클릭 → 펼침/접힘 토글
- [ ] 펼침 본문: 채널 배지 + 4-action 버튼 (변경은 disabled)
- [ ] 계약 액션: 수임비(필수) + 계약조건(선택) → 확정 → 시트 update
- [ ] 완료 액션: 미팅사유 → 확정 → 시트 update
- [ ] 취소 액션: 사유(선택) → 확정 → 시트 update
- [ ] 확정 후 카드 색상 즉시 반영 (optimistic + invalidate)
- [ ] 상단 요약 바: 총건/예약/완료/취소/수임비합계
- [ ] 수임비=0인데 계약 시도 시 경고 (저장 차단)

### 코드 품질
- [ ] 파일당 ≤500줄 (check.sh 통과)
- [ ] structural / unit 테스트 통과
- [ ] mutation hook stateless (week-key 보존, race 방지)
- [ ] `repo/meetings.ts`의 `updateMeeting` 재사용 — 신규 backend 작성 X

## Technical Design

### 데이터 흐름

```
schedule/page.tsx
  └─ useWeekMeetings(weekStart) → GET /api/meetings/week/[weekStart]
       └─ loadWeekMeetings(email, weekStart)
            └─ findByDate(spreadsheetId, eachDate, "meeting") × 7
       
  카드 액션 확정
  └─ usePatchMeeting().mutateAsync({weekStart, id, partial})
       └─ patchMeeting(email, id, partial)
            └─ updateMeeting(spreadsheetId, id, partial)
       └─ onSuccess: invalidate ['week', weekStart]
```

### 시트 매핑 (이미 존재 — 백엔드 신규 X)

| 컬럼 | 필드 | Phase 1 액션 영향 |
|---|---|---|
| J | 상태 | 계약/완료/취소 |
| K | 계약여부 | 계약 시 true |
| L | 수임비 | 계약 시 입력값 |
| M | 미팅사유 | 완료/취소 시 입력값 |
| P | 계약조건 | 계약 시 입력값 |

### 컴포넌트 구조

```
app/(app)/schedule/
  page.tsx                      # 주 컨테이너
  _components/
    SummaryBar.tsx              # 총건/예약/완료/취소/수임비
    DaySection.tsx              # 1일 박스 (헤더 + 카드 리스트)
    MeetingResultCard.tsx       # 5상태 카드 + 펼침 액션 영역
    ContractForm.tsx            # 💵 계약 인라인 폼
    DoneForm.tsx                # 🟠 완료 인라인 폼
    CancelForm.tsx              # 🔴 취소 인라인 폼
  _lib/
    week.ts                     # 주차 유틸 (contact 것과 동일 — 추후 lib/util로 통합)
    state-map.ts                # 상태 ↔ 색상/아이콘 매핑

lib/service/
  contact.ts                    # loadWeekMeetings 추가

lib/query/
  contact-hooks.ts              # useWeekMeetings + 기존 usePatchMeeting 재사용

app/api/meetings/week/[weekStart]/
  route.ts                      # GET
```

## Log
- 2026-04-20 초기 플랜 작성 (prototype 시절)
- 2026-04-29 Phase 분할 확정 + 실제 Next.js 구조에 맞춰 재작성

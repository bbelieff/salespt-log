---
slug: contract-count-exclude-terminated
status: completed
created: 2026-07-13
completed: 2026-07-13
owner: belie
related: contract-termination(completed), db-write-flip, dashboard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 해지한 계약(02 AL 해지일 존재)을 **계약 "수"에서 제외**한다 — 퍼널 계약단계·전환율·아레나 계약건수 전 지점. 매출 규칙은 불변(반환액만 차감).
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 트랙 C(계약해지) 유보 항목의 belie 확정 이관 → DevA 설계 → DevC 구현(02 구역). contract-termination 후속.
> - **읽고 나면 알 수 있는 것**: 계약 수가 어디서 계산되나 / 왜 04 기반이라 02 해지와 매핑이 필요한가 / 그림자 diff 0을 어떻게 지키나 / 무엇이 belie 결정 대기인가
> - **관련 문서**: docs/plans/completed/contract-termination.md §1·§4, db-write-flip.md, worklog 디스패치 DevA/DevC(2026-07-13)

# 해지 계약 '계약 수' 제외

## 0. 스펙 (belie 확정 2026-07-13)
- 해지 계약(`isTerminatedContract` = 02 AL 해지일 존재)은 **계약 수에서 제외** — 퍼널 계약단계·전환율·아레나 계약건수 포함 **전 지점**.
- 실무/수납 건수는 **기구현**(`TERMINATED_IN_CONTRACT_COUNT=false`, payment/page.tsx) — '미확정' 꼬리표 떼고 확정 박제.
- **매출 규칙 불변**: 총매출 = 수임비 + 수납 − 반환액. 반환 없는 해지는 매출 유지(soft delete). 이 PR은 **건수만** 손대고 매출 로직 무접촉.

## 1. 정합성 사실 (설계 전제 — 워크플로우 매핑으로 확인)
- 계약 "수"의 원천은 **전 지점이 04 업체관리 미팅**(상태=계약/계약여부=TRUE). 해지는 **02 계약수납 AL~AO**에만 존재. `writeTermination`은 04 미접촉 → 미팅 기반 카운트엔 해지가 그대로 잡힘.
- 실무/수납 탭만 02를 읽어 이미 제외 중(참고 패턴: `app/(app)/payment/page.tsx:180`).
- 대시보드 계약수 소비자(퍼널·전환율·영업이익카드·채널성과·생산성지표)는 **전부 `channelMatrix.계약` 파생** → 서비스층 단일 차감으로 일괄 전파.
- 아레나: 전광판은 admin/서비스계정으로 전 참가자 시트 read. 계약왕 랭킹(`scoreboard.ts loadIndividualRankings`)은 **이미 참가자별 02(AL~AO 포함) read 중**(매출용) → 해지 제외 추가 read 0. 기수 평균표(`loadScoreboard`)만 payments 미read.

## 2. 설계 원칙 — "원값 파이프라인 불변 + 렌더 직전 오버레이"
- 04 기반 raw(시트 R6:U6 / DB twin 집계)는 **한 글자도 변경 금지**.
- 해지 차감은 **twin·그림자대조 하류의 별도 오버레이 단계**로만 — 새 객체 반환, 원본 무변.
- **그림자 diff 0 유지(최중요)**: `reverseShadowCompare`(dashboard.ts)·`shadowCompareDashboard`는 **raw view**를 받아야 함 → 오버레이는 그림자 dispatch **이후**. assembleView·DB twin(`dashboard-aggregates.ts`)에 차감 넣지 말 것(diff≠0 오탐).
- **시트 쓰기 0**: read-time 순수 변환. 수식 전파 없음. 비파일럿·파일럿 **동일 규칙**으로 표시 계약수만 감소(의도된 feat).

## 3.5 구현 정밀 노트 (dashboard-aggregates.ts 정독 2026-07-13 — 다음 구현 단계 정본)
- **계약 카운트는 04 미팅 파생**(02 아님): `channelStackingFromDb` 계약 = `mt.계약여부 && !CARRYOVER` 채널별 수(`dashboard-aggregates.ts:86`); `weeklyContractsFromDb` = `mt.상태==="계약"` 주차별 수(`:97-102`). 해지는 02 AL → **04 미접촉**이라 미팅 카운트에 그대로 잡힘.
- **차감 = 해지 계약 → 연결 미팅 매핑**: 해지 02행의 `linkedMeetingId`(AK, ContractPayment 필드 확인됨) → 그 미팅(`meeting.id`)의 `channel`·`미팅날짜`. `linkedMeetingId` 부재(레거시) 시 폴백=계약일(=미팅날짜)+업체명 매칭. → `terminatedByChannel`(채널별 −1)·`terminatedByWeek`(주차별 −1). Meeting.channel(F열) 존재 확인.
- **⚠️ 이월 비대칭 검증 필수**: channelStacking 계약은 CARRYOVER 제외인데 weeklyContractsFromDb 는 CARRYOVER 필터 없음(`:97`은 상태·날짜만). → `isExcludedTermination`의 이월 제외가 두 지점에서 다르게 작동할 수 있음. **channelMatrix 차감엔 `!isCarryover` 적용(raw가 이미 이월 제외 → 이중차감 방지), weeklyContracts 차감엔 raw 정의에 맞춰 이월 포함 여부 재확인**(그림자 raw 와 정합되게).
- **오버레이 위치(그림자 diff 0 사수)**: `loadDashboard`에서 `reverseShadowCompare(sheetId, rawView)` **호출 뒤**, rawView 를 **mutate 하지 말고** `applyTerminationExclusion(rawView, byChannel)` 가 **새 DashboardView** 반환. (reverseShadowCompare 는 async IIFE 로 rawView 참조를 나중에 읽으므로 mutate 시 그림자가 subtracted 를 봄 → diff 오탐.) 시트경로는 그림자 없음 → 바로 오버레이.
- **시트경로 04 read 추가**: `loadDashboardFromSheet` 는 meetings 미read → 채널·주차 귀속 위해 04 미팅 1회 추가 read(읽기전용). DB경로는 `meetings` 이미 손안.

## 3. 공용 헬퍼 (신규 `lib/service/termination-count.ts`, 순수함수)
기존 판정 **재사용**(재구현 금지): `isTerminatedContract`·`isCarryoverContract`(`lib/types/contract-status.ts`).

**축마다 판정 규칙이 다르다** (raw 정의에 정합) — 구현 확정(2026-07-13, DevD parity 수정 반영):
- **채널축(PR-A)** — 차감은 **매칭 미팅의 raw 포함조건**(`계약여부 && 구분!=="이월"`)으로 게이트. raw(`channelStackingFromDb`)가 **미팅 flag 로만** 이월 제외(날짜필터 無)하므로, payment 기준 이월판정(`isCarryoverContract`=flag OR 계약일<시작)으로 게이트하면 날짜-캐리오버 계약이 과다계상됨(#549 DevD 발견). → 미팅 게이트로 대칭화.
  - `terminatedByChannel(payments, meetings): {byChannel, unknown}` — `isTerminatedContract` 필터 후 linkedMeetingId(AK)→미팅 channel 조인(폴백 업체명+계약일), 미팅이 `계약여부 && 구분≠이월` 일 때만 차감. 귀속 실패=unknown(호출부 로깅). (courseStartISO 불요 — 미팅 flag 기준.)
- **주차축(PR-B 아레나·PR-C 8주)** — **plain `isTerminatedContract`**(이월 미필터). raw(weeklyContracts / 시트 N·C33:H40)는 CARRYOVER 필터 없이 미팅날짜 주차만 세므로 이월 해지도 빼야 정합. 날짜기반 이월(계약일<시작=week0)은 **주차 가드(1~8)** 로 raw 와 동일하게 자연 제외.
  - `terminatedByWeek(payments, courseStart): number[8]` — **미팅 불요**(계약일=미팅날짜로 버킷, weekIndexOf·parseISO 는 weeklyContractsFromDb 와 동일 규칙). 추가 read 0.
  - `countTerminatedInWeeks(payments, courseStart): number` — 8주 내 총수(terminatedByWeek 합). 아레나 계약왕·기수평균 총합용.
- ~~countTerminatedTotal~~ 미채택: 주차 가드 없는 총량은 어느 raw 와도 불일치 → countTerminatedInWeeks(주차 가드)로 대체.

## 4. PR 분할
- **PR-A (대시보드, 최우선)**: `termination-count.ts` + `loadDashboard` 오버레이(그림자 이후) + 시트경로 04 read 1회 추가(채널귀속용, 읽기전용) + 회귀테스트. → 퍼널 계약단계·전환율·영업이익카드·채널성과 일괄 반영.
- **PR-B (아레나)**: `scoreboard.ts` 계약왕 총차감(저비용, 한 줄) + 기수 평균표.
- **PR-C (선택)**: WeeklyDualChart 8주 계약라인·schedule SummaryBar — "전 지점" 확정 시.

## 5. 리스크 (높은 순)
1. 그림자 diff 0 파괴(차감이 twin/그림자view로 새면 Sentry 오탐) → dispatch 후 오버레이 + `view==raw` 테스트.
2. 채널귀속 부정확(linkedMeetingId 결측) → `max(0,…)` 클램프 + unknown 로깅 + 폴백매칭.
3. 이월 이중차감 → `!isCarryoverContract` 필터.
4. 기수평균 35+ read → 30분 캐시 or 계약왕만.
5. 표면 간 불일치(일부만 제외) → §6 스코프 선확정.

## 6. belie 결정 (2026-07-13 확정)
- **A. "전 지점" 범위 = 전부(더 넓게)**: 대시보드(퍼널·전환율·영업이익·채널성과·생산성비율) + 8주 추이 그래프 + 주간요약 카운터 + 아레나 계약왕 + **아레나 기수 평균표**(참가자별 02 read 비용 감수 확정).
- **B. 해지 판정 = 해지일 찍힌 계약 전부**(`isTerminatedContract`, 실무/수납·`TERMINATED_IN_CONTRACT_COUNT`와 통일). 해지숨김만 아님.
- **C. 기수 평균표 제외 = 예**(35+ read 감수, 30분 캐시로 완화).
- **D. 채널귀속 실패 정책**: 폴백매칭(업체명+계약일) 시도 → 실패분은 총합엔 반영·채널별엔 unknown 로깅(채널합이 퍼널총합보다 미세 작을 수 있음 허용). 음수는 `max(0,…)` 클램프.
- 구현 순서(원자 PR, 직렬 머지): **PR-A 대시보드 → PR-B 아레나(계약왕+기수평균) → PR-C 스케줄 주간요약**.

## 7. 수용 기준
- 그림자 diff 0 불변(해지 픽스처로도 diff 0) + view==raw 단언. 채널귀속·이월이중차감·음수클램프 단위테스트. `TERMINATED_IN_CONTRACT_COUNT` 토글 양방향.
- **비파일럿 불변**(시트경로 raw 서빙 무변). 해지 실계정 케이스(전액반환+숨김 → 건수·퍼널 제외, 매출 0) 검증. check.sh 초록. §6.8 배포 관찰.

## Log
- 2026-07-13 계획 등재(DevA): 워크플로우 4표면 매핑(dashboard-funnel·arena-scoreboard·payment-ui·twin-mechanism) + 합성 설계. 아레나 feasibility=가능(계약왕 무료, 기수평균만 비용). belie 스코프 결정 4건 대기(§6).
- 2026-07-13 PR-A 구현(DevC): A 설계 인계. `termination-count.ts`(isExcludedTermination·terminatedByChannel) + `loadDashboard` 오버레이(그림자 dispatch 이후, 새 view 반환·raw 무변) 양경로(DB=meetings 손안·시트=findByDateRange 재사용 read). channelMatrix.계약만 차감(퍼널·전환율·채널성과 일괄), weeklyTrend 는 PR-C. 단위테스트(귀속·이월이중차감·음수클램프·view==raw). meetings.ts 미수정(findByDateRange 호출만 — A의 04 쓰기 구역 무접촉). #549 머지·배포·health 200.
- 2026-07-13 PR-B 구현(DevC): 아레나 `scoreboard.ts`. 주차축 헬퍼 신규(`terminatedByWeek`·`countTerminatedInWeeks` — 계약일 주차버킷, plain isTerminated). ①계약왕 loadIndividualRankings: `계약 -= countTerminatedInWeeks`(payments·courseStart 이미 손안, 추가 read 0). ②기수평균 loadScoreboard: 참가자별 payments+courseStart read 추가(30분 캐시 공유)→주차별 `acc.계약 -= termWeeks[w]`·총합 차감, 음수 클램프. **자율결정(reversible)**: 주차축=plain isTerminated(이월 미필터)+주차가드 — raw(C33:H40)가 이월필터 없다는 정합 판단(시트수식 미실측 불확실성은 max(0) 클램프+rare edge 로 흡수). revert=차감줄 제거 or isExcludedTermination 로 교체. 매출·앱사용량 무변.
- 2026-07-13 채널축 parity 수정(DevC, fix-forward · DevD 발견): PR-A 의 `terminatedByChannel` 이 `isExcludedTermination`(payment 이월=flag OR 계약일<시작)로 게이트 → raw `channelStackingFromDb`(미팅 flag 로만 이월제외)와 비대칭 → 날짜-캐리오버 해지계약 **과다계상**. 수정 = 차감을 **매칭 미팅의 raw 포함조건(`계약여부 && 구분!=="이월"`)** 으로 게이트해 대칭화(courseStartISO 인자 제거). `isExcludedTermination` 제거(orphan). 회귀테스트 추가(미팅 이월/계약여부false/날짜캐리오버-native). revert=`git revert`. (weekly 축은 이미 대칭이라 무영향.)
- 2026-07-13 PR-C 구현(DevC, 최종 조각): ①**대시보드 8주 추이** — `applyTerminationExclusion` 에 `byWeek` 인자 추가, `weeklyTrend.계약수` 도 차감(양경로 `terminatedByWeek(payments, courseStart)` 계산, 그림자 dispatch 이후 새 배열·raw 무변 → diff 0). DB경로 추가read0, 시트경로는 PR-A readCourseMeetings 재사용(순증분0). ②**스케줄 SummaryBar** — `계약` 카운터에서 해지 제외(로컬, useContractPayments 이미 마운트 → 추가read0, commissionSum 동일 키 `미팅날짜=계약일|업체명` 조인). 단위테스트+4(weeklyTrend 차감·클램프·불변·byWeek생략). **전 지점 완료** → `Changelog-Done` 로 '해지계약수제외' 그룹 수강생 공개. **스펙 완주** → completed 이동.

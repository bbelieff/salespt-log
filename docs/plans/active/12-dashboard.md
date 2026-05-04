---
slug: 12-dashboard
status: plan
pdca_stage: plan
created: 2026-05-05
worktree: ../wt/dashboard-plan
related:
  - [[wiki/topics/salespt-log-roadmap]]
  - 11-contract-payment-tab (수임비 데이터 source)
  - 10-db-management (비용 데이터 source)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드(`/`) PDCA Plan — 영업이익·퍼널·8주 추이를 Recharts로 read-only 시각화
> - **누가 읽나요**: 개발자, 사용자(요구사항 검증)
> - **어떤 기능·작업과 연결?**: `app/(app)/page.tsx`, 대시보드 자동작성 시트, 영업관리 J3:L6, recharts 패키지
> - **읽고 나면 알 수 있는 것**: 카드/차트 layout, 시트 데이터 흐름, Architecture, 리스크
> - **관련 문서**: [[docs/domains/sheet-structure.md]] §1 대시보드, [[docs/plans/active/11-contract-payment-tab.md]]

# 12 — 대시보드 (PDCA Plan)

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | 모든 입력 탭(컨택/일정/캘린더/계약수납/DB)이 완성됐는데 결과 종합 화면 없음. 사용자가 "지금 영업이익 얼마?" 답을 못 봄. |
| **Solution** | 시트 자동집계(대시보드 자동작성 + 영업관리 J3:L6) read-only 시각화. 카드(영업이익/율) + 차트(채널별 퍼널 + 8주 추이). |
| **Function/UX** | 진입 시 한눈에 종합. 모바일 우선 — 카드 세로 stack + 차트 한 화면씩. |
| **Core Value** | "지금 영업 잘 되고 있나?" 를 3초 안에 알 수 있는 화면. CLAUDE.md "대시보드는 시트가 계산, 앱은 그리기만" 원칙 준수. |

## Context Anchor

| Key | Value |
|---|---|
| **WHY** | 입력만 쌓이고 결과 화면 없으면 사용자 동기 부여 안 됨. 영업이익 표시 = 게이미피케이션 + 비즈니스 가시성 |
| **WHO** | 수강생 1인칭 — 매일 또는 주기적으로 본인 성과 확인 |
| **RISK** | 시트 자동집계 셀이 정확한지 불명 (사용자 검증 필요). Recharts 모바일 width 이슈. read 비용 (시트 quota) |
| **SUCCESS** | / 진입 시 영업이익/율 카드 + 채널별 퍼널 차트 + 8주차 추이 한 화면에 표시, dev 모드에서 실데이터 확인 |
| **SCOPE** | 읽기 전용. 시트 셀 직접 read + Recharts 렌더링. 입력/저장 X. 인증/배포 OUT. |

## 핵심 데이터 흐름 (단순화)

```
시트 (이미 모든 집계 완료, 앱은 대시보드 탭만 read)
  대시보드(자동작성) 탭 → 카드 KPI + 차트 데이터 모두 여기서

앱 (Recharts + 카드)
  대시보드 탭의 셀들을 React 컴포넌트에 매핑
  영업이익 = D21 − E21
  영업이익률 = 영업이익 / D21
  그 외 카드/차트 셀은 prototype에서 확정
```

## 시트 read 전략

### 단일 1회 read
`대시보드(자동작성)!A1:Z40` (또는 prototype 확정 후 정확 범위로 좁힘)

API: `GET /api/dashboard` → 시트 영역 read + 클라이언트 매핑.

캐시: `["dashboard"]`, **5분 stale** (Q5 자동). React Query stale 정책으로 자동 refetch.

## Acceptance Criteria

### 시트 SSOT
- [ ] 사용자가 "대시보드 자동작성 탭 정확 셀 매핑" 확정 (Q1 참조)
- [ ] `docs/domains/sheet-structure.md` §1 대시보드 섹션을 read-only 셀 명세로 update

### 백엔드
- [ ] `lib/types`에 `DashboardView` 타입 (카드 + 차트 데이터)
- [ ] `lib/repo/dashboard.ts` — `readDashboard(spreadsheetId)`: 대시보드 탭 1회 read
- [ ] `lib/service/dashboard.ts` — `loadDashboard(email)`: 셀 좌표 → 도메인 객체 매핑
  - mapKPI (영업이익/율/총매출/총비용 카드)
  - mapChannelMatrix (채널별 퍼널 차트 데이터)
  - mapWeeklyTrend (8주차 추이 차트 데이터)
- [ ] `app/api/dashboard/route.ts` — GET
- [ ] `lib/query/dashboard-hooks.ts` — `useDashboard()` (staleTime: 5분)
- [ ] `recharts` 의존성 (이미 package.json — 사용만)

### 프론트
- [ ] `/` 페이지 — `app/(app)/page.tsx` 작성 (현재 미구현 또는 placeholder)
- [ ] 슬림 브랜드 바 + 페이지 배너 (📊 대시보드)
- [ ] **영업이익 카드**: 큰 숫자 + 영업이익률 sub
- [ ] **총매출/총비용/누적수납 3카드** grid
- [ ] **채널별 퍼널 BarChart**
- [ ] **8주차 추이 LineChart** (X: 1주~8주, Y: 활동량 또는 영업이익)
- [ ] **비용 구성 PieChart** (3 비용 채널)
- [ ] 새로고침 버튼 (수동 invalidate)
- [ ] 모바일 폭 ≤ 390px 가독성 확인

### 비기능
- [ ] 시트 read = 1회 (batchGet)
- [ ] 5분 stale 캐시
- [ ] Recharts ResponsiveContainer로 모바일 적응

## PDCA 단계 (이 plan의 진행 흐름)

### Plan (← 이번 PR)
✅ 이 문서. AC + 리스크 + Architecture options.

### Design
**산출물**:
1. 사용자 시트 셀 매핑 확정 (Q1·Q2)
2. SSOT update — sheet-structure.md §1 read-only 셀 명세
3. prototype HTML (사용자 task — 모바일 카드+차트 layout)
4. Architecture 결정 (아래 Q3 참조)

### Do
**산출물**: `feat/dashboard` PR
- types/repo/service/api/hooks
- `/` 페이지 + Recharts 컴포넌트 분리
- prototype 픽셀 매칭

### Check
- gap analysis (prototype vs UI, AC 항목별)
- 실데이터 검증 (사용자 시트로 dev 모드)

### Act
- plan completed 이동 + 회고

## Architecture Options (Design 단계 결정)

### Option A — 단순 1 read + 인메모리 매핑
- 1회 batchGet → 모든 셀
- service에서 모두 매핑
- **장점**: 코드 단순, quota 효율
- **단점**: 시트 layout 변경 시 매핑 코드도 변경

### Option B — 도메인별 분리 (`readDashboardKPI` + `readChannelMatrix` + `readWeeklyTrend`)
- 3 개 작은 서비스 함수
- 각각 batchGet (또는 1번 합쳐도 됨)
- **장점**: 테스트 단위 작음, 도메인 명확
- **단점**: 코드 양 늘어남

### Option C — Hybrid (추천)
- 1 read 유지 (quota)
- service만 도메인별 함수로 분리 (dashboard.ts 안에 `mapKPI / mapChannelMatrix / mapWeeklyTrend`)
- **장점**: read 효율 + 코드 가독성
- **단점**: 없음

## Risks / 결정 필요

### R1. 대시보드 셀 매핑 ⏳
영업이익(D21−E21) 외 다른 카드/차트의 정확 셀 좌표.
- **대응**: prototype에서 결정. 시안 디자이너가 시트 보고 셀 명시.

### R2. Recharts 모바일 width
390px 폭에서 차트 라벨 잘림.
- **대응**: ResponsiveContainer + axis 회전.

### R3. read quota
5분 stale로 충분 (사용자 매일 진입 시 1회 read만).

### R4. ✅ 영업이익 계산 확정
대시보드 탭 D21 − E21. 수임비/비용 직접 집계 안 함.

### R5. ✅ 누적 수납액
시트 대시보드 탭에 이미 있음. read만.

## 사용자 답변 정리 (Checkpoint 1·2 확정)

| Q | 답 | 의미 |
|---|---|---|
| Q1 | **시트 그대로** | 대시보드(자동작성) 탭 layout을 그대로 따름. 우리가 별도 집계 X |
| Q2 | (prototype 확정) | 8주차 추이도 대시보드 탭에서 직접 read — 영업관리 J3:L6 등 별도 영역 신경 X |
| Q3 | **C (Hybrid)** | 1 read + service 도메인 매핑 분리 |
| Q4 | **대시보드!D21 − E21** | 총매출(D21) − 총비용(E21) = 영업이익. 대시보드 탭에서 직접 read |
| Q5 | **자동** | 진입 시 자동 fetch + 5분 stale |

## 핵심 단순화

Q1·Q4 답변으로 모델 단순화:

- **영업관리 J3:L6 read 불필요** — 시트 대시보드 탭에 이미 자동집계되어 있음
- **04 업체관리 직접 집계 불필요** — 마찬가지
- **앱은 대시보드(자동작성) 탭만 read** — 한 번의 batchGet이면 충분
- **영업이익 = D21 − E21** — 시트 자동집계 결과 그대로 사용

→ Architecture C가 더 단순화됨: 1 read (대시보드 탭만) + 시트 셀 좌표 → React 컴포넌트 매핑

## 다음 결정 필요 (Design 단계)

### D1. 대시보드 셀 매핑 상세
- 영업이익 = D21 − E21 ✅
- 그 외 카드/차트 셀은? (예: 채널별 퍼널 어디? 8주차 추이 어디?)
- **대응**: prototype HTML이 답을 가져옴 — prototype 디자이너가 시트 layout 그대로 보고 셀 좌표 명시할 것

### D2. 카드/차트 layout
- prototype에서 결정

## 의존성 / 선행 조건

- ✅ DB관리 (PR #37) — 비용 데이터
- ✅ 계약수납 (PR #38·39·40) — 수임비 추적
- ⏳ Phase 1 cleanup (chore PR open) — DailyRevenue 폐기 후 dashboard read에서 deprecated 영역 안 만지게
- ⏳ 사용자 시트 셀 매핑 답변
- ⏳ prototype HTML

## Log
- 2026-05-05 Plan 초안 — 대시보드 PDCA 시작
- 2026-05-05 사용자 답변 5/5 정리:
  - Q1=시트그대로, Q2=prototype에서 확정, Q3=C(Hybrid), Q4=대시보드!D21-E21, Q5=자동
  - 영업관리/04 업체관리 직접 집계 제거 → 대시보드 탭 1회 read로 단순화

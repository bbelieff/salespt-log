---
status: completed
slug: 12-dashboard
pdca_stage: plan
created: 2026-05-05
worktree: ../wt/dashboard-plan
related:
  - [[wiki/topics/salespt-log-roadmap]]
  - 11-contract-payment-tab (수임비 데이터 source)
  - 10-db-management (비용 데이터 source)
completed: 2026-05-11
archived: 2026-07-12
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

## 핵심 데이터 흐름

```
시트 (이미 자동집계됨, 앱은 read만)
  대시보드(자동작성) 탭         → 카드 KPI 직접 read
  01 영업관리!J3:L6              → 채널별 생산총합/계약총합/계약당단가
  01 영업관리 8주차 합계 라인     → 주차별 생산/유입/컨택진행/컨택성공/계약/활동량
  04 업체관리!L (계약 상태만)     → 수임비 합계
  03 DB관리 채널별 합계          → 비용 합계

앱 (Recharts 그리기)
  Card        영업이익 = 수임비 합계 − (매입DB + 직접생산 + 현수막) 합계
  Card        영업이익률 = 영업이익 / 수임비 합계
  Card        총매출(수임비) / 총비용 / 누적 수납액
  BarChart    채널별 퍼널 (생산→유입→컨택→미팅→계약)
  LineChart   8주차 추이 (활동량 또는 영업이익 누적)
  PieChart    비용 구성 (매입DB / 직접생산 / 현수막 비율)
```

## 시트 read 전략 (quota 절약)

### 단일 batchGet으로 1회 read
다음 영역 전부를 1번의 `spreadsheets.values.batchGet`으로 가져옴:
- `대시보드(자동작성)!A1:Z30` (전체 카드 영역 — 사용자 확정 후 좁힘 가능)
- `01 영업관리!J3:L6` (채널 4행 × 3컬럼)
- `01 영업관리 8주차 합계 라인` (사용자 확정 — 어느 row?)

API: `GET /api/dashboard` → 모든 데이터 한 번에 fetch + 클라이언트 매핑.

캐시 키: `["dashboard"]`. invalidate는 다른 탭 mutation 후 자동 — 단, **너무 자주 invalidate 안 함** (수동 새로고침 버튼 또는 5분 stale).

## Acceptance Criteria

### 시트 SSOT
- [ ] 사용자가 "대시보드 자동작성 탭 정확 셀 매핑" 확정 (Q1 참조)
- [ ] `docs/domains/sheet-structure.md` §1 대시보드 섹션을 read-only 셀 명세로 update

### 백엔드
- [ ] `lib/types`에 `DashboardView` 타입 (카드 + 차트 데이터)
- [ ] `lib/repo/dashboard.ts` — `readDashboard(spreadsheetId)`: batchGet으로 모든 영역 1회 read
- [ ] `lib/service/dashboard.ts` — `loadDashboard(email)`: 시트 데이터를 Recharts 친화 형태로 매핑
- [ ] `app/api/dashboard/route.ts` — GET
- [ ] `lib/query/dashboard-hooks.ts` — `useDashboard()` (5분 stale)
- [ ] `recharts` 의존성 추가 (이미 package.json에 있음 — 사용만)

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

### R1. 시트 자동집계 셀 위치 ⏳
대시보드 자동작성 탭의 정확한 카드 셀, 영업관리 8주차 합계 row, DB관리 합계 셀 위치 — 사용자 확정 필요.
- **대응**: Design 단계에서 사용자가 시트 캡처 또는 셀 좌표 알려주기.

### R2. Recharts 모바일 width
390px 폭에서 BarChart 5개 채널 표시 시 라벨 잘림.
- **대응**: ResponsiveContainer + axis 회전 또는 가로 스크롤.

### R3. read quota
새로고침 버튼 누를 때마다 read. 사용자가 자주 누르면 quota 영향.
- **대응**: 5분 stale + 새로고침 후 1분 cooldown 또는 toast 안내.

### R4. 영업이익 계산 정확성
영업이익 = 수임비 − DB비용. 단, 수임비 출처가 04 업체관리!L인지, 시트 자동집계 어딘가에 있는지 확정 필요.
- **대응**: 사용자 답변(Q4) 후 service 매핑 확정.

### R5. 누적 수납액 표시 의미
계약수납탭의 수납액 합계가 "수임비 회수 진척"인지 별도 매출인지.
- **plan 문서 확인**: 11-contract-payment-tab.md — "수납액은 회수 진척용. 영업이익에는 수임비를 사용".
- **대응**: 카드는 정보 표시만, 영업이익 계산엔 수임비 사용.

## 사용자 답변 필요 (Checkpoint 1·2)

### Q1. 대시보드 자동작성 탭 — 어떤 카드를 어디서 가져오나?
시트의 "대시보드(자동작성)" 탭에 이미 표시되는 항목들 중 우리 앱이 read해야 할 카드/차트는?
- (a) 그대로 시트 layout 따라 — 셀 좌표 명시 필요
- (b) 우리가 새로 정의 — 영업관리 / 계약수납 / DB관리에서 직접 집계
- (c) 혼합

### Q2. 영업관리 8주차 합계 — 어느 row?
주차별 추이 그릴 때 8개 row 필요. blockStart=10이고 stride=34라면 합계 행이 row 38, 72, 106... 같은 패턴? 사용자 확정.

### Q3. Architecture — A/B/C 중?
Option C (Hybrid) 추천 — 1 read + service 도메인 분리.

### Q4. 영업이익 계산 출처
- (a) 04 업체관리!L 합계 (계약 상태 row만)
- (b) 시트 자동집계 셀 (대시보드 또는 영업관리 어딘가)
- (c) 둘 다 표시 (검증용)

### Q5. 새로고침 정책
- (a) 진입 시 자동 fetch + 5분 stale
- (b) 진입 시 자동 + 사용자 새로고침 버튼
- (c) 사용자 명시 새로고침만 (자동 X)

## 의존성 / 선행 조건

- ✅ DB관리 (PR #37) — 비용 데이터
- ✅ 계약수납 (PR #38·39·40) — 수임비 추적
- ⏳ Phase 1 cleanup (chore PR open) — DailyRevenue 폐기 후 dashboard read에서 deprecated 영역 안 만지게
- ⏳ 사용자 시트 셀 매핑 답변
- ⏳ prototype HTML

## Log
- 2026-05-05 Plan 초안 — 대시보드 PDCA 시작

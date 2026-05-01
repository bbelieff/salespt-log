---
slug: 11-payment-redesign
status: plan
pdca_stage: plan
created: 2026-05-01
worktree: ../wt/payment-plan
supersedes: 09-payment-tab (Phase 2 — UX/UI 폴리싱 + 시안 매칭)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수납 탭 Phase 2 redesign — PDCA 사이클로 prototype 매칭 픽셀 포팅
> - **누가 읽나요**: 개발자 (PDCA 각 단계 진행 가이드)
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/`, prototype `docs/design/prototypes/payment-*.html` (예정)
> - **읽고 나면 알 수 있는 것**: 왜 redesign하는가, 어떤 결정을 PDCA 어디서 검증하는가, 산출물 무엇
> - **관련 문서**: [[09-payment-tab.md]] (Phase 1 완료), [[docs/design/prototypes/db-management.html]] (참조 톤)

# 11 — 수납 탭 Phase 2 (Redesign · PDCA)

## Executive Summary
수납 탭(`/payment`)은 사용자가 매일 입력하는 핵심 화면이지만 Phase 1은 prototype 없이 즉석 디자인으로 구현되어 다른 5탭과 톤이 어긋남. DB관리 탭(prototype v11 매칭) 직후, 같은 픽셀 매칭 품질로 polishing.

## 왜 지금 redesign하는가 (Intent)

### 1. 사용자 매일 사용 화면 — 영업이익 = 매출(여기) − 비용(DB관리)
"비용 입력 페어"인 DB관리는 prototype 매칭이 끝났지만 "매출 입력 페어"인 수납은 즉석. 입력 사이클의 톤이 비대칭.

### 2. 즉석 디자인의 한계 (Phase 1 회고)
- 슬림 브랜드 바·페이지 배너 부재 (다른 탭과 헤더 톤 불일치)
- 종합/요약 카드 패턴 부재 — 매출 합계·평균 수임비 같은 한눈 요약 없음
- 단순 `MetricStepper` 4개 = 입력 무드만, 의미적 group/색상 없음
- 비고 영역의 활용도 낮음 (어디서 들어온 매출인지 분류 불가)

### 3. 대시보드(`/`) 작업의 전제
대시보드는 수납·DB관리 데이터를 둘 다 읽어 영업이익 차트를 그려야 함. 수납 데이터 모델을 안정화한 뒤 대시보드로 가는 게 fork-merge 줄임.

## PDCA 단계 정의 (이 plan의 진행 흐름)

### Plan (← 이번 PR)
✅ **이 문서**가 산출물. AC, 스코프, 리스크, 의존성, 검증 기준 명시.

### Design
**산출물**: `docs/design/prototypes/payment-daily-input.html` (사용자가 별도 채팅에서 prototype 받아서 추가)

요구사항:
- 다른 4 prototype과 동일한 시각 톤 (slim brand bar + page banner + bottom 5 nav)
- 4 입력 필드 + 의미적 그룹화 (예: "승인/수납" 짝, "금액/비고" 짝)
- "이번 달 누적" 또는 "이번 주 누적" 같은 컨텍스트 카드 (선택)
- 자동수식 컬럼 표시 패턴 통일 (DB관리 v11과 같은 🔒 자동 라벨, 단 수납엔 적용 컬럼 없음)
- 모바일 입력 키패드 최적화 (numeric, 만원 단위)

### Do
**산출물**: React 포팅 PR (`feat/payment-redesign`)

작업 범위:
- 백엔드 (`lib/repo/sales.ts`, `lib/service/payment.ts`, `/api/payment/[date]`) 변경 X — 그대로 재사용
- UI만 prototype 따라 픽셀 매칭으로 재작성
- 컴포넌트 분리 (DB탭처럼 `_lib/`, `_components/`)
- 추가 데이터 모델 변경 시 (예: 카테고리 필드) 별도 ADR + types/repo 동시 수정

### Check
**검증 항목**:
- [ ] gap analysis: prototype과 React UI 픽셀 비교 (Chrome DevTools)
- [ ] 모든 입력 검증 (paymentCount ≤ approvalCount, paymentCount=0 → amount=0) 동작
- [ ] 시트 round-trip (작성 → 새로고침 → 동일 값) 무손실
- [ ] 다른 4탭과 헤더/배너/네비 일관성
- [ ] structural / lint / typecheck 통과
- [ ] 파일당 ≤ 500줄

### Act
**산출물**: 이 plan을 `completed/`로 이동 + 회고 1줄

회고 항목:
- prototype 매칭에서 발견된 차이 (있다면)
- 다음 redesign(컨택/일정/캘린더 폴리싱)에 적용할 학습

## Acceptance Criteria (Phase 2)

### 필수
- [ ] `docs/design/prototypes/payment-daily-input.html` 존재
- [ ] `/payment` 페이지가 위 prototype 픽셀 매칭
- [ ] 다른 4탭과 동일한 슬림 브랜드 바 + 페이지 배너
- [ ] DB관리 탭의 카드/색상 톤과 일관 (특히 자동수식 표시 — 적용되는 부분이 있다면)
- [ ] Phase 1 동작은 모두 보존 (날짜 네비, 4 필드, 검증, 저장)

### 데이터 모델 변경 (있다면)
- [ ] 새 필드 추가 시 시트 컬럼·zod 스키마·service 동시 수정
- [ ] 변경 시 ADR `docs/decisions/NNNN-payment-schema-evolution.md` 작성

### 비기능
- [ ] 모바일 터치 영역 ≥ 44px
- [ ] save mutation은 stateless 패턴 (date를 mutate args로)
- [ ] 시트 quota: 1회 저장 = read 1 + write 1 이하 유지

## 스코프 (Scope)

### In
- UI 픽셀 매칭 (slim brand bar / page banner / 카드 톤)
- 컴포넌트 분리 (현재 page.tsx 단일 → _lib + _components)
- prototype에 새 필드 있으면 데이터 모델 동시 확장 (ADR 동반)

### Out (별도 plan)
- 인증 / 다중 사용자 (01 auth-onboarding)
- 대시보드 영업이익 계산 (별도 PR — 이 PR이 수납 데이터 안정화 후)
- 수납 데이터의 history 차트 (대시보드 영역)
- 일별이 아닌 주별/월별 입력 (YAGNI)

## Risks / 결정 필요

### R1. 데이터 모델 변경 가능성
prototype이 새 컬럼(예: 매출 카테고리, 거래처)을 도입할 수 있음.
- **대응**: prototype 받은 후 변경 범위 평가 → 작으면 같은 PR, 크면 ADR 분리

### R2. 사용자 매일 쓰는 화면 → 회귀 위험
Phase 1 사용자가 입력 패턴에 익숙해진 상태일 수 있음.
- **대응**: 입력 필드 의미는 보존, 추가/그룹화만. 키보드 흐름(tab order) 동일하게.

### R3. prototype 의존
Design 단계가 사용자 수동 작업.
- **대응**: 이 plan PR이 머지된 후 prototype prompt를 별도 메시지로 제공.

### R4. 시트 합계 행 보존
Phase 1에서 `writeDailyRevenue`가 영업관리 Q~T를 덮어씀. 시트에 합계 수식이 있다면 보존되는지 확인 필요.
- **대응**: Check 단계에서 시트 합계행 비교 (DB탭 prototype 작업 때 같은 패턴 검증).

## 의존성 / 선행 조건
- ✅ Phase 1 백엔드 (lib/repo/sales.ts `readDailyRevenue` + `writeDailyRevenue`)
- ✅ DB관리 prototype v11 (시각 톤 참조용)
- ⏳ Design 산출물 — 사용자가 별도 채팅에서 prototype 받기

## 산출물 (PR 단위)

| 단계 | PR | 변경 영역 |
|---|---|---|
| Plan | **이번 PR** (`docs/payment-redesign-plan`) | docs only — plan + housekeeping |
| Design | (PR 없음) | 사용자 task — prototype HTML 추가는 docs/prototypes-update 식 별도 PR |
| Do | `feat/payment-redesign` | UI 재작성 (백엔드 무변경) |
| Check | (Do PR에 통합) | gap analysis 결과 PR 본문 |
| Act | `docs/payment-redesign-act` (or housekeeping에 묶기) | plan completed로 이동 + 회고 |

## Log
- 2026-05-01 Plan 작성 — Phase 1 완료 회고 + Phase 2 의도 정리

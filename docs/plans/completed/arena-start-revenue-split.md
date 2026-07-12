---
status: completed
slug: arena-start-revenue-split
created: 2026-06-18
owner: belie
related: arena-carryover-migration, sheet-structure, data-model
completed: 2026-06-18
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 아레나 시작일(개인 시트 O1) 기준으로 그 이전 계약은 "이월(비집계)", 이후는 "아레나(집계)"로 나누고, 이전 계약업체를 실무·수납용으로 직접 등록하는 기능.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 02 계약수납(append/이월 깃발), 대시보드 매출/영업이익, 실무수납 요약, setup-formulas(전 시트 전파), arena-carryover
> - **읽고 나면 알 수 있는 것**: 경계는 무엇으로 정하나(하드코딩 금지), 이월/아레나 분리는 어디서 결정되나, 직접 등록은 어떻게 적재되나
> - **관련 문서**: arena-carryover-migration.md, docs/domains/sheet-structure.md, docs/domains/data-model.md

# 아레나 시작일 기준 매출 분리 + 이전 계약업체 등록

## 0. 핵심 원칙
- **경계 = 아레나 시작일(개인 시트 O1 = courseStart, ADR-0005 SSOT)**. "6/12" 류 날짜 하드코딩 금지 — 코드는 항상 시트 시작일을 읽어 비교. 시즌마다 다름.
- 시작일 **이전** 계약 = 이월(아레나 비집계), **이후** = 아레나 집계.
- 적재/제외 = 기존 이월 깃발 재사용(02 구분 AI=이월).

## 1. 이월 판정 — 단일 결정점 (읽기시점 분류)
- `isCarryoverContract({구분, 계약일}, courseStartISO)` (lib/service/contract-payment.ts):
  `구분=이월` **또는** `계약일 < courseStart(ISO)` → 이월. 날짜는 ISO 일 때만 비교(직렬/비정형은 깃발만).
- **읽기시점 분류** — 기존 행의 AI값을 소급 기록하지 않음(데이터 무변경, belie 결정 2026-06-18). 날짜가 진짜 경계, 깃발과 어긋나도 같은 함수 하나로 판정.

## 2. A) 이전 계약업체 직접 등록 (PR1 데이터 + PR2 UI)
- 서비스 `addPriorContract(email, cp)`: `appendFromContract(C/D/E + AI=이월, 멱등키 prior:<uuid>)` → `updateUserFields(F~AH 슬롯·서류)`. 미팅 출발 아님 → 이월 강제.
- UI(PR2): 실무수납 상단 [이전 계약업체 등록] → 알림 모달("{courseStart} 이전 계약은 아레나 비집계, 실무·수납용") → **ContractForm 재사용** → 저장. 카드에 이월 뱃지+흐린 색(CarryoverBadge 기존).

## 3. B) 집계 분리 (PR1 데이터 + PR2 UI)
- **앱 대시보드(학생 화면)는 JS 재계산이 정본**: `splitContractRevenue(payments, courseStartISO)` → `{arena, carryover, total}` (lib/service/dashboard.ts). loadDashboard 가 O1 읽어 분리. 점수·전광판·영업이익 = **arena 만**(기존 유지). kpi 에 `이월매출`·`전체매출` 추가.
- **시트 수식(부차 — 직접 시트 열람용)**: 02!D3=아레나 수납총액(구분≠이월, 기존), 02!D4=이월 수납총액(구분=이월, 신규). `CONTRACT_RECEIVED_FORMULAS{arena,carryover}` + 단위테스트. §2.5 pre-read 보존가드.
- UI(PR2): 대시보드 매출/영업이익 블록 2줄+전체("아레나 집계 / 이월(비집계) / 전체", {시작일} 동적 표시). 실무수납 요약 카드 2개(아레나/이월).

## 4. 배포 의존성 (2026-06-18 현재)
- VPS SSH/배포가 막혀 있어 **시트 installFormulas(전 37시트 전파)·대시보드 실측은 배포 복구 후** belie/admin 이 수행·검증. PR 코드·CI·단위테스트는 무관하게 진행.
- 시트 수식은 carryover-revenue-leak(2026-06-12) 영역 — 라이브 검증 전까지 D4 셀 위치는 잠정(§2.5 가드로 데이터 손실은 없음). 배포 후 in-sheet 대시보드 2줄 레이아웃 최종 확정.

## 5. 검증 (수용 기준)
- 시트 시작일을 바꿔도 경계가 따라 움직임(하드코딩 0) — isCarryoverContract/splitContractRevenue 단위테스트.
- 이월 계약 등록 → 아레나 매출·점수·전광판 불변, 이월 매출만 증가.
- 대시보드 2줄 + 전체 합 일치, 실무/수납 카드 분리 일치(PR2).

## Log
- 2026-06-18 PR1(feat/prior-contract-register-carryover-split): isCarryoverContract·splitContractRevenue·addPriorContract·kpi(이월매출/전체매출)·02 D4 SUMIFS + 단위테스트. UI(버튼·모달·대시보드 2줄·수납 카드)는 PR2. 시트 설치·실측은 배포 복구 후.
- 2026-06-18 PR2(feat/prior-contract-register-ui): isCarryoverContract → @/types 이전(클라 공용, googleapis 비의존, service 재노출). POST /api/contract-payment/prior + useAddPriorContract. PriorContractSection(버튼·알림모달 동적 시작일·ContractForm 재사용·아레나/이월 2카드). payment billable·ContractRow 뱃지/흐림 = isCarryoverContract(동적). 대시보드 OperatingProfitCard 매출 3줄(아레나/이월/전체). 점수·전광판·영업이익은 아레나만(불변).

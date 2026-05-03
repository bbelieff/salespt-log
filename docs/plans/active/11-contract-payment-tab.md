---
slug: 11-contract-payment-tab
status: plan
pdca_stage: plan
created: 2026-05-01
updated: 2026-05-02
worktree: ../wt/payment-plan
supersedes: 09-payment-tab (Phase 1 — 일별 합계 모델 폐기)
related: 03-meeting-results (일정·계약 탭 — 계약 액션 발신 측)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수납 탭을 "계약수납탭"으로 재정의 — 일별 합계 X, 계약 단위 추적
> - **누가 읽나요**: 개발자 (PDCA 가이드), 사용자(요구사항 정합성 검증)
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/`(이름 변경 검토), 02 계약수납관리 시트, 일정·계약 탭 계약 액션
> - **읽고 나면 알 수 있는 것**: 모델 변경 의도, 시트 컬럼 매핑, 자동 row 생성 흐름, PDCA 단계
> - **관련 문서**: [[09-payment-tab.md]] (Phase 1 폐기), [[03-meeting-results.md]] (계약 액션 발신부)

# 11 — 계약수납탭 (모델 재정의 · PDCA Plan)

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | Phase 1 수납탭은 "일별 승인/수납 합계 4 필드"인데, 실제 사용자 워크플로우는 **계약별 수납 진척 추적**. 모델이 도메인과 어긋남. |
| **Solution** | 일정·계약 탭에서 미팅이 "계약" 상태로 전환되면 02 계약수납관리 시트에 row 자동 생성 → 사용자가 계약수납탭에서 6 체크박스 + 3 수납 슬롯(분할 수납)을 채움. |
| **Function/UX** | 자동 row 생성 + 6 체크박스(서류 진행) + 3 수납 슬롯(진행기관/현황/승인금액/수납액/수납일) |
| **Core Value** | 영업이익 계산의 "매출(수납) 절반"을 계약 단위로 정확히 추적 → DB관리(비용)와 짝 맞음 → 대시보드 영업이익 의미 있음 |

## Context Anchor

| Key | Value |
|---|---|
| **WHY** | 일별 합계 모델은 "계약 1건이 분할로 들어오는 실제 패턴"을 표현 못함 — 사용자 매일 사용 핵심 화면이 도메인과 어긋난 채로 동작 중 |
| **WHO** | 수강생 1인칭 (매일 입력 — 미팅 후 계약 처리 → 수납 진척 추적) |
| **RISK** | 데이터 모델 큰 변경 → 기존 영업관리!Q~T 폐기 → 시트 호환성 결정 필요. 일정·계약 탭과 자동 연동 → race/dedup 위험 |
| **SUCCESS** | 일정·계약 탭 💵 계약 → 02 계약수납관리에 자동 row 생성 + 계약수납탭 진입 시 자동 표시 + 분할 수납 3건까지 추적 가능 |
| **SCOPE** | UI(이름 변경+컴포넌트), 시트 02 계약수납관리 read/write, 일정·계약 fan-out, 자동 row 생성 transaction. 인증/대시보드 OUT |

## 사용자 답변 정리 (Checkpoint 1·2)

| Q | 답 | 의미 |
|---|---|---|
| Q1. 기존 영업관리!Q~T | **폐기** | 일별 합계 모델 종료 |
| Q2. row 생성 방식 | **자동** (계약 액션 시 즉시) | 일정·계약 탭과 fan-out |
| Q3. 분할 수납 | **3건까지** (1차/2차/3차) | 시트 컬럼 사전 할당 (M~Q, R~V, W~AA) |
| Q4. 시트 매핑 | **02 계약수납관리** (기존 02 계약관리 재명명/재구조화) | 영업관리 Q~T deprecate |
| Q5. 탭 이름 | **계약수납** (사용자 제안 채택) | URL: `/payment` 그대로 또는 `/contract-payment` |

## 시트 구조 (02 계약수납관리)

> 시트 row 1·2 헤더 마크다운 변환에서 일부 컬럼 위치가 모호 — Design 단계에서 사용자가 시트 컬럼별 정확 매핑을 확정해야 함. 아래는 사용자 명세 기반 추정.

### 1행 (그룹 헤더)
| 그룹 | 의미 |
|---|---|
| **계약당일 받아올 것** | 04 업체관리에서 자동 가져오는 정보 (수임비 등) |
| **계약 직후 프로세스** | 6 체크박스 — 서류 진행 |
| **실무진행** | "플러그 이관" 1 체크박스 (시트 보임 — 사용자 확정 필요) |
| **수납1 / 수납2 / 수납3** | 분할 수납 3 슬롯 |

### 2행 (필드 헤더) — 컬럼 매핑

| 컬럼 | 필드 | 타입 | 출처 |
|---|---|---|---|
| **A** | 수임비 | number | 04 업체관리!L 자동 |
| (B~E) | (업체명/계약일 등) | — | 사용자 확정 필요 |
| **F** | 공동인증서 | bool (체크) | 사용자 입력 |
| **G** | 임대차계약서 | bool | 사용자 입력 |
| **H** | 신분증 | bool | 사용자 입력 |
| **I** | 드라이브 업로드 | bool | 사용자 입력 |
| **J** | 사업계획서 초안발송 | bool | 사용자 입력 |
| **K** | 컨설팅 5종서류 발송 | bool | 사용자 입력 |
| **L** | (플러그 이관 — 시트에 보임) | bool? | 사용자 확정 필요 |
| **M** | 수납1 진행기관 | text | 사용자 입력 |
| **N** | 수납1 현황 | text | 사용자 입력 |
| **O** | 수납1 승인금액 | number | 사용자 입력 |
| **P** | 수납1 수납액 | number | 사용자 입력 |
| **Q** | 수납1 수납일 | date | 사용자 입력 |
| **R~V** | 수납2 (동일 5필드) | — | 사용자 입력 |
| **W~AA** | 수납3 (동일 5필드) | — | 사용자 입력 |

### 자동 연동 흐름

```
[일정·계약 탭] 미팅카드 💵 계약 액션
    ↓
[기존] 04 업체관리 row update: 상태=계약, 계약여부=true, 수임비=N, 계약조건=...
    ↓
[신규] 02 계약수납관리 row append: A(수임비)·B-E(업체명/계약일/...) 자동 채움
        F~K, L, M~AA는 비어있음 (사용자가 계약수납탭에서 채움)
    ↓
[계약수납탭] 진입 시 02 계약수납관리 read → 4 업체관리 join (id/업체명/수임비) → 표시
    ↓
[사용자] 체크박스 토글 / 수납 슬롯 입력 → patch 02 계약수납관리 해당 row
```

## Acceptance Criteria

### 시트 SSOT
- [ ] `docs/domains/sheet-structure.md`에 02 계약수납관리 섹션 신규 추가
- [ ] 폐기된 영업관리!Q~T 마킹 (deprecated 명시 + 후속 마이그레이션 메모)
- [ ] 컬럼 A~AA 매핑 확정 (현재 추정 → 사용자 확정 후 권위)

### 백엔드
- [ ] `lib/types`에 `ContractPayment` zod 스키마 (수임비/체크박스 6+1/수납 3슬롯)
- [ ] `lib/repo/contract-payment.ts` — read/append/patch (시트 02 계약수납관리)
- [ ] `lib/service/contract-payment.ts` — loadAll, addByMeeting(meetingId), patchByRow
- [ ] `app/api/contract-payment` 라우트 — GET (전체 read), POST (자동 추가 — 일정·계약에서 호출), PATCH /[row]
- [ ] `lib/query/...` hooks (stateless mutation)
- [ ] **일정·계약 탭 트랜잭션 확장**: 💵 계약 액션 시 patchMeeting + appendContractPayment 동시 호출

### 프론트
- [ ] `/payment` (또는 `/contract-payment`) 페이지 — 계약 row 리스트 + 펼침 입력
- [ ] 계약 row 표시: 업체명/수임비/체크박스 진척률(N/6)/수납 진척률(₩수납/₩승인)
- [ ] 펼침: 6 체크박스 토글 + 3 수납 슬롯 폼
- [ ] 자동 row 생성 후 즉시 반영 (invalidate 캐시)
- [ ] prototype 매칭 (Design 단계에서 prototype 받아오기)

### 비기능
- [ ] race condition: 계약 액션 시 두 mutation 순서 + 실패 복구 패턴 (이전 reschedule처럼)
- [ ] 시트 quota: 한 번 진입 시 read 1회 (전체 02 계약수납관리)
- [ ] 검증: 수납액 ≤ 승인금액, 수납일 = 계약일 이후

## PDCA 단계

### Plan (← 이번 PR)
✅ 이 문서. 모델 정의 + AC + 리스크 + 사용자 답변 정리.

### Design
**산출물**:
1. 사용자 시트 컬럼 매핑 최종 확정 (A~E, L 컬럼 정확)
2. SSOT `docs/domains/sheet-structure.md` 업데이트
3. prototype HTML `docs/design/prototypes/contract-payment.html` (사용자 별도 채팅에서 받기)
4. 3가지 architecture options 비교 (아래 참조)

### Do
**산출물**: `feat/contract-payment-tab` PR
- types / repo / service / API / hooks / UI 구현
- 일정·계약 탭에 fan-out 트랜잭션 추가
- 영업관리!Q~T 관련 코드 cleanup (이미 머지된 09 코드)

### Check
- gap analysis: prototype vs UI, AC 항목별 검증
- 수동 테스트: 계약 액션 → 02 계약수납관리 자동 row 확인

### Act
- 회고 + plan completed로 이동

## Architecture Options (Design 단계 결정 대상)

> Plan PR 머지 후 Design 단계에서 사용자가 선택. 미리 보기 차원에서 정리.

### Option A — 최소 변경 (URL 유지 + 기존 paths 재사용)
- `/payment` URL 유지, 페이지만 재작성
- 기존 `lib/service/payment.ts` 재활용 + `loadDailyRevenue` 폐기
- 일정·계약 탭의 `handleContract`에 fan-out 추가
- **장점**: 라우팅·import 영향 최소
- **단점**: "payment"라는 URL이 의미 잃음 (계약 단위가 핵심)

### Option B — 깔끔한 분리 (URL 변경 + 새 도메인)
- `/contract-payment` URL 신규
- `/payment`는 redirect (또는 폐기)
- `lib/service/contract-payment.ts` 신규 도메인
- TabBar 5탭 라벨 "수납" → "계약수납"
- **장점**: 도메인 명료, 검색·라우팅 직관적
- **단점**: TabBar 변경 + 기존 URL 호환성

### Option C — 실용적 균형 (URL 유지 + 도메인 분리) — 추천
- `/payment` URL 유지 (TabBar "수납" 라벨도 유지 — 짧음)
- 백엔드는 새 도메인 `lib/service/contract-payment.ts` (명확)
- 페이지 컴포넌트는 새로 작성, 기존 9-payment 코드는 archive
- **장점**: URL/TabBar 안정 + 도메인 명료 + cutover 단순
- **단점**: URL과 도메인명 약간 mismatch (수용 가능)

## Risks / 결정 필요

### R1. 컬럼 A~E 정확 매핑
시트 1행에 "계약당일 받아올 것" 그룹 아래 어떤 컬럼이 있는지 (업체명/계약일/연락처 등). 사용자 확인 필요.
- **대응**: Design 단계에서 시트 row 1·2 직접 캡처/명시 받기.

### R2. L컬럼 (플러그 이관)
시트 헤더에 "플러그 이관" 보이는데 사용자 [2]의 6 체크박스에는 없음. 7번째 체크박스인지, deprecate 대상인지.
- **대응**: 사용자 확정 — 본 plan에서 보수적으로 "포함" 가정 + 확정 시 변경.

### R3. fan-out 트랜잭션 race
계약 액션 = patchMeeting + appendContractPayment 두 mutation. 순서·실패 복구.
- **대응**: 이전 reschedule 패턴 재사용 (먼저 append 시도, 성공 시 patch).

### R4. 영업관리!Q~T 폐기 시 기존 데이터
이미 입력된 일별 합계가 있으면 손실.
- **대응**: 사용자에게 기존 데이터 유무 확인 → 있으면 마이그레이션 ADR 별도.

### R5. 모바일 UI 압축
1 row 펼침 = 6 체크박스 + 3×5 = 21 입력 필드. 화면 길이 부담.
- **대응**: 펼침 내 sub-section (서류/수납 1·2·3) 토글 또는 카드 분할. prototype에서 검증.

## 의존성 / 선행 조건

- ✅ 03-meeting-results Phase 1~3 (일정·계약 탭 계약 액션 동작)
- ✅ 04 업체관리 시트 read/write (`lib/repo/meetings.ts`)
- ⏳ 시트 02 계약수납관리 정확 컬럼 헤더 (사용자 확정)
- ⏳ prototype HTML (Design 단계에서 사용자 task)

## Log
- 2026-05-01 11-payment-redesign 초안 (Phase 2 단순 폴리싱)
- 2026-05-02 사용자 의도 확장: 계약 단위 모델 — 11 plan 통째 update + slug `contract-payment-tab`로 변경

---
slug: 10-db-management
status: active
created: 2026-04-30
worktree: ../wt/db-tab
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB관리 탭(`/db`) — 4채널 raw log 입력 (비용·영업기회)
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/db/`, `lib/repo/db.ts`, 03 DB관리 시트
> - **읽고 나면 알 수 있는 것**: 4채널 layout, 시트 수식 자동 집계 원칙, append/update/delete 패턴
> - **관련 문서**: [[docs/domains/sheet-structure.md]] §5

# 10 — DB관리 탭 (4채널 비용·영업기회 raw log)

## Executive Summary
03 DB관리 시트의 4섹션(매입DB / 직접생산 / 현수막 / 콜·지·기·소)에 raw 데이터를 입력하는 UI. 합계·평균단가는 시트 수식이 자동 계산하므로 앱은 raw 입력만 처리. 메인 목표는 채널별 **총비용**과 **평균단가** 모니터링.

## SSOT 패치 — 03 DB관리 = MVP 핵심 (이전 plan에서는 "MVP 미사용" 표기 → 정정)

| 섹션 | 컬럼 범위 | 필드 | 성격 |
|---|---|---|---|
| 매입DB | B:G | 구매일 / 업체명 / 개당단가 / 주문개수 / 주문금액(수식) / 기타 | 비용 |
| 직접생산 | I:N | 날짜 / 소재 / 기간예산 / 생산개수 / 개당단가(수식) / 기타 | 비용 |
| 현수막 | P:V | 날짜 / 업체명 / 도착일 / 개당단가 / 주문개수 / 주문금액(수식) / 기타 | 비용 |
| 콜·지·기·소 | X:AD | 구분 / 접수일 / 대표자명 / 업체명 / 소개처 / 연락처 / 조건 | 영업기회 (비용 X) |

H/O/W: spacer. A: 비움.

## 원칙
- **앱은 raw 입력만** — 시트 수식이 합계·평균단가 자동 계산
- **합계 행 보존** — 첫 셀이 "합계"인 행은 데이터로 인식 X, 절대 덮어쓰지 않음
- **수식 컬럼 보호** — 매입DB.주문금액(E), 직접생산.개당단가(M), 현수막.주문금액(U)는 빈 문자열로 보내 시트 수식 보존
- **`01 영업관리!J3:L6` 자동 집계** — 시트가 처리, 앱은 신경 X

## Acceptance Criteria

### 백엔드
- [x] `lib/types`에 DBPurchase / DBProduction / DBBanner / DBLead Zod 스키마 추가
- [x] `lib/config`에 SHEET_RANGES.dbManagement 섹션 정의 (4섹션 col 범위)
- [x] `lib/repo/db.ts` — read/append/update/clear (4섹션)
- [x] 합계 행 식별 ("합계" prefix) → skip
- [x] 수식 컬럼 보호 (빈 문자열로 send)
- [x] `lib/service/db.ts` — loadDBOverview + 4채널 add/patch/remove
- [x] `GET /api/db` (overview), `POST /api/db/[channel]`, `PATCH/DELETE /api/db/[channel]/[row]`

### 프론트
- [x] `useDBOverview` / `useAppendDB` / `usePatchDB` / `useRemoveDB` 훅 (stateless mutation 패턴)
- [x] `DBSection.tsx` generic 컴포넌트 (FieldDef 기반)
- [x] `/db` 페이지: 4채널 토글 + 채널별 입력 폼 + 행 리스트
- [x] 채널별 총비용·평균단가 요약 (콜·지·기·소는 영업기회 카운트만)
- [x] 행 inline 수정/삭제

## Phase 2 (별도 PR)
- 폴리싱 (디자인 토큰 사용, 채널별 색상)
- 콜·지·기·소 별도 워크플로우 (영업기회 → 컨택관리 미팅 등록 흐름)

## Log
- 2026-04-30 SSOT 패치 + 4채널 raw log 구현

---
slug: sheet-realign-actual-structure
status: active
created: 2026-04-27
worktree: ../wt/sheet-realign
pr: refactor/sheet-realign-actual-structure
---

# PR 1.5 — SHEET_RANGES를 실제 시트 구조에 정렬

## Intent (왜)
PR 1 머지 후 Drive MCP로 실제 사용자 시트(`1nx1Eufk...`) 본문을 읽어 구조 검증한 결과, SSOT 핸드오프 문서들이 **실제 시트와 다른 5탭 모델**을 가정하고 있었음을 확인.

실제 시트:
- 대시보드(자동작성), 01 영업관리, 02 계약관리, 03 DB관리, 04 업체관리(앱자동작성용),
  영업관리(예시), DB관리(예시) — `수납관리` / `회고노트` 탭은 **존재하지 않음**

핵심 발견:
- **수납 정보는 영업관리 매주 블록에 이미 통합되어 있음** (실적관리/승인건수/수납건수/수납금액/비고)
  → 별도 `수납관리` 탭 신설은 이중 추적이 됨. SSOT가 잘못 분리한 것.
- **회고노트 탭은 시트에 없음** — MVP 제외 확정
- **02 계약관리·03 DB관리는 별개 영역** (계약 사후 서류 체크리스트 / 채널별 DB raw log) — 유지

이 PR은 lib/ 코드를 실제 시트 구조에 정렬한다. 다음 PR(컨택탭)이 정확한 좌표로 시작 가능하도록.

## Acceptance Criteria
- [ ] `lib/config/SHEET_RANGES`: 5키 → 3키 (`dashboard`, `sales`, `meetings`)
- [ ] 실제 탭 이름 박기:
  - `dashboard.tab`: `대시보드(자동작성)`
  - `sales.tab`: `01 영업관리`
  - `meetings.tab`: `04 업체관리(앱자동작성용)`
- [ ] `lib/types/PaymentRow` 제거 (영업관리 통합으로 불필요)
- [ ] `lib/service/index.ts` 주석에서 `payments.ts` 언급 제거
- [ ] `npm run check` 통과
- [ ] Plan 05를 active → completed 이동

## Out of Scope (다음 PR에서)
- `lib/repo/sales.ts`, `lib/repo/meetings.ts` 실제 구현 (PR 2)
- 영업관리 행 좌표 lookup 함수 (PR 2 안에서)
- `data-model.md` / `sheet-structure.md` repo 문서 동기화 — claude.ai 회신 후 별도 docs PR
- PR 2: 컨택관리 탭 UI

## Steps
1. `lib/types/index.ts`: `PaymentRow` 제거
2. `lib/config/index.ts`: SHEET_RANGES 정리 (3키, 실제 탭 이름)
3. `lib/service/index.ts`: 주석 정리
4. `npm run check` 통과 확인
5. 커밋 + 푸시

## Log
- 2026-04-27: PR 1 머지 후 Drive MCP로 실제 시트 구조 검증 → SSOT 5탭 모델이 실제와 불일치 발견
- 2026-04-27: 워크트리 생성 + plan 작성

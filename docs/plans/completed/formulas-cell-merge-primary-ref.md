---
slug: formulas-cell-merge-primary-ref
status: active
created: 2026-05-16
worktree: ../wt/formulas-merge-fix
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업관리 수식의 `$C{r}` 참조를 `$C{dayPrimaryRow(r)}` 로 변경 — 6기 cell 병합 시트의 빈 결과 사고 fix
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/setup-formulas.ts:formulasForRow`
> - **읽고 나면 알 수 있는 것**: 왜 이장현 시트의 수식이 결과를 안 내놨는가? PR #200 fix 와 어떻게 다른가?
> - **관련 문서**: PR #200 (computeDataRows deterministic)

# formulas-cell-merge-primary-ref — 이장현·김선주 사고 fix

## Executive Summary
**2026-05-16 사용자 보고**:
- **이장현**: 업체관리에 미팅 있고 영업관리 셀에 수식 있는데 결과가 안 나옴
- **김선주**: 컨택탭에서 저장해도 시트에 반영 안 보임 (실제로는 E~H 에 저장됐지만 표시 수식 I/J/O 가 비어 보임)

두 케이스 모두 **같은 root cause**: 영업관리 수식이 자기 row 의 `$C{r}` (날짜) 참조 → 6기 cell 병합 시트의 non-primary cell 참조는 sheets 가 **empty 반환** → FILTER/COUNTIFS 매칭 실패 → 빈 결과.

## Root Cause Detail
6기 이월 시트의 영업관리 C 컬럼이 **cell 병합** (1일치 4채널 row 가 visually 같은 날짜로 표시).
- `매입DB row` (블록 첫 row, e.g. C10) = primary cell, 값 있음
- `직접생산/현수막/콜·지·기·소 row` (C11/C12/C13) = non-primary, sheets API 가 empty 반환

기존 수식: `=FILTER(..., !B:B = $C{r}, !F:F = $D{r})`
- r=10 (매입DB): `$C10` = 날짜 값 → 매칭 OK
- r=11 (직접생산): `$C11` = empty (merge non-primary) → 매칭 실패 → 빈 결과
- r=12, 13: 같음

**PR #200 (deterministic dataRows)** 는 "수식이 어느 row 에 설치되는가" 를 fix. 이번 PR 은 "수식 안의 좌표 참조" 를 fix.

## Fix

### `lib/repo/setup-formulas.ts`

#### 신규 `dayPrimaryRow(r): number`
4채널 일별 블록의 매입DB row (primary date cell) 계산:
```typescript
export function dayPrimaryRow(r: number): number {
  const blockIdx = Math.floor((r - SALES_BLOCK_START) / SALES_BLOCK_STRIDE);
  const posInBlock = (r - SALES_BLOCK_START) % SALES_BLOCK_STRIDE;
  const dayIdx = Math.floor(posInBlock / 4);
  return SALES_BLOCK_START + blockIdx * SALES_BLOCK_STRIDE + dayIdx * 4;
}
```

검증:
- r=10 (매입DB) → 10 (자기 자신)
- r=11/12/13 (직접생산/현수막/콜·지·기·소) → 10 (같은 일자의 매입DB)
- r=14 (1주 2일 매입DB) → 14
- r=44 (2주 1일 매입DB) → 44 (blockStride 34 건너뜀)
- r=275 (8주 7일 콜·지·기·소) → 272

#### `formulasForRow(r)` — `$C{r}` → `$C{dayPrimaryRow(r)}`
8 개 수식 모두 (I/J/K/L/M/N/O/P) 의 `$C` 좌표를 dayPrimaryRow 로 변경.
`$D{r}` 은 r 그대로 — 채널 라벨은 row 별 고유.

cell 병합 안 된 시트도 동일 동작 (4 row 의 C 가 모두 같은 날짜 = 같은 매칭 결과). **regression 없음**.

### `tests/repo/setup-formulas-guard.test.ts`
신규 describe `dayPrimaryRow` — 11 unit tests:
- 매입DB row 자기 자신, 다른 3채널 → 매입DB row 매칭
- 1주 2일 / 7일 / 2주 1일 / 8주 7일 경계 케이스
- blockStride 34 건너뜀 검증

## Acceptance Criteria
- [ ] PR 머지 후 /admin/users → **[🛠️ 수식 복원]** 클릭 → 새 수식이 모든 trainee 시트에 install
- [ ] 이장현 시트 영업관리 I/J/O 가 업체관리 미팅 데이터를 정상 표시 (cell 병합 그대로 둬도 OK)
- [ ] 김선주 시트 컨택탭 5/11 저장 → 영업관리 표시 수식이 결과 표시
- [ ] check.sh 전체 통과 (computeDataRows 8 + isSafeToOverwrite 13 + dayPrimaryRow 11 = 32 tests in setup-formulas-guard)

## Quota 영향
없음. 수식 문자열 길이만 약간 변화. installFormulas 의 batchUpdate 1 call 단위 quota 변동 없음.

## Log
- 2026-05-16 cell 병합 non-primary 참조 fix — dayPrimaryRow primary cell 참조로 통일

---
slug: setup-formulas-deterministic
status: active
created: 2026-05-16
worktree: ../wt/formulas-determ
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: installFormulas 의 dataRows 식별을 sheet C 컬럼 read → 박힌 공식(computeDataRows)으로 전환 — 6기 cell 병합으로 매입DB row 만 처리되던 사고 fix
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/setup-formulas.ts` (installFormulas + uninstallFormulas)
> - **읽고 나면 알 수 있는 것**: 6기 이월 시트의 C 컬럼 셀 병합이 왜 4채널 중 1채널만 수식 설치되게 만들었나? deterministic 으로 바꿔서 어떻게 해결되나?
> - **관련 문서**: PR #192 (`salesRowFor` 도입)

# setup-formulas-deterministic — 6기 셀병합 사고 fix

## Executive Summary
**2026-05-16 시연 사고**: 김선주·이장현 미팅카드 만들었는데 영업관리 I 열이 매입DB row 만 수식이 잡혀 다른 3채널 row 누락. 진단 결과 6기 이월 시트의 영업관리 C 컬럼이 **cell 병합** (C10:C13 = 1일치 4채널 row 가 같은 날짜로 visually 표시) 상태.

**Root cause**: `setup-formulas.ts:readDataRows` 가 sheets API 로 C 컬럼을 읽어 `number(date serial)` 인 row 만 데이터 행으로 인식. 그런데 sheets API 의 `values.get` 은 cell 병합의 non-primary cell 을 **empty 로 반환** → 매입DB row (각 day 의 첫 row, primary cell) 만 데이터 행으로 식별 → installFormulas 가 매입DB row I~P 만 처리 → 직접생산/현수막/콜·지·기·소 row 누락.

**Fix**: PR #192 `salesRowFor` 와 동일한 결정론적 공식 적용. C 컬럼 read 제거.

## 변경 사항

### `lib/repo/setup-formulas.ts`

#### `readDataRows` (async, sheets API 호출) → `computeDataRows` (sync, 박힌 공식)
```typescript
export function computeDataRows(): number[] {
  const rows: number[] = [];
  for (let week = 0; week < 8; week++) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      for (let channelIdx = 0; channelIdx < 4; channelIdx++) {
        rows.push(
          SALES_BLOCK_START + week * SALES_BLOCK_STRIDE + dayIdx * 4 + channelIdx,
        );
      }
    }
  }
  return rows;
}
```

공식: `row = blockStart(10) + week*blockStride(34) + dayIdx*4 + channelIdx`. 총 8주 × 7일 × 4채널 = **224 rows** (이전 sheet read 방식 시 6기 이월 시트는 ~56 rows = 매입DB row 만).

- `installFormulas` / `uninstallFormulas` 두 곳 모두 `await readDataRows(spreadsheetId)` → `computeDataRows()` 로 교체
- C 컬럼 sheets API read 제거 — quota 1 call 절약 (작지만)
- 합계/헤더 row (블록 내 offset 28~33) 는 공식상 범위 밖이라 자연 제외 (week 마다 offset 0~27 만 사용)
- raw 값 cell 은 여전히 `isSafeToOverwrite` 가 skip — 사용자 작성값 보존 가드(PR #186) 유지

### `tests/repo/setup-formulas-guard.test.ts`
신규 describe `computeDataRows` — 8 단위 테스트:
- 총 row 수 224 검증
- 1주 1일 4채널 row 연속 (10, 11, 12, 13) — **6기 cell 병합 사고 재발 방지 핵심**
- stride 4 (1주 2일 첫 매입DB = 14)
- 2주 시작 row = 44 (blockStride 34)
- 마지막 row = 275 (8주 7일 콜·지·기·소)
- 중복 없음 + 오름차순
- 합계/헤더 row 미포함 (블록 내 offset ≤ 27)

## Acceptance Criteria
- [ ] /admin/users → [🛠️ 수식 복원] 클릭 시 6기 이월 trainee 시트도 4채널 모두 수식 설치
- [ ] 김선주·이장현 시트에서 미팅카드 생성 → I/J/O 열 4채널 모두 동작
- [ ] `isSafeToOverwrite` 가드 그대로 — 사용자 raw 입력 보존 (5/14 사고 fix 영구)
- [ ] check.sh 전체 통과 (computeDataRows 테스트 8개 + 기존 13개 = 21개)

## Quota 영향
- 이전: `readDataRows` 가 C 컬럼 read 1회 (per installFormulas 호출)
- 신규: sheet read 0회 (계산만)
- 60명 일괄 installFormulas 시: 60 reads 절약 (작지만 의미 있음)

## 후속 (별도 PR — 필요 시)
- **셀병합 자동 unmerge**: installFormulas 가 영업관리 C/D 컬럼 cell merge 감지 시 자동 unmerge. 단 사용자의 visual layout 변경이라 confirm 필요. 일단 deterministic install 만으로 수식 동작하는지 확인 후 결정.
- **opt-in 강제 수식복원**: `isSafeToOverwrite` 우회. 6기 옛 raw 데이터로 skip 되는 cell 도 override. admin only, confirm 2번.

## Log
- 2026-05-16 cell 병합 사고 진단 후 deterministic 패턴 적용 (PR #192 와 동일 방식)

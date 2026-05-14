> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #186 (수식복원 user-data 가드) 의 정책을 CLAUDE.md 규칙 5번으로 영구화 + `uninstallFormulas` 에도 동일 가드 확장.
> - **누가 읽나요**: 모든 개발자/에이전트 (재발 차단 정책)
> - **어떤 기능·작업과 연결?**: `CLAUDE.md`, `lib/repo/setup-formulas.ts`
> - **읽고 나면 알 수 있는 것**: bulk-write 작업 시 어떤 가드가 의무인가?
> - **관련 문서**: `docs/plans/active/formulas-preserve-user-data.md`

# Harness: bulk-write 사용자 데이터 보존 규칙

## 배경 (사용자 약속, 2026-05-14)

PR #186 머지 직후 사용자: "다음에 수식복원했을때는 기존에 뭐라고 작성했던간에 작성된 값은 반드시 살려줘"

PR #186 이 `installFormulas` 만 가드. **같은 패턴 사고가 다른 bulk-write 함수에서 또 발생할 위험** — Hashimoto §0 원칙: "같은 실수를 두 번 안 하게 환경을 고쳐라". 이번 PR 은 해당 약속을 시스템 차원에서 박제.

## 변경

### `CLAUDE.md` §2 핵심 규칙 5번 추가

> **사용자 작성값 절대 보존 (Bulk-write 안전 가드, 2026-05-14 사고 후)** — 시트 셀에 일괄 쓰기(`spreadsheets.values.batchUpdate`, `batchClear` 등) 하는 모든 함수는 타겟 셀을 `valueRenderOption: "FORMULA"` 로 **pre-read** 한 뒤, raw 값(텍스트·숫자·boolean)이 있으면 그 셀은 **skip** 해야 한다. 빈 셀과 수식(`=...`)만 덮어쓰기 허용. 참고: `lib/repo/setup-formulas.ts:isSafeToOverwrite` + `tests/repo/setup-formulas-guard.test.ts`. 새 bulk-write 함수 추가 시 같은 가드 의무 — 안 그러면 사용자 데이터 손실 사고 재발.

### `lib/repo/setup-formulas.ts:uninstallFormulas`

같은 가드 적용:
- batchClear 직전 FORMULA mode pre-read.
- raw 값 셀은 clear 대상에서 제외 → preservedCells 누적.
- 반환 타입에 `preserved`, `preservedCells` 추가.

`uninstallFormulas` 는 현재 UI 버튼 없음 (`/api/setup` DELETE 만 사용). UX 가 위험 안에 노출 안 됐지만 install 과 짝패라 같은 가드 의무.

## 미적용 (의도)

다른 bulk-write 함수들 — 현재 user data 손실 위험 없는 작업들:

| 함수 | 가드 필요? | 이유 |
|------|----------|------|
| `updateCell` (registry M, B 등) | X | 사용자 데이터 cell 이 아님 (admin 메타) |
| `appendRows` (registry) | X | 빈 행 append, 기존 row 안 건드림 |
| `setTraineeAssignments` (registry G) | X | admin SSOT 컬럼, user 입력 X |
| `setUserSortOrders` (registry M) | X | admin SSOT 컬럼 |
| `installFormulas` | ✅ PR #186 | 사고 발생 endpoint |
| **`uninstallFormulas`** | ✅ **이 PR** | install 과 짝패, 같은 위험 |

새 bulk-write 함수 추가 시 CLAUDE.md §2.5 규칙대로 판단 후 필요시 가드 적용.

## 검증

- [x] `bash scripts/check.sh` 통과 (42 unit test green)
- [x] uninstallFormulas 반환 타입 변경 — consumer `/api/setup/route.ts` 는 `...report` spread 라 backward compatible

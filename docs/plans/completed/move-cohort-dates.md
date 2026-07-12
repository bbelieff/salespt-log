---
status: completed
slug: move-cohort-dates
created: 2026-05-09
worktree: ../wt/move-dates
completed: 2026-05-11
archived: 2026-07-12
---

# fix(sheet): 수강시작일/종강총회 셀 N1/N2 → O1/O2

## 문제

사용자 시트 (2026-05-09): N1/N2에 "시작일"/"종강총회" 라벨 텍스트, 실제 날짜는 O1/O2.
현재 코드는 N1/N2 read → "N1 파싱 실패: 시작일" / "N2 파싱 실패: 종강총회" → /api/me 500.

## 변경

- `lib/config/index.ts`: `startDateCell: "N1" → "O1"` + `graduationDateCell: "O2"` 추가
- `lib/repo/sales.ts`: readGraduation 하드코딩 N2 → `SHEET_RANGES.sales.graduationDateCell`, 에러/주석 갱신
- `lib/service/me.ts`: 주석 N1/N2 → O1/O2
- `docs/domains/sheet-structure.md` §2 상단 표 갱신
- `docs/domains/data-model.md` 상단 셀 표 갱신

## Acceptance

- [x] typecheck PASS
- [x] lint PASS (warning만, error 없음)
- [x] test:structural PASS (6 tests)
- [x] tests PASS (28 tests)
- [x] doc-drift PASS

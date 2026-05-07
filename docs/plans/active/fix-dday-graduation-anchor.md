---
slug: fix-dday-graduation-anchor
status: active
created: 2026-05-08
worktree: ../wt/dday-fix
---

# fix: D-day 코드 정합 (49→57, weekTargetISO→graduationISO)

## Intent

`docs/header-ssot` PR에서 D-day SSOT를 `+50d/weekTargetISO` → `+57d/graduationISO`로 정정했지만,
`lib/service/me.ts` 와 `components/DDayBadge.tsx` 는 여전히 옛 명칭/값 사용 중.
이번 PR로 코드 정합 완료.

## Acceptance Criteria

- [x] `lib/service/me.ts` — `WEEK_TARGET_OFFSET_DAYS = 49` → `GRADUATION_OFFSET_DAYS = 57`
- [x] `MeProfile.weekTargetISO` → `graduationISO` (필드명 + JSDoc)
- [x] `computeGraduationISO()` 헬퍼 export (테스트 입력점)
- [x] `components/DDayBadge.tsx` — prop `weekTargetISO` → `graduationISO`
- [x] `components/TopHeader.tsx` — 호출부 동기화
- [x] 6기 fixture 단위 테스트 (`tests/service/me.test.ts`):
  - N1=2026-04-10 → graduation=2026-06-06 ✓
  - 월말 경계, 연말 경계, 윤년 케이스
- [x] `npm run check` 전체 PASS (6 structural + 22 unit/integration)

## Scope

**3개 코드 파일 + 1개 테스트 파일**:
- `lib/service/me.ts` (rename + 값 변경 + 헬퍼 export)
- `components/DDayBadge.tsx` (prop rename, 주석 갱신)
- `components/TopHeader.tsx` (호출부 1줄)
- `tests/service/me.test.ts` (신규 — 5개 케이스)

## 검증 (commit 전)

```
▶ structural tests : 6 passed
▶ unit tests       : 22 passed (me.test 5개 신규)
▶ doc-drift        : PASS
▶ check.sh         : PASSED
```

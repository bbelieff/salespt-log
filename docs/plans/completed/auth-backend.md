---
status: completed
slug: auth-backend
created: 2026-05-11
worktree: ../wt/auth-backend
completed: 2026-05-11
archived: 2026-07-12
---

# feat(auth): Self-claim 백엔드 (PR-B1)

## 배경

`docs/plans/active/login-prototype.md` 결정 반영:
- Drive API 파일명 검색으로 시트 매칭
- registry 자동 갱신 + 시트 B3/C3 자동 작성

## 추가

- `lib/repo/drive-client.ts` — Drive API 클라이언트 + `findSheetByExactName`
- `lib/repo/users.ts`
  - `findSheetByCohortName(cohort, name)` — 패턴 `세일즈PT_ N기 이름 수강생 경영일지`
  - `claimRegistry(email, cohort, name, spreadsheetId)` — 매칭 row email 갱신 또는 신규 append
- `lib/repo/sales.ts` — `writeProfile(spreadsheetId, cohort, name)` (B3/C3)
- `lib/service/auth.ts` — `claimAccount(email, cohort, name)` 트랜잭션 + `ClaimError`

## Idempotent

이미 등록된 email 재로그인 시 → 기존 데이터 반환만, 작업 X (중복 시트 매칭 방지).

## 다음 (PR-B2)

- `app/api/me/route.ts` — needs_claim 응답
- `app/api/claim/route.ts` — POST { cohort, name }
- NextAuth 설정 (Google provider + 1년 maxAge)

## Acceptance

- [x] typecheck PASS
- [x] lint PASS (warning만, error 없음)
- [x] structural PASS (6 tests)
- [x] doc-drift PASS

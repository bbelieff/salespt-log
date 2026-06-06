---
slug: claim-name-match-relax
status: active
created: 2026-06-06
owner: belie
related: admin-cohort-create(completed), cohort-folder-naming-fix(completed)
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: self-claim 시 수강생 시트 이름 매칭을 완화 — "수강생" 단어 없이도 `[세일즈PT · {N}기 · 이름 · 경영일지]` 토큰이 모두 포함되면 매칭.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/users.ts(findSheetByCohortName)`, `lib/repo/drive-client.ts`, `lib/service/auth.ts(claimAccount)`
> - **읽고 나면 알 수 있는 것**: 왜 완화하는지, 숫자경계/모호 가드, 공유 드라이브 검색
> - **관련 문서**: `docs/plans/completed/admin-cohort-create.md`

# self-claim 시트 이름 매칭 완화 (수강생 토큰 무관)

## 배경
`findSheetByCohortName` 이 `세일즈PT_ {N}기 {이름} 수강생 경영일지` 정확/prefix 매칭만 →
"수강생"이 빠진 8기 제목(`세일즈PT_ 8기 김승엽 경영일지`)은 self-claim 실패 → not_found.

## 변경
1. **drive-client**: 신규 `findSheetByNameContainsAll(tokens)` — `name contains` AND 쿼리 +
   JS 재검증. 판정부는 순수 모듈 `sheet-title-match.ts`(`sheetTitleMatchesTokens` /
   `pickSheetFromCandidates`)로 분리. 기수 토큰은 숫자경계 정규식 `(^|[^0-9])N기` 로
   "8기"≠"18기". 0개 null / 1개 id / 2개+ 모호 null(추측 금지, "수강생" 포함형 1개면 우선).
   공유 드라이브 supportsAllDrives + includeItemsFromAllDrives.
   기존 `findSheetByNamePrefix` 는 contains-all 로 대체되어 제거.
2. **users.ts** `findSheetByCohortName`: (1) 기존 exact 시도(7기 호환), (2) 실패 시
   `findSheetByNameContainsAll(["세일즈PT", "{N}기", 이름, "경영일지"])` 폴백. cohort=T 는 null.

## 수용 기준
- `세일즈PT_ 8기 김승엽 경영일지` → cohort=8/name=김승엽 self-claim 성공 + writeProfile C3 작성.
- `세일즈PT_ 7기 김영준 수강생 경영일지` 계속 매칭.
- "8기"가 "18기" 시트에 오매칭 안 됨. 2개+면 모호(not_found) — 오등록 방지.
- 공유 드라이브 시트 검색됨.
- `npm run check` + 단위테스트(토큰/숫자경계/모호) 통과.

---
slug: claim-practice-cohort
status: active
created: 2026-07-13
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: /claim 이 "연습"(온보딩) 기수를 거부하던 hotfix — 게이트 허용 + 모바일 입력 개방
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: app/claim · lib/service/cohort-token · lib/service/auth
> - **읽고 나면 알 수 있는 것**: 왜 연습 계정이 막혔나 / 어디를 고쳤나 / 서버 경로는 왜 무변경인가
> - **관련 문서**: docs/decisions/0011(토큰 규칙), admin-cohort-create

# claim-practice-cohort

## 증상 (2026-07-13)
/claim 수강생 모드에서 기수 "연습" 입력 시 시작 버튼 비활성 + 서버 400. 연습용2(온보딩 계정) 진입 불가.

## 원인
클레임 게이트가 숫자·T·아레나만 허용:
- `app/claim/page.tsx` valid = `/^(\d+|[Tt])$/` (인라인)
- `lib/service/cohort-token.ts isClaimableCohort` = 동일 규칙
- 두 곳에 **같은 정규식이 복제**돼 있어(드리프트) 양쪽 다 "연습" 불허.
- 기수 input `inputMode="numeric"` → 모바일에서 한글/문자("연습"·"T") 입력 차단(선재 버그).

## Fix
1. `isClaimableCohort`: `norm==="연습"` 허용("연습기" 정규화 포함).
2. `page.tsx` valid: 인라인 정규식 제거 → **`isClaimableCohort` 공유**(서버 게이트와 SSOT, 드리프트 근절).
3. 기수 input `inputMode="numeric"→"text"` + `pattern` 제거(검증은 valid+서버). T·연습 모바일 입력 개방.
4. 단위테스트: 연습/연습기 허용 + 숫자·T·아레나 회귀 + 오타 거부.

## 서버(auth.claimAccount) 무변경 근거
`claimAccount` 는 `parseCohortToken` 미사용. "연습" 경로 = ①`findExistingSheetIdByCohortName("연습", 이름)` prep 매칭 **우선**(registry prep row: 연습·연습용2) → ②Drive fallback `findSheetByCohortName` 은 `연습기` 토큰 검색(무해). cohortLabel = `arenaCohortLabelParts`null → "연습". 게이트만 열면 기존 로직이 안전 처리. (연습 prep-only 제한은 불요 — YAGNI.)

## Acceptance
- [ ] "연습"/"연습기" 클레임 게이트 통과 (page+서버)
- [ ] 숫자·T·아레나 회귀 없음
- [ ] check.sh 통과
- [ ] 실검증: 연습/연습용2 클레임 왕복

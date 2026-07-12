---
status: completed
slug: arena-numeric-duplicate-claim-guard
created: 2026-06-16
owner: belie
related: arena-season1-setup, arena-enrich-registry-authoritative
completed: 2026-06-16
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 아레나 시트에 숫자 기수 중복 행이 생기던 문제를 정리하고 클레임 가드로 재발 차단.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: lib/service/auth.ts(claimAccount), lib/repo/users-claim.ts, 레지스트리
> - **읽고 나면 알 수 있는 것**: 원인, 가드 규칙, 데이터 정정
> - **관련 문서**: arena-enrich-registry-authoritative.md

# 아레나 숫자 기수 중복 행 정리 + 클레임 가드

## 원인
아레나 참가자가 '수강생(숫자 기수)' 모드로도 클레임 → findSheetByCohortName 이 아레나
시트를 이름 매칭 → 같은 아레나 sheetId 를 가리키는 숫자 기수 행 중복 생성.

## B) 재발 방지 가드 (본질)
- 규칙: **하나의 sheetId = 한 사람당 한 행, 아레나(A\d+-) 시트엔 숫자 기수 행 금지.**
- `findArenaRowBySheetId(sheetId)`(repo/users-claim, fresh read): 그 시트가 이미 아레나 행이면 {cohort,name}.
- `resolveArenaSheetClaim(claim, arenaRow)`(service/auth, 순수): 숫자 기수 클레임인데 아레나 행 있으면
  그 아레나 (cohort,name)으로 흡수(redirected). claimAccount 가 claimRegistry 직전 적용 →
  숫자 행 안 만듦, redirected 면 시트 B3/C3 안 건드림. 동일 이메일은 상단 early-return 으로 멱등.
- 단위테스트(auth-arena-guard): 숫자→아레나 흡수, 기 붙은 숫자, 아레나 직접, 일반 숫자 패스.

## A) 데이터 정정 (1회 스크립트, SA, §2.5, 드라이런→belie 확인→apply)
- (3,정유영,zzzddz01)·(1,이재영,onjuncenter) 숫자 행 삭제(아레나 행이 이미 이메일 보유).
- 김효준: A1-5 prep(빈 이메일) 행에 goubletgt 채우고 (5,김효준,goubletgt) 삭제.
- 항상 백업, 멱등, sheetId 재확인 후 정확히 그 행만.

## 검증
- 정정 후: 숫자(1·3·5)+아레나 sheetId 조합 행 0, 세 명 각각 아레나 행 1개. typecheck/lint/test green.

## 상태
- 2026-06-16 진행(fix/arena-numeric-duplicate-claim-guard).

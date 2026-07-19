# 2026-07-15 · PR-2 sweep — "use client" 위 import 삽입으로 배포 빌드 실패

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 금액 포맷터 통합 배치 스크립트가 `"use client"` 위에 import 를 삽입 → 프로덕션 빌드만 실패(check.sh 통과). fix-forward 3PR 로 복구.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: money-phone-format PR-2(#575), CI 게이트(check.sh)
> - **읽고 나면 알 수 있는 것**: 무엇이 터졌나 / 왜 check.sh 가 못 잡았나 / 하네스 갭
> - **관련 문서**: docs/plans/active/money-phone-format.md

## 무엇이 터졌나
PR-2 sweep(#575)에서 로컬 `fmtMoney` 중복 10벌을 공용 `formatMoney` 로 통합하며 **Node 배치
스크립트**로 import 를 추가했다. 그 스크립트는 "마지막 import 줄 뒤에 삽입" 로직이었는데,
**top-level import 가 없는 파일**(dashboard 3파일: JSDoc → `"use client"` 구조)에서는
`lastImport === -1` → **0번째 줄(= `"use client"` 위)** 에 삽입됐다.

결과: `The "use client" directive must be placed before other expressions` → **#575 배포 빌드 실패**.
무중단 설계로 사이트는 200 유지(옛 릴리스 서빙).

## 왜 게이트(check.sh)가 못 잡았나 — **핵심 갭**
`check.sh` 는 `typecheck(tsc --noEmit)` + `lint(next lint)` + 테스트를 돌리지만 **`next build`(프로덕션
webpack 빌드)를 돌리지 않는다**. `"use client"` 지시문 위치는 tsc/eslint 가 아니라 **빌드 타임 webpack
loader** 가 검사한다 → check.sh·CI 초록인데 배포 빌드에서만 실패. (동종: 클라 번들 전용 오류 전반)

## 복구 (fix-forward 3건 — 롤백 대신)
- #576(타 트랙): 사용 중 dashboard 2파일 정렬 복구 → 배포 재개.
- #580(DevE): 남은 미사용 placeholder `FinanceSummaryBoxes.tsx` 정렬(잠재 지뢰 제거).
- (#578 은 중복·충돌로 close — #576 이 선행)

## 하네스 갭 (Hashimoto — 재발 방지 후보)
1. **check.sh 에 `next build` 스모크 부재** → use-client 순서·클라 번들 오류를 배포 전에 못 잡음.
   후보: CI(typecheck.yml)에 `next build` 단계 추가(느림 — 캐시/조건부 고려) 또는 최소 use-client
   위치 정적 검사(ESLint `react/no-danger`류 커스텀 규칙 / 구조 테스트).
2. **에이전트 교훈**: 여러 파일에 import 를 프로그램으로 삽입할 때 `"use client"`·shebang·top-comment
   선행 파일을 반드시 고려. 단순 "마지막 import 뒤" 로직은 import 0개 파일에서 0번째 줄로 떨어진다.
   → 배치 편집 후 **`next build` 로 실측**(이번에 이 단계가 근인을 즉시 특정·검증했다).

## 상태
master 3파일 전부 `"use client"` 선행 확인. 배포 success·health 200. 기능(sweep) 정상 라이브.

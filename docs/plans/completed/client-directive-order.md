---
slug: client-directive-order
status: completed
created: 2026-07-16
completed: 2026-07-17
worktree: ../wt/codex-client-directive-order
---

# 클라이언트 지시문 순서 복구

## Intent (왜)

PR #575의 운영 배포가 두 대시보드 컴포넌트에서 `"use client"`가 import·주석 뒤에 위치해 실패했다. 지시문을 파일 최상단으로 이동해 정상 빌드와 운영 배포를 복구한다.

## Acceptance Criteria (수용 기준)

- [x] 두 대시보드 컴포넌트의 `"use client"`가 모든 import와 표현식보다 앞에 있다.
- [x] `scripts/check.sh` 통과 (typecheck · lint · structural · tests · 파일크기).
- [x] Linux production `next build` 통과.
- [x] 배포 conclusion=success 및 공개 health HTTP 200 확인.

## Context (참고)

- 실패 배포: GitHub Actions run #29355449310.
- 컴파일 오류: `DashboardProgressBanner.tsx`, `OperatingProfitCard.tsx`.
- 수정 PR: #576, squash merge `c1dd7de`.
- 성공 배포: GitHub Actions run #29549181566 (4분 21초).

## Result (결과)

1. 두 파일의 클라이언트 지시문을 최상단으로 이동했다.
2. 전체 사전검사와 630개 테스트를 통과했다.
3. VPS production build, 원자 교체, 로컬 `/api/health`, 공개 health가 모두 통과했다.
4. VPS HEAD가 병합 SHA `c1dd7de`와 일치하며 PM2 `salespt-log`는 online이다.

## Log

- 2026-07-16 실패 배포의 webpack 오류를 재현 가능한 코드 위치로 확인.
- 2026-07-17 PR #576 검사 통과 후 squash merge.
- 2026-07-17 배포 run #29549181566 성공, 공개 루트 5회 연속 HTTP 200 확인.

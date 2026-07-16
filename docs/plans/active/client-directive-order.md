---
slug: client-directive-order
status: active
created: 2026-07-16
worktree: ../wt/codex-client-directive-order
---

# 클라이언트 지시문 순서 복구

## Intent (왜)

PR #575의 운영 배포가 두 대시보드 컴포넌트에서 `"use client"`가 import·주석 뒤에 위치해 실패했다. 지시문을 파일 최상단으로 이동해 정상 빌드와 운영 배포를 복구한다.

## Acceptance Criteria (수용 기준)

- [ ] 두 대시보드 컴포넌트의 `"use client"`가 모든 import와 표현식보다 앞에 있다.
- [ ] `npm run check` 통과 (typecheck · lint · structural · tests · 파일크기).
- [ ] `npx next build` 통과.
- [ ] 배포 conclusion=success 및 공개 health HTTP 200 확인.

## Context (참고)

- 실패 배포: GitHub Actions run #29355449310.
- 컴파일 오류: `DashboardProgressBanner.tsx`, `OperatingProfitCard.tsx`.

## Steps (점진적 공개)

1. 두 파일의 클라이언트 지시문을 최상단으로 이동한다.
2. 전체 검증과 production build를 실행한다.
3. PR을 squash merge하고 배포·health를 확인한다.

## Log

- 2026-07-16 실패 배포의 webpack 오류를 재현 가능한 코드 위치로 확인.

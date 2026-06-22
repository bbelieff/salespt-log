# 2026-06-23 — 라우트 삭제 후 배포 빌드 실패 (보존된 .next/types orphan stub)

> **📄 요약**: PR #448(현수막 게시로그 API 라우트 삭제) 머지 후 VPS 배포 빌드가 `Cannot find module …banner-post/[row]/route.js` 로 실패. 무중단 빌드가 보존한 옛 `.next/types` 의 삭제된 라우트 타입 stub 을 typecheck 가 include 한 탓. 사이트는 옛 릴리스(#447) 계속 서빙 — 무중단 유지(롤백 불필요).

## 무엇이 터졌나
- 배포 워크플로우는 무중단 위해 옛 `.next` 를 보존하고 `.next-build` 에 빌드한다.
- Next.js 는 `.next/types/app/**/route.ts` 타입 stub + `validator.ts`(전부 import)를 생성하는데, **라우트가 source 에서 삭제돼도 보존된 옛 `.next/types` 의 stub 은 남는다.**
- `next build` 의 타입체크가 tsconfig include 의 `.next/types/**` 를 읽어 orphan stub(`import '…banner-post/[row]/route.js'`)을 만나 → 삭제된 source 못 찾음 → `Failed to compile`.
- 로컬에서도 동일 재현 → `rm -rf .next/types` 후 재빌드로 해소했었음(같은 근본원인).

## 고친 것
- `.github/workflows/deploy.yml` 빌드 단계: `rm -rf .next-build` → `rm -rf .next-build .next/types`.
- `.next/types` 는 **빌드타임 전용**(런타임 `next start` 미사용) → 옛 것 제거해도 무중단 안전.

## 재발 방지 (Hashimoto)
- 라우트(또는 app 디렉토리 파일) 삭제가 포함된 PR 은 배포 시 보존 `.next/types` 가 orphan 을 남길 수 있음 → 매 빌드 전 `.next/types` 청소로 구조적 차단.
- 사이트는 빌드 실패 시 cutover 안 해 옛 릴리스 유지(무중단) — 이 사고도 사용자 영향 0.

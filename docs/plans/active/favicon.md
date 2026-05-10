---
slug: favicon
status: active
created: 2026-05-11
worktree: ../wt/favicon
---

# feat: 브라우저 / 모바일 아이콘 (favicon + apple-icon + PWA manifest)

## 문제
도메인 즐겨찾기 시 아이콘 없어 generic globe 표시.

## 해결 (Next.js 15 자동 생성 활용)

| 파일 | 용도 | 사이즈 |
|---|---|---|
| `app/icon.tsx` | 브라우저 탭 / 즐겨찾기 favicon | 64×64 (자동 32px) |
| `app/apple-icon.tsx` | iOS 홈화면 추가 | 180×180 (그라데이션) |
| `app/manifest.ts` | PWA "홈 추가" 메타데이터 | — |
| `app/layout.tsx` | viewport.themeColor → #d71617, appleWebApp 활성화 | — |

디자인: 빨간 배경 + 흰 `$` (로고 모티프 추출).
ImageResponse 사용 → 빌드 시 자동 PNG 변환, 별도 자산 commit X.

## 부가 fix
- `instrumentation.ts` Sentry typedef 우회 (8.45 onRequestError 미export)
- SSOT: components.md 에 Analytics 등재 (PR #107 누락분 backfill)

## Acceptance
- [x] typecheck PASS
- [x] lint PASS (warning만)
- [x] doc-drift PASS

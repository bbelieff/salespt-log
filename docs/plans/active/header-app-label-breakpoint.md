---
slug: header-app-label-breakpoint
status: active
created: 2026-05-16
worktree: ../wt/header-mobile
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TopHeader "경영일지" 라벨의 breakpoint 를 sm(390) → 2xl(768) 로 올려 모바일에서 이름 truncate 방지
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/TopHeader.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 폰에서 "경영일지" 가 보이면서 이름이 잘렸는가? 어떤 breakpoint 로 바꿨는가?
> - **관련 문서**: [[tailwind.config.ts]] screens 설정

# header-app-label-breakpoint — 모바일에서 "경영일지" 숨김

## Executive Summary
사용자 보고 (2026-05-16): 모바일에서 사용자 이름 "{기수} {이름} 대표님" 이 truncate 되어 "6…" 만 보이고 그 옆에 "경영일지" 가 표시됨.

**root cause**: `tailwind.config.ts` 의 커스텀 screens 에서 `sm = 390px` (모바일 우선 설정 — 기본 Tailwind 640px 가 아님). 기존 `hidden sm:inline` 은 iPhone 12 이상(390px+) 폰 전 사이즈에서 "경영일지" 활성 → 이름 영역 축소 → truncate.

**fix**: breakpoint 를 `2xl` (768px = 태블릿 진입) 로 조정. 모든 폰(360~480) 은 "경영일지" 숨김, 태블릿+ 부터 표시.

## 변경 사항

### `components/TopHeader.tsx`
- "경영일지" span: `hidden sm:inline sm:text-sm` → `hidden 2xl:inline 2xl:text-sm`
- 파일 상단 JSDoc 반응형 섹션 갱신:
  - 옛 의도: "sm(390)+ 부터 표시" (모든 폰에서 보임)
  - 새 의도: "2xl(768)+ 부터 표시" (태블릿/데스크탑만)

## Acceptance Criteria
- [ ] iPhone Pro Max (440 CSS px) — 헤더에 "경영일지" 안 보임, 이름 truncate 안 발생
- [ ] Galaxy S22 (360 CSS px) — 동일
- [ ] iPad mini (768+) — "경영일지" 표시
- [ ] 데스크탑 (≥1024) — "경영일지" 표시
- [ ] check.sh 전체 통과

## Log
- 2026-05-16 sm:inline → 2xl:inline 로 breakpoint 조정 (커스텀 sm=390 의 실제 의미와 일치)

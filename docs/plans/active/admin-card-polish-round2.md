---
slug: admin-card-polish-round2
status: active
created: 2026-05-14
worktree: ../wt/card-polish-2
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: /admin/users 수강생 카드 2차 폴리시 + PersistentDetails 모바일 펼침/접힘 애니메이션 전 브라우저 대응
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/auth/TraineeCard.tsx`, `AdminUserPickerSections.tsx`, `TrainerLanding.tsx`, `PersistentDetails.tsx`, `app/globals.css`
> - **읽고 나면 알 수 있는 것**: 카드 공간 손실을 어떻게 줄였나? 모바일에서 박스 애니메이션이 왜 안 됐고 어떻게 고쳤나?
> - **관련 문서**: [[docs/design/components.md]]

# admin 카드 2차 폴리시 + 모바일 박스 애니메이션

## Executive Summary
PR #189 에서 다듬은 /admin/users 수강생 카드의 잔여 공간 손실을 추가로 줄이고,
PR #189 의 `::details-content` CSS 애니메이션이 Chrome 131+ 전용이라 모바일(iOS
Safari·삼성인터넷)에서 안 되던 문제를 JS height transition 으로 교체한다.

## 변경 사항

### TraineeCard.tsx
- [x] 드래그 핸들 공간 축소 — outer flex `gap-2 sm:gap-3` → `gap-1.5 sm:gap-2`, 핸들 `w-7` → `w-5`
- [x] 팀 입력 필드 유동 width — 고정 `width: 70` → `calc(${Math.max(3, team.length+1)}em + 0.75rem)` (내용만큼 늘어남), `px-1.5` → `px-1`
- [x] 이름 옆 🔗 링크 배지 — 라운드 박스(`rounded-full border bg-sky-50 px-1.5 py-0.5`) 제거, 텍스트만 (`text-sky-600 font-medium`)
- [x] `📊 시트 ↗` → `📊 시트` (우상향 화살표 제거)

### AdminUserPickerSections.tsx
- [x] LinkedAccountsBadge 라운드 박스 제거 (TraineeCard 와 동일하게)
- [x] 유보 섹션 `📊 시트 ↗` → `📊 시트`

### TrainerLanding.tsx
- [x] 담당 수강생 카드 `📊 시트 ↗` → `📊 시트`

### PersistentDetails.tsx + globals.css
- [x] `::details-content` + `interpolate-size` CSS 방식 제거 (Chrome 131+ 전용 → 모바일 미동작)
- [x] JS height transition 으로 교체 — summary onClick 가로채 wrapper `<div>` 의 height 를 직접 transition. 전 브라우저 동작, `prefers-reduced-motion` 즉시 토글
- [x] globals.css 의 `.pd-animated::details-content` 블록 제거 + 설명 주석

## Acceptance Criteria
- [ ] 카드 핸들 영역이 좁아지고 본문 공간 확보됨
- [ ] 팀 필드가 입력 내용 길이에 따라 늘어남 (빈 값일 때 "미배정" placeholder 안 잘림)
- [ ] 🔗 링크 표시가 라운드 박스 없이 텍스트만
- [ ] 시트 버튼에 우상향 화살표 없음 (admin·trainer 양쪽)
- [ ] 기수/팀 박스 펼침/접힘이 모바일에서도 부드럽게 애니메이션
- [ ] check.sh 전체 통과

## 비고 — [2] 기수설명탭 일자
사용자 [2] 요청(기수설명탭 개강~종강 일자 정정)은 **코드 버그 아님** — `fmtDateYY`
와 표시 로직은 정상. registry K/L 캐시 또는 시트 O1/O2 값 문제(데이터 이슈).
이 PR 범위 밖 — 동기화 버튼 또는 시트 직접 수정으로 해결. 사용자에게 안내 예정.

## Log
- 2026-05-14 카드 2차 폴리시 + PersistentDetails JS 애니메이션 재작성

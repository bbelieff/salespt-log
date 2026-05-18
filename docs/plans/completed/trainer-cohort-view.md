---
slug: trainer-cohort-view
status: active
created: 2026-05-15
worktree: ../wt/trainer-cohort-view
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TraineeCard 핸들·버튼 타이트닝 + /trainer 페이지를 /admin/users 의 권한축소판으로 개편 (기수박스>팀박스>TraineeCard 계층, 본인 담당에만 시트/웹앱 버튼)
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/auth/TraineeCard.tsx`, `SortableTraineeBox.tsx`, `AdminUserPickerSections.tsx`, `TrainerCohortView.tsx` (신규), `app/trainer/page.tsx`
> - **읽고 나면 알 수 있는 것**: TraineeCard 의 trainerEmailLc prop, viewOnly 모드에서 시트/웹앱 버튼 노출 분기, 트레이너 페이지가 admin/users 와 같은 계층을 어떻게 재사용하는가
> - **관련 문서**: [[docs/design/components.md#TrainerCohortView]]

# trainer-cohort-view — 수강생 관리 보완 + 트레이너 페이지 개편

## Executive Summary
사용자 요청 (2026-05-15):
- **[A] 수강생 관리 카드 보완**: 핸들 마진 더 축소해서 담당 칸 확보 (최대 4명 줄바꿈 X), 🔗 링크 표시 있어도 유보/시트/웹앱 버튼 줄바꿈 X
- **[B] 트레이너 페이지 개편**: /admin/users 의 권한축소판 — 기수박스>팀박스>수강생카드 계층 그대로. 전체 명단은 보이고, 본인 담당에만 [시트]/[웹앱] 버튼. 핸들·유보 등 admin 액션은 빠짐.

## 변경 사항

### [A] TraineeCard.tsx
- 드래그 핸들 영역 추가 축소 — outer flex `gap-1.5/sm:gap-2 → gap-1/sm:gap-1.5`, 핸들 `w-5 → w-4`
- Row 1: `flex-wrap` 제거 → 이름+🔗+버튼 한 줄 고정. 이름 span 에 `truncate` 추가 (안전 가드)
- 버튼 블록 gap `1.5 → 1`, padding 유보/시트 `px-3 → px-2.5`, 웹앱 `px-4 → px-3`
- Row 2: gap-x `3 → 2`, 담당 버튼 padding `px-1.5 → px-1` → 담당 칸 +14px

### [B] 트레이너 모드 지원 — TraineeCard
- `trainerEmailLc?: string` prop 추가
- 계산: `isAssignedToTrainer = parseAssigned(u.assignedTrainer).includes(trainerEmailLc)`
- 버튼 분기:
  - 유보: `!viewOnly` (admin only, 기존 그대로)
  - 시트/웹앱: `!viewOnly || isAssignedToTrainer` (admin OR 본인 담당)

### [B] Plumbing
- `SortableTraineeBox.tsx` — BoxCommonProps 에 `trainerEmailLc?` 추가, spread 로 TraineeCard 전달
- `AdminUserPickerSections.tsx` — CohortSection + CohortBody 가 `trainerEmailLc?` 받아 그대로 plumb

### [B] 신규 컴포넌트 `TrainerCohortView.tsx`
- /admin/users 의 CohortSection 을 `viewOnly + trainerEmailLc` 모드로 재사용
- 헤더 (트레이너명 + 마스터 메뉴/로그아웃) + 마스터 시트 링크 + 기수 섹션 (활성/보관)
- 핸들·유보·동기화·등록 UI 없음. 검색 일단 없음 (필요 시 후속).

### [B] `app/trainer/page.tsx`
- 이전: `listTraineesForTrainer(sessionEmail)` 로 본인 담당만 가져옴 + `TrainerLanding` 사용
- 변경: `listAllUsers` + `enrichUsersWithDates` 로 **전체 명단** + activeTrainers 합성 → `TrainerCohortView`
- 기존 `TrainerLanding.tsx` 삭제 (대체됨)

### docs
- `docs/design/components.md` — TrainerLanding 엔트리 → TrainerCohortView 로 교체

## Acceptance Criteria
- [ ] /admin/users — 카드 핸들 영역 더 좁아짐, 담당 4명까지 줄바꿈 없이 한 줄 표시
- [ ] /admin/users — 🔗 +N 배지 있는 카드도 유보/시트/웹앱 버튼이 한 줄에 들어감
- [ ] /trainer — 기수박스>팀박스>수강생카드 계층 (admin/users 와 동일 모양)
- [ ] /trainer — 본인 담당 trainee 카드에만 [시트]/[웹앱] 버튼 표시
- [ ] /trainer — 다른 trainee 카드는 정보만 (이름, 🔗, 담당 표시) — 버튼 없음
- [ ] /trainer — 핸들 없음, 유보 버튼 없음, 팀 입력 없음
- [ ] /trainer — 기수 헤더에 인원수·개강·종강·진행률·D-day 표시 (CohortSection 그대로)
- [ ] check.sh 전체 통과 (TrainerCohortView 가 components.md 에 등재됨, TrainerLanding 삭제됨)

## Log
- 2026-05-15 [A] 카드 폴리시 + [B] 트레이너 페이지 cohort layout 개편

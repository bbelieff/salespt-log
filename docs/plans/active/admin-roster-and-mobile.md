> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: /admin/users 트레이너 풀 admin synth 누락 + 관리부서 미필터 + 모바일 drag handle 가림 + 헤더 깨짐 + PersistentDetails 복귀 시 펼침 사고를 한 PR 로 정리.
> - **누가 읽나요**: 개발자 (admin/users 페이지 + role system 관련)
> - **어떤 기능·작업과 연결?**: `app/admin/users/page.tsx`, `app/api/admin/assign-trainee/route.ts`, `components/auth/AdminUserPicker.tsx`, `components/auth/TraineeCard.tsx`, `components/auth/TrainerAssignCard.tsx`, `components/auth/PersistentDetails.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 admin synth pattern 이 /admin/users 에도 필요한가? 모바일 드래그 핸들 노출 정책은?
> - **관련 문서**: `docs/decisions/0002-admin-synth.md` (없으면 후속), `docs/design/components.md`

# Admin roster + mobile polish

## 배경 (2026-05-14 사용자 보고)

사용자(beliefkimkim@gmail.com, 마스터+트레이너 겸직) 가 7가지 사고 한꺼번에 보고:

| # | 사고 | 원인 |
|---|------|------|
| 2 | 본인에게 담당 배정 시 `not_trainer` 에러 | `/api/admin/assign-trainee` 가 registry row 만 검증 — admin synth 미허용. `/api/admin/set-trainer-dept` 와 정책 어긋남. |
| 3 | 모바일에서 카드 드래그 핸들 안 잡힘 | 핸들에 `hidden sm:inline-flex` → 모바일 0px. |
| 4 | 모바일에서 수강생관리 헤더 깨짐 | sticky header 우측에 3 버튼 (동기화/수식복원/마스터메뉴) + 좌측 텍스트 → 가로 공간 초과. |
| 5 | 수강생관리 나갔다 들어오면 펼침 풀림 | PersistentDetails 가 mount 후 useEffect 로 localStorage 적용 → 첫 paint 가 defaultOpen 으로 잠깐 보임 (flash). |
| 6 | 동기화/수식복원 위치 (UI 개선) | sticky header 우측에서 본문 h1 옆으로 이동 (모바일 헤더 공간 확보). |
| 7 | 트레이너 드롭다운에 관리부서 포함 + 본인(김믿음) 누락 | `/admin/users` 가 admin synth + 관리부서 필터 누락 — `/admin/trainers` 의 검증된 로직 미적용. |

## 변경

### `app/admin/users/page.tsx`
- `/admin/trainers` 와 동일한 admin synth + 관리부서 필터 적용.
- 활성 트레이너 풀 = `fullList.filter((u) => !관리부서 && (role=trainer+active || ADMIN_EMAILS 멤버))`.

### `app/api/admin/assign-trainee/route.ts`
- 각 trainerEmail 검증 시 `isAdminSynthCandidate` 케이스 허용 (`set-trainer-dept` 와 동일 정책).

### `components/auth/AdminUserPicker.tsx`
- sticky header 에서 `MigrateCacheButton` + `InstallFormulasButton` 제거.
- 본문 h1 "수강생 관리" 옆으로 이동 (flex-wrap 으로 모바일 자동 wrap).
- header 단순화: 텍스트 + 마스터메뉴 링크만.

### `components/auth/TraineeCard.tsx`
- 드래그 핸들: `hidden sm:inline-flex` 제거 → 모바일 노출.
- `touchAction: "none"` 으로 page scroll 충돌 차단.
- 카드 내부 레이아웃 재편: handle (좌측) + content-wrapper (column on mobile, row on desktop).

### `components/auth/TrainerAssignCard.tsx`
- 동일 핸들 패턴 적용.

### `components/auth/PersistentDetails.tsx`
- `useState` lazy initializer 로 localStorage 동기 read → 첫 paint 부터 정확한 open 상태.
- `suppressHydrationWarning` 으로 SSR/client mismatch 무음.
- `handleToggle` self-fire 가드 (React prop sync 로 인한 toggle event 무시).

## 검증

- [x] `bash scripts/check.sh` 전체 통과
- [ ] 사용자 테스트: 본인에게 담당 배정 OK → not_trainer 안 뜸
- [ ] 사용자 테스트: 트레이너 드롭다운에 본인 표시, 관리부서 미표시
- [ ] 사용자 테스트: 모바일에서 카드 드래그 핸들 잡힘
- [ ] 사용자 테스트: 모바일 헤더 깨지지 않음
- [ ] 사용자 테스트: 펼침 상태 나갔다 들어와도 유지

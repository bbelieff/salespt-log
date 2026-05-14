> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #181 (admin-roster-and-mobile) 머지 후 사용자 피드백 4건 — assign-trainee 잔존 버그 + "담당 미배정" 한글 wrap + 닫힌 기수박스 모서리 sliver.
> - **누가 읽나요**: 개발자 (admin synth 정책 추가 컨텍스트)
> - **어떤 기능·작업과 연결?**: `app/api/admin/assign-trainee/route.ts`, `components/auth/TraineeCard.tsx`, `components/auth/AdminUserPickerSections.tsx`, `components/auth/AdminUserPicker.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 1차 admin synth fix 가 안 먹었는가? 한글 wrap 차단 패턴?
> - **관련 문서**: `docs/plans/active/admin-roster-and-mobile.md`

# Admin polish followup

## 사용자 피드백 (2026-05-14 KST 09:36, PR #181 머지 +13분 후)

| # | 사고 | 1차 fix 가 왜 못 잡았는가 |
|---|------|--------------------------|
| 4 | 트레이너관리 김믿음에게 담당 추가 시 여전히 `not_trainer` | `isSynthAdmin = !t && isAdminSynthCandidate(te)` — beliefkimkim 이 registry 에 `role="admin"` row 가 존재 → `t` truthy → 가드 통과 못함. ADMIN_EMAILS 멤버는 row state 무관하게 허용해야. |
| 1·2 | "담당 미배정" 버튼이 좁은 너비에서 character-by-character wrap ("담/당/미/배/정" 세로 깨짐). 손기학·연습기 카드처럼 단독 카드는 폭이 더 넓어 다른 모양. | 부모가 `flex-wrap` 인데 button 내부에 wrap 차단 없음 — 한글 default `word-break: normal` 은 각 음절 break 가능. `whitespace-nowrap` 추가 필요. |
| 3 | 기수박스 닫힘 상태에서 모서리에 slate-100 sliver | 외곽 `rounded-2xl` + summary 안쪽이 rectangular bottom corner → 라운드 mismatch 로 모서리에 outer bg 가 비침. `overflow-hidden` 으로 outer 가 summary 를 자기 모양으로 clip 해야. |

## 변경

### `app/api/admin/assign-trainee/route.ts`
- `isAdmin = isAdminSynthCandidate(te)` — registry row state 무관. (`!t` 조건 제거)
- 최종 가드: `!isTrainerRow && !isAdmin` → 404 not_trainer.
- 같은 사고 재발 방지 차원에서 주석에 1차 fix 실패 케이스 기록.

### `components/auth/TraineeCard.tsx`
- "담당" 버튼에 `whitespace-nowrap` 추가.
- non-canAssign span 도 동일하게 처리.
- 화살표 SVG 에 `shrink-0` 추가 (옆 텍스트 늘어나도 화살표 크기 유지).

### `components/auth/AdminUserPickerSections.tsx`
- CohortSection PersistentDetails: `overflow-hidden` 추가 + summary 의 `rounded-t-xl` 제거 (외곽이 clip 하므로 불필요).
- Team box PersistentDetails: `overflow-hidden` 추가.
- ReservedSection PersistentDetails: `overflow-hidden` 추가.

### `components/auth/AdminUserPicker.tsx`
- 보관된 기수 `<details>`: `overflow-hidden` 추가.

## 검증

- [x] `bash scripts/check.sh` 통과
- [ ] 사용자 테스트: /admin/trainers 에서 김믿음에게 trainee 토글 추가 OK
- [ ] 사용자 테스트: 모바일에서 "담당 미배정" 한 줄 표시
- [ ] 사용자 테스트: 닫힌 기수박스 모서리 깔끔

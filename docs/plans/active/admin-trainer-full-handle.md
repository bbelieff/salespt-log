> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: "트레이너관리에서 김믿음 핸들 안 됨" 3회 반복 사고 — synth admin 의 row 기반 작업 전부 깨지던 root cause 를 종합 해결.
> - **누가 읽나요**: 개발자 (synth admin 정책 종합)
> - **어떤 기능·작업과 연결?**: `lib/repo/users-sort.ts`, `lib/repo/users-delete.ts`, `app/api/admin/remove-trainer/route.ts`
> - **읽고 나면 알 수 있는 것**: synth admin 이 왜 row 기반 작업에서 깨졌나? 종합 해결책은?
> - **관련 문서**: `docs/plans/active/admin-polish-followup.md`, `docs/plans/active/trainer-dept-admin-row.md`

# Admin trainer — full handle (synth admin row 기반 작업 종합)

## 사고 (2026-05-14, 3회 반복 보고)

사용자가 "트레이너관리에서 김믿음 핸들 안 됨" 을 3번 보고:
1. → assign-trainee fix (PR #182)
2. → set-trainer-dept fix (PR #183)
3. → **여전히 핸들 안 됨** (이번)

**Hashimoto 위반**: 같은 지적 3회 = harness issue. 엔드포인트 하나씩 패치하지 말고
root cause 종합.

## Root cause

`beliefkimkim` 은 **ADMIN_EMAILS 멤버지만 registry row 가 없는 synth admin**.
row 기반 작업이 전부 깨짐:

| 액션 | API/함수 | 1·2차 fix 후 상태 |
|------|----------|-------------------|
| Trainee 토글 | assign-trainee | ✅ PR #182 (row 불필요 — 검증만) |
| [관리부서] | set-trainer-dept | ✅ PR #183 (synth append) |
| **⋮⋮ 드래그** | `setUserSortOrders` | ❌ row 없으면 `emailToRow.get` undefined → **silent skip** |
| **[퇴출]** | remove-trainer | ❌ `!u \|\| u.role !== "trainer"` → admin 거부 |

"핸들" = 드래그 핸들 (⋮⋮). 드래그해도 순서가 저장 안 되던 게 핵심.

## 종합 해결 (이 PR)

### 1. `lib/repo/users-sort.ts` — `setUserSortOrders` synth admin row 자동 생성
- order email 이 registry 에 없고 `isAdminSynthCandidate` 면 → **새 trainer row append**
  (cohort="T", role="trainer", M=sortOrder). `setTrainerDepartment` synth append 와 동일 스키마.
- 한 번 드래그하면 김믿음이 **실제 trainer row 보유** → 이후 모든 작업 일관 동작.
- 반환값에 `created` 카운트 추가.

### 2. `lib/repo/users-delete.ts` — `removeTrainerCompletely` no-row 안전 처리
- synth admin (row 없음) 은 `deleteUserByEmail` 이 throw → `hasRow` 확인 후 호출.
- row 없으면 매핑 cleanup 만 수행 (삭제할 row 없음).

### 3. `app/api/admin/remove-trainer/route.ts` — admin 허용
- `isTrainerRow || isAdminSynthCandidate` (assign-trainee / set-trainer-dept 와 동일 정책).

## 왜 이게 root fix 인가

`setUserSortOrders` 가 row 를 생성하면, 김믿음은 첫 드래그 시점에 **registry 의 실제
trainer row** 가 됨. 그 시점부터:
- assign-trainee: t.role="trainer" → OK (이미 동작했지만 이제 더 견고)
- set-trainer-dept: u 존재 → OK
- remove-trainer: u.role="trainer" → OK
- setUserSortOrders: row 존재 → M 업데이트 OK
- /trainer 페이지: 담당 trainee 조회 OK

= synth admin 의 "지박령" 상태가 첫 드래그로 해소됨.

`isAdminEmail()` 은 env ADMIN_EMAILS 체크라 registry row 와 무관 → 김믿음의 admin
권한은 그대로. registry row 는 "트레이너로서의 신분" 만 추가.

## 검증

- [x] `bash scripts/check.sh` 통과
- [ ] 사용자 라이브: /admin/trainers 에서 김믿음 카드 ⋮⋮ 드래그 → 순서 저장됨
- [ ] 사용자 라이브: 드래그 후 새로고침해도 순서 유지
- [ ] 사용자 라이브: [퇴출] 클릭 → not_trainer 안 뜸

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: PR #182 followup — `/api/admin/set-trainer-dept` 도 같은 admin row 패턴 버그 가지고 있어 같이 fix.
> - **누가 읽나요**: 개발자 (admin synth 패턴 컨텍스트)
> - **어떤 기능·작업과 연결?**: `app/api/admin/set-trainer-dept/route.ts`
> - **읽고 나면 알 수 있는 것**: 왜 동일 패턴 버그가 여러 endpoint 에 퍼져 있었나? 향후 가드레일?
> - **관련 문서**: `docs/plans/active/admin-polish-followup.md`

# Trainer dept admin row fix

## 배경 (2026-05-14 KST 10:30, PR #182 머지 +30분 후)

사용자: "트레이너관리에서 김믿음 카드가 아직도 핸들이 안먹혀"

PR #182 가 `assign-trainee` 만 fix 함. 같은 패턴 버그가 **`set-trainer-dept`** 에도 존재:

```ts
const isSynthAdmin = !u && isAdminSynthCandidate(target);
```

→ `beliefkimkim` 이 registry 에 role="admin" row 가 있으면 `u` truthy → 가드 fail → not_trainer.

## 변경

### `app/api/admin/set-trainer-dept/route.ts`
- `isAdmin = isAdminSynthCandidate(target)` (`!u` 조건 제거).
- ADMIN_EMAILS 멤버는 registry row state·role 무관하게 trainer-dept 변경 허용.
- `setTrainerDepartment` 함수 자체는 이미 row exists/synth 분기 잘 처리 (`exists` 체크 후 update or append).

## 미수정 항목 (의도)

- `remove-trainer`: admin 거부 유지. 마스터를 trainer pool 에서 제거하는 건 위험 (담당 매핑 cleanup + row 삭제 → ADMIN_EMAILS env 만 있고 registry 없는 synth 상태로). 사용자가 명시 요청 시 별도 처리.
- `set-user-sort-orders` (드래그 reorder): synth admin (registry row 없음) silent skip 유지. registry row 있는 admin 은 정상 동작. 드래그가 안 되면 한 번이라도 [관리부서] 토글하면 자동으로 row 생성됨.

## Hashimoto note

같은 패턴 (`isSynthAdmin = !u && isAdminSynthCandidate(target)`) 이 여러 endpoint 에 복붙됐고, 각 endpoint 마다 admin row 케이스에서 fail. **하네스 개선 후보**: `lib/auth/identity.ts` 에 `canTargetAsTrainer(email): Promise<boolean>` 헬퍼 추출 → 모든 trainer-targeting API 가 동일 가드 사용. 후속 PR.

## 검증

- [x] `bash scripts/check.sh` 통과
- [ ] 사용자 라이브: /admin/trainers 에서 김믿음 → [관리부서] 클릭 → not_trainer 안 뜸

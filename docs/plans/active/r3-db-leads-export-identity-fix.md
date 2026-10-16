---
slug: r3-db-leads-export-identity-fix
status: active
created: 2026-10-16
owner: WORKER A
work_id: SALES-PT-R3-DB-LEADS-EXPORT-IDENTITY-R1
worktree: ../wt/codex-r3-db-leads-export-identity-fix
branch: codex/r3-db-leads-export-identity-fix
base: 0253b3b882f3808a145a6693fca4e8cb43e67616
---

# DB·리드·내보내기 수강생 컨텍스트 일치

> **요약 카드**
> - **무엇인가요?** 이미 승인된 DB·리드·내보내기 API의 조회·쓰기 주체를 검증된 수강생 컨텍스트에 맞추는 기존 작업의 실행 계획입니다.
> - **누가 읽나요?** 이 작업의 제작 담당, APPOINTED_FOREMAN, 독립 검수 담당입니다.
> - **연결된 기능**: `/api/db`, `/api/db/[channel]`, `/api/db/[channel]/[row]`, `/api/leads`, `/api/export`.
> - **관련 정본**: [개발 규칙](../../../CLAUDE.md), [인증 주체 구현](../../../lib/auth/identity.ts), [품질 기준](../../quality.md).
> - **운영 경계**: 이 후보는 코드·합성 테스트·계획만 변경합니다. 운영 DB·Sheet·고객 데이터 쓰기는 0입니다. PR은 독립 검수 전 HOLD이며 merge·deploy는 별도 RELEASE 대상입니다.

## 목표와 기존 계약

DB·리드·xlsx 내보내기가 `requireStudentViewContext()`로 해석한 수강생 이메일을 사용하게 합니다. 아레나 자기보기에서도 트레이너의 세션 이메일을 대상 이메일로 오인하지 않습니다. 무효한 대상, 대상 미선택, 권한 거절, 미인증은 downstream service 호출 전에 401/403과 안정적인 `error`·`code`를 반환합니다.

쓰기 경로는 기존 `getWritableUserEmail()` 보호를 유지하고, 그 결과와 컨텍스트 이메일이 다르면 403으로 거절합니다. 기존 append 멱등 키·충돌·DB 장애 시 fail-closed 동작과 요청/응답의 나머지 계약은 보존합니다. 인증·registry 정책 자체를 바꾸지 않습니다.

## 정확한 임대 범위

기존 구현·테스트 8경로:

1. `app/api/db/route.ts`
2. `app/api/db/[channel]/route.ts`
3. `app/api/db/[channel]/[row]/route.ts`
4. `app/api/leads/route.ts`
5. `app/api/export/route.ts`
6. `tests/api/db-leads-export-student-context.test.ts`
7. `tests/api/db-append-idempotency-route.test.ts`
8. `tests/api/db-append-failclosed-e3.test.ts`

추가로 승인된 유일한 계획 경로는 이 파일입니다. worklog, 인증 공용 구현, 데이터 모델, migration, package/lock, 다른 계획, 외부 worktree는 편집 범위가 아닙니다. UI·정책·DB schema 변경은 없습니다.

## 수용 기준과 검증 상태

- [x] 보존 후보를 `d039317175f6b16a2a13d4dea3b9afef34ddc54c`에서 현재 base로 fast-forward. 임대 경로의 upstream 변경 0, 충돌 0, 8개 SHA256 동일.
- [x] 기존 focused 4파일·33테스트 PASS 증거를 동일한 8개 blob에 한해 재사용. 이는 새 base의 전체 검사·build를 대체하지 않습니다.
- [x] 기존 반증: DB 읽기를 세션 이메일로 되돌렸을 때 8개 중 6개 실패, 원래 blob 복원 후 GREEN. 현재 재실행은 하지 않습니다.
- [ ] 정상 pre-commit을 fork/thread 최솟값·최댓값 각각 1로 한 번 실행해 typecheck·lint·structural·unit/integration·크기·doc-drift 통과.
- [ ] 현재 9경로에 대해 비밀값·고위험 개인정보 패턴 및 `git diff --check` 통과.
- [ ] 정상 훅 성공 뒤 bundled Node24로 production build 한 번 통과. 훅과 build는 겹쳐 실행하지 않습니다.
- [ ] 정확히 9경로만 commit/push하고 비초안 PR 생성. head/tree·SHA256·CI 상태를 Foreman에게 반환.
- [ ] 독립 최종 검수. 그 전까지 PR HOLD, merge·deploy 미실행.

검사 실패는 그대로 FAIL/BLOCKED로 반환하고 이 실행에서 재시도하지 않습니다. 현재 worktree의 의존성이 불완전했던 과거 검사는 FAIL_ENV였으며, 다른 세션의 통과나 부분 테스트를 전체 PASS로 대체하지 않습니다.

## 남은 경계

현재 service 인자는 이메일입니다. 같은 이메일의 여러 enrollment에서 `targetRef`·cohort까지 동일 행을 선택하는지에 대한 종단 증명은 **UNVERIFIED**이며 이 임대에서 범위를 확대하지 않습니다. 운영의 인증된 사용자 시나리오 검증과 실제 데이터 정합성은 이번 합성 테스트의 PASS에 포함되지 않습니다.

## 복구와 다음 단계

현재 base 이전의 후보 8개 파일과 tracked/new-file patch를 저장소 밖의 SHA-bound recovery 디렉터리에 보관했습니다. fast-forward 이후에도 후보 바이트가 같아 재적용이 필요하지 않았습니다. 해당 임시 경로와 patch SHA256은 Foreman CHECKPOINT에 남깁니다.

PR 전 실패 시 owned worktree·후보·임대를 보존하고 정확한 실패 gate를 반환합니다. merge 후 별도 RELEASE 과정에서 되돌림이 필요하면 해당 squash commit을 revert하고 정상 검사·배포·health를 확인합니다. 운영 데이터 변경은 없으므로 데이터 rollback은 없습니다. reset/clean·타인 변경 정리는 하지 않습니다.

## CHECKPOINT — 2026-10-16

- 원격 master/base: `0253b3b882f3808a145a6693fca4e8cb43e67616`.
- 열린 PR 3개와 기존 8경로 충돌 0, 후보 원격 branch/PR 없음, 소유 worktree 실행 프로세스 0 확인 후 재개.
- 구현 8개 blob 불변. 이번 material write는 승인된 계획 1개 추가뿐입니다.
- 정상 훅·현재 base build·원격 CI: 아직 NOT_RUN. 성공 전 완료로 표시하지 않습니다.
- 다음 안전 행동: 비밀값·범위 확인 → 정상 훅 1회 → 통과 시 Node24 build 1회 → push/비초안 PR HOLD.
- helper: `NONE`. 운영·고객 데이터 write: `0`.

## 정상 훅 1회 결과 — 2026-10-16

- `VITEST_MIN_THREADS=VITEST_MAX_THREADS=VITEST_MIN_FORKS=VITEST_MAX_FORKS=1`을 process-local로 설정하고 정상 `git commit`을 한 번 시도했습니다. 훅 우회는 없습니다.
- typecheck: **FAIL_ENV**. `next/server`, Next metadata types, `@tanstack/react-query`, `posthog-js` 등 누락과 불완전한 `xlsx` 타입 선언을 확인했습니다. 이 환경의 다른 타입 오류를 코드 검증 완료로 분류하지 않습니다.
- lint: **FAIL_ENV**. 설치된 Next 실행 파일이 없어 `npx --no`가 패키지 누락으로 실행을 거절했습니다. 추가 설치는 하지 않았습니다.
- structural·unit/integration: **FAIL_ENV**. PostCSS가 `autoprefixer`를 찾지 못해 테스트 로드 전에 종료됐습니다. 위의 동일 blob focused 33/33은 과거 PASS로만 유지합니다.
- 실패 후 재시도 금지 조건에 따라 file-size 단계에서 실행을 중단했습니다. 이 실행의 file-size·doc-drift 최종 결과는 **NOT_RUN**입니다. commit은 생성되지 않았습니다.
- 비밀값·고위험 개인정보 패턴: 9경로에서 일치 0, `git diff --check` PASS.
- bundled Node `v24.19.0` 확인. production build는 훅 실패로 **NOT_RUN**이며 push·PR·CI·merge·deploy도 **NOT_RUN**입니다.
- 다음 행동: 보존 후보와 정확한 누락 패키지를 Foreman에게 반환하고 의존성 복구 지시를 기다립니다. 네트워크 설치·동일 검사 재시도는 하지 않습니다.

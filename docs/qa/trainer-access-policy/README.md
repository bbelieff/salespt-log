# #958 순수 권한 정책 — 실행 QA / 부모 인계

## 결과

- 기준 HEAD `c781febca94c9b476409d6f9db0da8ac512bb49a`, 브랜치 `feat/trainer-access-policy`.
- 신규 정책 회귀 **166 tests** 통과. 실제 기본 권한 매트릭스, read/write 독립 제한, malformed 입력, metadata unknown, archived/arena 우선, 기존 parser의 정규화 결과 및 불변성 검증.
- 최종 `bash scripts/check.sh` **exit 0 / PASSED**: 구조 **8 files / 41 tests**, 단위/통합 **183 files passed / 2 skipped; 1876 tests passed / 37 skipped**. 기존 조건부 ops skip은 해제하지 않았다.
- `npx next build` **exit 0**, 컴파일 성공 **74s**, static pages **71/71**. module-only지만 lib runtime 파일이 추가되어 전체 build를 실제 실행했다.
- `npm ci` **exit 0**, 1208 packages 설치 / 1209 audited. 기존 peer/deprecation 경고와 audit **110 vulnerabilities (2 low, 88 moderate, 15 high, 5 critical)** 출력. package/lock/보안 설정은 변경하지 않았다. 설치 stdout은 실행 도구 결과에 있으며 아래 build/check 로그와 혼동하지 않는다.
- Git 변경경로와 명시 소유목록의 Python set 차집합 검증: `verify-scope.py`, 결과 `scope.log`. 허용 밖 변경 없음. 신규 제품/회귀 파일의 SHA-256와 줄 수도 출력한다. 커밋/푸시/PR/머지/다른 writer spawn/resume 없음.

## 실제 로그

명령은 모두 이 전용 worktree에서 실행했다. `set -o pipefail` + `tee`로 실제 exit code를 유지했다.

| 단계 | assertion RED (exit 1) | GREEN (exit 0) |
|---|---|---|
| senior 기본 grants | [red-1-assertion.log](red-1-assertion.log): 1 fail | [green-1.log](green-1.log): 1 pass |
| regular/apprentice 기본값 | [red-2.log](red-2.log): 2 fail / 12 pass | [green-2.log](green-2.log): 14 pass |
| strict grants 검증 | [red-3-assertion.log](red-3-assertion.log): 3 fail / 35 pass | [green-3.log](green-3.log): 38 pass |
| 정규화 학생 분류 | [red-4.log](red-4.log): 15 fail / 67 pass | [green-4.log](green-4.log): 82 pass |
| 최종 read/write 판정 | [red-5.log](red-5.log): 13 fail / 152 pass | [green-5.log](green-5.log): 165 pass |
| import-0 구조 규칙 | [structural-red.log](structural-red.log): 1 fail / 12 pass | [structural-green.log](structural-green.log): 179 pass (정책166 + 구조13) |

- `red-1.log`/`red-3.log`: 신규 모듈/export가 없는 최초 실행 실패도 보존. assertion 실패를 다시 확인한 뒤 구현했다.
- [check.log](check.log): 최초 전체 검사 실패. **유틸의 type import가 기존 import-0 구조 규칙을 위반**했다. 기존 테스트/훅/예외목록은 변경하지 않고 유틸의 import 자체를 제거했다.
- [check-final.log](check-final.log): 수정 후 전체 PASS. typecheck/lint/doc-drift/500줄 게이트 포함.
- [build.log](build.log): 실제 전체 build PASS. 기존 workspace-root 추론, Sentry global-error, webpack cache, 기존 UI lint 경고 존재. 새 제품 파일을 경고 원인으로 표시하지 않음.

## 공개 API (모두 순수, I/O/import/환경변수 의존 0)

```ts
// 반환 구조는 공개 TrainerGrants와 호환; 타입 일치는 회귀+tsc로 고정.
defaultTrainerGrants(grade: unknown): {
  active: { read: boolean; write: boolean };
  arena: { read: boolean; write: boolean };
  archived: { read: boolean; write: boolean };
}
isTrainerGrants(value: unknown): value is ReturnType<typeof defaultTrainerGrants>
classifyTrainerStudent(input: unknown): "active" | "arena" | "archived" | null
canTrainerAccessStudent(actor: unknown, student: unknown, operation: unknown): boolean
```

공개 타입: `TrainerGrade`, `TrainerStudentCategory`, `TrainerAccessOperation`, `TrainerCategoryGrant`, `TrainerGrants`, `NormalizedTrainerActor`, `NormalizedTrainerStudent` (`lib/types/trainer-access.ts`). barrel은 수정하지 않았으므로 deep import한다.

```ts
// 신원/행 선택은 서버 호출자의 책임. 예시는 개인 식별자를 포함하지 않는다.
const actor = {
  grade: "regular", status: "active", grants: defaultTrainerGrants("regular"),
};
const student = {
  rowStatus: "active", cohortStatus: "active", cohortType: "cohort",
  cohortMetadataTrusted: true, isArenaLabel: false, isReserved: false,
};
canTrainerAccessStudent(actor, student, "read");
```

- actor 필드는 정확히 grade/status/grants. grants는 필수이며 **null/undefined/partial/array는 기본값 fallback 없이 거부**한다. 기본값은 호출자가 저장값 부재 정책을 승인받은 경로에서 명시적으로 선택해야 한다.
- grade 기본값은 **권한 상한**: senior 세 분류 RW, regular/apprentice active RW만. 명시 grants는 상한 내에서 읽기전용/전체철회 등 **제한**할 수 있지만 확대하지 않는다. grade override/예외 허용 정책이 필요하면 별도 결정 후 통합해야 한다.
- 모든 category와 read/write boolean이 필수. 여분 키, inherited object, write=true/read=false는 전체 정책 거부. 문자열 coercion/대소문자/공백 보정 없음.
- student의 정확한 여섯 필드 모두 필요. pending/reserved/unknown metadata 제외 → archived row/cohort → arena type/label → 확인된 일반 active. 하나라도 archived이면 active/arena로 재해석하지 않는다.
- `cohortMetadataTrusted=true`는 **조회 성공과 필요한 보관 metadata가 신뢰 가능하게 해석됨**을 의미한다. `cohorts.ts:46-54` catch→[] 및 `124-130` default-active를 성공 증거로 사용하지 않는다. 정상 empty와 실패가 구분되지 않는 현재 repo 경로는 통합 전 보완 필요. missing/unknown일 때 false/null을 전달하고 접근을 거부한다.
- 호출자는 `cohort-token.ts:31-49,68-82` 기존 숫자/아레나 시즌/참가자 parser를 사용한다. cohort와 cohortLabel 양쪽, 참가자와 시즌 metadata를 확인한다. `user-priority.ts:80-88`의 숫자 B/아레나 I 불일치도 반영해야 한다. util에는 raw label parser를 복제하지 않았다.
- actor는 인증된 trainer 자격 행, student는 특정 trainee 수강행이다. 이름 기반 권한·개인 이름/이메일 seed는 없다. **관리자와 본인 정규/아레나 CRM은 호출자의 별도 경로**이며 이 정책 false를 본인 CRM 차단으로 사용하지 않는다.

## 소유 파일 / 범위

- 새 `lib/types/trainer-access.ts` (29줄)
- 새 `lib/util/trainer-access-policy.ts` (67줄)
- 새 `tests/util/trainer-access-policy.test.ts` (217줄)
- `docs/domains/data-model.md`에 계약 15줄 추가만 (원래 줄바꿈 보존, git diff --numstat 확인).
- `docs/plans/active/trainer-access-policy.md` 유지, 이 전용 QA와 실행 로그.
- 기존 auth/identity/API/UI/DB/훅/스크립트/테스트/lock 변경 없음. OG worktree와 Windows wt/trainer-recruitment에는 쓰기하지 않았다.

## 통합 NOT_RUN — OG/부모 소유

- 자격/grade/grants 저장 및 승인/거절/퇴출, DB migration/실데이터/seed.
- metadata 조회 성공 신호를 보존하는 adapter (catch→[] 보완), trainee/자격 행 identity 연결.
- auth/impersonation, 학생 목록/읽기/쓰기 API의 실제 정책 호출과 기존 담당자 제한 조합.
- 관리자 권한/설정 UI, 본인 정규·아레나 CRM 및 pending trainer+기존 trainee 다중행 실제 flow.
- 브라우저·live·배포·health·외부 API/DB 검증. 전체 build/기존 테스트 PASS는 이 통합들이 수행됐다는 증거가 아니다.

수용범위 module-only 구현/회귀/검사 완료. 제품 권한 반영은 **아직 아님**. 부모가 OG와 통합하고 다시 전체 검사해야 한다.

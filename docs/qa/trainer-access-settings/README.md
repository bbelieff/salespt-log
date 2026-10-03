# #958 DH — 등급·권한 저장/API/독립 편집 실행 결과

현재 소유 범위 구현 및 합성 검증 결과다. **학생 목록·실제 CRM ACL에 연결하거나 운영에 배포한 결과가 아니다.** 기존 관리자 page에는 mount하지 않았다. 부모의 #956 완료/공용부 인계 이후 같은 writer가 직렬 통합해야 한다.

## 기준과 변경

- worktree `wt/trainer-access-policy`, branch `feat/trainer-access-policy`, HEAD `c781febca94c9b476409d6f9db0da8ac512bb49a` 유지. 기존 순수 정책 util/166 tests는 SHA256 불변.
- 승인 원본 `trainer-unified-v4.html` SHA256 `bf6fd7e44c742f260eda1c11a5256992582704f0bd379b31f3e59620b1c2bcba` 실측 일치. 목록/편집/확인 배치·CSS 보존. 동명이인 구별을 위해 서버 이메일 표시, 신규 미분류/실패/재조회 상태 추가.
- 신규: `lib/repo/db/trainer-access-settings.ts`, `lib/service/trainer-access-settings.ts`, `app/api/admin/trainer-access/route.ts`, `components/auth/TrainerAccessEditor.tsx`, `lib/repo/db/migrations/0007_trainer_access.sql`.
- 확장: `lib/types/trainer-access.ts`의 Zod 저장 경계/조회 계약, 관련 tests 6개, 전용 QA/활성 계획, data-model/components 관련 등록만.
- 최초 `git fetch origin`은 공유 `.git/worktrees/trainer-access-policy/FETCH_HEAD` 쓰기 거부. 로컬 origin/master도 c781feb. GitHub 읽기 connector로 열린 PR 959/954/942/798의 파일 목록 확인: migration 추가는 #959의 0006뿐. 원격 master의 0007 정확 경로 404, `path:lib/repo/db/migrations 0007` 검색 결과 0. **0007 채택, 운영 직렬 적용 전 번호와 원격 head 재확인 필요.**

## 실행 검증

| 실행 | 결과 | 증거 |
|---|---|---|
| 관련 Vitest: 정책+서비스+API+repo | exit 0, 214 PASS (기존166 + 신규48) | [focused.log](focused.log) |
| 실제 격리 PostgreSQL(PGlite) + 실제 service/repo SQL | exit 0, 44 assertions PASS | [postgres-final.log](postgres-final.log), [JSON](postgres-result.json) |
| 실제 React + 설치된 Chrome, 합성 HTTP store | exit 0, 46 assertions PASS, GET7/PUT6, React 오류0 | [browser-native-chrome.log](browser-native-chrome.log), [JSON](browser-result.json) |
| 원래 worktree `npx next build` | exit 0, 71/71 static pages, 신규 API 포함 | [build-native.log](build-native.log) |
| 원래 worktree `bash scripts/check.sh` | exit 1: Vitest esbuild 상위폴더 접근 거부. tsc/lint/doc-drift는 통과 | [check-native.log](check-native.log) |
| 소스 복사본 + 공유 Git 참조 `bash scripts/check.sh` | exit 1: 구조41/단위1924 PASS·37 기존 skip, 마지막 worktree 점검에서 종료 | [check-snapshot.log](check-snapshot.log) |
| 독립 검증 복사본 `bash scripts/check.sh` | exit 0, PASSED. 구조41/단위1924 PASS·기존37 skip, tsc/lint/500줄/doc-drift 통과 | [check-final.log](check-final.log) |
| Python 소유 집합/검증 소스 동일성 | exit 0, 허용외0, 제품·tests·설정·보호 게이트 SHA 일치 | [scope.log](scope.log), [verify-scope.py](verify-scope.py) |

### RED → GREEN의 정확한 의미

- 최초 [red.log](red.log), [native-attempt.log](native-attempt.log)는 **실행기 접근 오류**이며 기능 assertion RED로 계산하지 않는다. [first-runtime.log](first-runtime.log)의 API suite 실패도 복사 중 미완성 dependency 오류다.
- 기능 반증은 별도 **고의 결함 검증 번들**로 실제 실행했다. 제품 소스는 변경하지 않고 격리 번들에만 `QA_ACCESS_MUTATION`을 적용했다. 이는 구현 전 TDD 이력이라고 주장하지 않는다.
- `allow-nonadmin`: 실제 관리자 검사를 제거 → 비관리자 저장 거부 assertion 실패, exit 1 ([red-admin-assertion.log](red-admin-assertion.log)).
- `skip-grade-reset`: 서버 등급 reset 제거 → 강등 후 기본값 assertion 실패, exit 1 ([red-reset-assertion.log](red-reset-assertion.log)).
- 원본 번들로 복원 → 실제 SQL/서비스 검증 GREEN ([postgres-green.log](postgres-green.log), 이후 CAS·감사 rollback 추가 [postgres-final.log](postgres-final.log)). 기존 테스트/스크립트/훅을 약화하거나 테스트를 skip하지 않았다.

### 환경 구분

원래 worktree에서 esbuild가 `Cannot read directory ../../../../..: Access is denied`로 config를 읽지 못했다. 허용된 `C:/Users/Public/Documents/ESTsoft/CreatorTemp/trainer-access-settings-verify`에 소스/동일 node_modules를 복사해 테스트했다. `.env*`, credentials, raw, logs, scratchpad, HANDOFF는 복사하지 않았다. 일부 긴 dependency 경로는 Windows long-path prefix로 동일 파일 복사를 완료했다. package/lock 변경이나 설치는 없다.

검증 폴더의 독립 `git init`은 `check.sh`의 worktree 점검용 메타데이터만 생성했고 commit/remote는 없다. 원래 Git 메타데이터를 고치거나 보호 게이트를 수정하지 않았다. [scope.log](scope.log)는 제품/tests/설정/게이트 21파일의 SHA 동일성을 확인한다. 빌드는 원래 worktree에서 실행했으며 이 환경 차이를 감추지 않는다.

PGlite는 단일 엔진이므로 겹친 service 호출은 fixture connection lease가 직렬화한다. 실제 SQL CAS의 stale update·중복 initial insert 거부, 같은 transaction의 감사 실패 시 rollback을 추가로 직접 확인했다. **멀티 커넥션 PostgreSQL의 자격 행 lock 대기 시간/실운영 경쟁은 NOT_RUN.**

## 서버·저장 실행 계약

1. GET/PUT `/api/admin/trainer-access`. 두 서비스 공개 진입점이 실제 session email을 확인하고 `isAdminEmail`로 admin-only를 강제한다. impersonation·브라우저 role·이름으로 인증하지 않는다. 서버 auth 의존 실패는 503, 비관리자는 403.
2. PUT JSON은 정확히 `{ email, grade, grants, version }`. 정규화된 exact 이메일(최대254), 세 grade allowlist, 세 category의 read/write boolean 전체, write→read, 상한, 정수 version을 서버 Zod로 검사한다. 여분 이름·status·audit 필드는 400. Origin은 AUTH_URL/NEXTAUTH_URL/기존 production origin 계약, content-type JSON, cross-site 거부. 모든 응답 no-store. Next가 GET/PUT 외 메서드는 405 처리한다.
3. `trainer_qualifications(email,name,status)`가 #956 compatible adapter 정본이다. 새 repo는 기존 `lib/repo/db/client` pool만 사용하고 registry/학생 key/이름 fallback은 없다. 이름·메일·status 손상/중복은 실패로 반환하며 빈 목록으로 숨기지 않는다. 관리자용 목록에 active 자격만 노출한다.
4. 설정 없는 active 자격은 `grade:null, grants:모두 false, version:0`. 임의 등급을 부여하지 않는다. 기존 설정이 손상되면 503이며 기본값으로 수리하지 않는다.
5. 저장 transaction은 exact 자격 행 `FOR SHARE` → service active 검증 → 현재 version 확인 → SQL CAS → 같은 transaction audit snapshot → commit. 자격 상태 변경은 lock 뒤 직렬화된다. 동시 설정 변경은 한 번만 저장하고 stale 버전은 409. audit 실패도 settings update를 rollback한다.
6. grade가 바뀌면 서버에서 등급 기본값 reset. UI도 즉시 기본값을 보이고 **등급을 저장한 뒤 개별 권한 조정**을 허용한다. 동일 grade의 저장은 read-only/전체 철회를 포함한 상한 내 grants를 유지한다. read 해제는 write도 해제하고 write 선택은 read를 켠다.
7. SQL은 신규 settings/audit 두 표만 생성한다. settings email FK→#956 qualifications, grade/정확한 JSON boolean 구조/read-write/상한/version CHECK. audit은 버전별 변경 주체와 결과 snapshot. PUBLIC/anon/authenticated 접근 회수+RLS, 기존표/roles/자격/학생 변경·seed 없음. #956과 같은 기존 서버 연결/owner 또는 승인된 운영 role 계약이 필요하며 실제 role ACL 검증/부여는 부모 운영 게이트 소유다.
8. 신규 migration은 자동 실행하지 않는다. #956 0006 선행, SQL hash·원격 번호·정확 artifact·운영 ACL을 부모가 확인한 다음 직렬 적용해야 한다. 기존 `db-migrate.yml`/ops 명령은 추가·변경하지 않았다. 안전한 되돌림은 앱 변경 revert, 저장된 설정·audit는 보존한다.

## React 검증 범위

- default export `TrainerAccessEditor({ endpoint?: string, readOnly?: boolean })`. endpoint 기본 `/api/admin/trainer-access`. readOnly는 표시용이며 서버 권한을 대신하지 않는다. 기존 page 미마운트.
- GET 로딩/빈 목록/실패, 서버 email 기준 선택, 동명이인 구별, 미분류 권한0, grade reset, read/write 종속, 기본값/취소, 확인 dialog/Escape, dirty 선택 확인, beforeunload.
- PUT 실패·409는 초안 보존, 관찰된401/403은 편집 잠금. 성공 PUT 후 GET 완료까지 저장 완료 표시 금지. GET 실패면 중복 PUT 대신 결과 재조회. endpoint 변경/unmount의 오래된 응답 무시.
- 실제 360/390/1440에서 scrollWidth=viewport, 주요 버튼 높이44px 이상. [360 화면](editor-360.png), [390 화면](editor-390.png), [PC 화면](editor-1440.png). 합성 인물/서버를 사용했고 승인 목업의 Noto 폰트를 상속해 확인했다. 원래 관리자 페이지와 로그인된 운영 브라우저 검증은 NOT_RUN.

## 남은 직렬 통합 — 전부 NOT_RUN

- #956 완료 후 공용부 인계, 기존 admin/trainers page 마운트 및 qualification/identity에 저장 정책 연결.
- 모든 학생 목록/읽기·쓰기 API ACL, 강등 뒤 열린 화면 조회·저장 차단, 저장 타깃을 본인 계정으로 자동 바꾸지 않기.
- 주간목표 ACL 통합, archive/arena metadata catch→[]를 성공으로 간주하지 않도록 보완.
- 관리자 예외와 본인 정규/아레나 CRM 보존 통합회귀.
- 초기 요청 6명: 김믿음/박수혁/황의진 senior, 김하나/김종근 regular, 김영준 apprentice. **이름으로 seed/권한 부여하지 않았다.** 부모 full task에서 실제 인증 계정과 active 자격 exact 매핑을 확인한 뒤 명시 설정해야 한다. 운영 이메일·계정 매핑은 이 단계에서 조회하지 않았다.
- 실DB migration/실계정 변경/운영 role ACL 실측, commit/push/PR/merge/배포/health/live 인증 검증. 원격 메시지/Slack/새 writer/세션/cron 없음.

RLS/ACL 검토 근거: [Supabase 공식 RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security), 기존 #956 0006 SQL. changelog.md 조회는 도구의 markdown content-type 지원 오류로 읽지 못했으며 새 Supabase API/CLI 기능을 도입하지 않았다.

## ?? ?? ??

?? ?? ??? ?? ??? ?? ??? node_modules? ???? ???? ?? `blocked by policy`? ????. ???? ???? `C:/Users/Public/Documents/ESTsoft/CreatorTemp/trainer-access-settings-verify`? ?? ??. ?????? ???? ??? ?? ?? ??? ????. ?? ?? ?? ??/? writer? ??.

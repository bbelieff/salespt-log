# #947 주간 목표 — 정확한 0005 적용 검수 계약

상태: **검수용 구현 / 운영 실행 NOT_RUN / OG RELEASE 전 실행·머지·배포 금지**.
기존 `schema_migrations`를 사용하는 additive 전용 경로다. Supabase CLI 이력을 새로 만들지 않는다.

## 대상과 불변값

- SQL: `lib/repo/db/migrations/0005_weekly_goals.sql`
- 원문 UTF-8 bytes SHA256: `144b15924b59f0ebb757482540752154d48068207f9c905a51293986b2eb4831`
- 정확한 이력 키: `0005_weekly_goals.sql` **파일명 전체**. 중복 `0002_*.sql`을 숫자로 합치지 않는다.
- 적용 도구: `scripts/ops/weekly-goals-migrate.mjs`, 카탈로그 검사: `scripts/ops/weekly-goals-migrate-catalog.mjs`.
- 신규 두 테이블은 `student_id`(서버가 해석한 spreadsheetId) × cohort × course_start × week_start 키를 갖는다. 로그인 이메일 별칭을 영속 키로 사용하지 않는다.
- 이 SQL은 아직 적용되지 않은 신규 파일이다. 적용 후에는 원문을 고치지 않는다. 이미 다른 checksum으로 적용된 환경은 이 도구가 실패하며 자동 교정하지 않는다.

## 기존 경로를 그대로 dispatch하지 않는 이유

현재 `deploy.yml`은 `scripts/db-migrate.mjs`를 호출하지 않는다. `db-migrate.yml`은 VPS에 이미 설치된 코드만 실행하며, fetch/checkout 또는 정확한 버전 선택 기능이 없다. 기존 러너의 `--dry-run`도 `schema_migrations`를 생성한다. 미지원 `--only`/`--version`은 무시되므로 사용하지 않는다. 다른 pending에는 `0004`의 DROP INDEX도 있으므로 전체 pending을 적용하지 않는다.

새 CLI는 인자 없음 또는 `--preflight`만 읽기 전용, 정확히 `--execute` 하나만 쓰기 모드다. 알 수 없는 인자·중복·충돌 인자는 DB 연결 전 실패한다. 연결은 기존 `resolveDatabaseUrl()`이 env/보호된 `.env` 파일에서 내부적으로 얻는다. 연결 문자열을 셸 export·인자·로그·백업 명령으로 넘기지 않는다. driver 오류 원문도 출력하지 않는다.

## preflight — 실제 읽기 전용

첫 SQL은 `BEGIN READ ONLY`, 마지막은 `ROLLBACK`이다. `to_regclass`, pg_catalog, 존재하는 `public.schema_migrations`만 읽는다. CREATE/ALTER/INSERT/UPDATE/DELETE/학생 행 조회/이력 초기화/advisory lock은 수행하지 않는다.

검사 결과는 정확한 version/checksum, 관찰 시각, filename별 applied checksum/시각과 pending 목록, 목표 테이블 존재 여부 및 카탈로그 결과다. 다음을 차단한다.

- 승인 SQL bytes 변경 또는 이미 적용된 파일의 checksum 불일치.
- 이력 없이 목표 이름의 테이블/뷰/기타 relation이 하나라도 존재함.
- 이력은 있지만 목표 테이블 부재, 컬럼·타입·NULL·default·PK·CHECK·index 드리프트, 사용자 trigger/rule/inheritance. 이력 테이블의 RLS/정책으로 전체 이력이 보장되지 않는 경우도 거부한다.
- 목표 RLS 비활성, 정책 존재, PUBLIC/미확인 역할 ACL, 컬럼 ACL, anon/authenticated의 직접 또는 상속 실효 접근권.
- 현재 연결 역할에 필요한 SELECT/INSERT/UPDATE 권한 또는 RLS 우회/소유권이 없음.

`schema_migrations`가 없고 목표 테이블도 없으면 preflight는 아무것도 만들지 않고 이를 명시한다. 신규 적용 시에만 기존 러너와 같은 version/checksum/applied_at 형식으로 동일 트랜잭션 안에 이력 테이블을 생성한다. 기존 이력 테이블의 충돌 구조는 차단한다.

## 적용과 코드 노출 순서 — RELEASE 후에만

자동 master 배포가 기능을 먼저 노출하지 않도록 **머지 전**, 독립 검수된 최종 PR head에서 아래 운영 도구 artifact만 전달하고 적용한다. 현재 실행 앱 checkout/PM2/build를 바꾸지 않는다. artifact 전달은 기존 보호된 SSH/배포 경로만 사용하며, 새 원격접속·키·설정 변경은 하지 않는다.

1. OG가 최종 PR head SHA, 현재 last-good production SHA, 승인된 도구/SQL hash를 기록한다.
2. 최종 head의 아래 경로를 **디렉터리 구조를 보존한 채** VPS `/opt/salespt-log/.deploy/weekly-goals-<reviewed-head>/`에 일회용 artifact로 전달한다. 최종 PR head를 `git archive`로 추출할 수 있다. 설치된 앱 코드를 fetch/checkout/reset하지 않는다.
   - `scripts/db-migrate.mjs` — 기존 resolver와 filename loader 재사용, 실행 진입부는 import 시 실행되지 않음.
   - `scripts/ops/weekly-goals-migrate.mjs`
   - `scripts/ops/weekly-goals-migrate-catalog.mjs`
   - `lib/repo/db/migrations/` 전체 — **이력·pending 대조 입력만**. 적용 SQL은 내부 immutable checksum의 0005 하나.
3. `/opt/salespt-log`를 cwd로 유지한다. 기존 보호된 `.env`와 설치된 `node_modules/pg`를 사용한다. artifact 전송 bytes와 PR head를 대조한 뒤 다음 명령을 실행·보관한다. 아래 `<reviewed-head>`는 검수된 정확한 SHA로 치환한다.

```sh
node .deploy/weekly-goals-<reviewed-head>/scripts/ops/weekly-goals-migrate.mjs --preflight
```

4. pending 목록·이력·카탈로그가 계약과 일치하는지 검수한다. 예상치 못한 결과면 실패 증거를 남기고 중단한다. 자동으로 이력을 고치거나 누락 테이블을 기존 테이블에 합치지 않는다.
5. RELEASE 범위의 정확한 적용 명령은 다음이다. **현재 문서는 제안이며 실행 증거가 아니다.**

```sh
node .deploy/weekly-goals-<reviewed-head>/scripts/ops/weekly-goals-migrate.mjs --execute
node .deploy/weekly-goals-<reviewed-head>/scripts/ops/weekly-goals-migrate.mjs --preflight
```

`--execute`는 기존 러너와 동일 advisory lock **786569**를 획득하고, 트랜잭션 안에서 상태를 재검사한다. 0005 SQL + 정확한 filename/checksum 이력 삽입 + 적용 후 카탈로그 검증을 원자적으로 수행한다. 동일 checksum/정상 catalog면 DDL/DML 없이 `NO_OP`, 다른 checksum/충돌이면 rollback한다. 관련 없는 pending/history는 적용·수정하지 않는다. 글로벌 default privileges는 변경하지 않는다.

6. `APPLIED_EXACT_ONLY` 또는 검증된 `NO_OP`, version/checksum/appliedAt, 사후 `ALREADY_APPLIED`, 두 테이블의 RLS/policies/browserAccess/serverCanStore 결과, 관찰시각/운영 run 또는 보호된 실행 기록을 #947에 남긴 후에만 기능 코드의 직렬 머지·배포를 진행한다.
7. 정확한 merge SHA의 배포 run success/공개 health와 별도로 인증된 앱의 안전한 실제 조회 흐름을 검증한다. **`/api/health`는 auth env만 보며 목표 DB 준비를 증명하지 못한다.** 카탈로그 권한 검증은 실제 인증 저장 end-to-end 증명이 아니다. 실수강생 테스트 쓰기는 하지 않는다. 승인된 합성 테스트 대상이 없다면 실제 저장 검증을 NOT_RUN으로 분리한다.

## ACL/RLS와 복구

PUBLIC revoke만으로는 기존 Supabase의 직접 anon/authenticated 기본 grant가 사라지지 않는다. 신규 두 테이블에만 존재하는 browser role의 권한을 별도 revoke하고 RLS를 활성화한다. 정책은 만들지 않는다. 기존 서버 연결로 접근하며, 브라우저에 권한을 새로 부여하지 않는다. [공식 Data API 보안 문서](https://supabase.com/docs/guides/api/securing-your-api)의 grant/RLS 분리와 기존 프로젝트의 직접 기본 grant를 확인했다. 스킬의 Supabase CLI 신규 이력 절차는 사용자 지정 기존 custom migration 형식 대신 적용하지 않았다.

코드 롤백은 문제 기능 커밋 revert와 기존 배포 검증 경로를 따른다. **주간 목표 테이블·저장 데이터·마이그레이션 이력은 유지**한다. down/DROP/DELETE/cleanup SQL은 없다. DB 장애·접근권 문제는 사전 gate에서 중단하며 임의 grant/정책/키 교체로 우회하지 않는다.

## 합성 검증

`tests/ops/weekly-goals-migrate.test.ts`: 25 tests PASS (2026-09-11). 순수/연결 없는 테스트 10개와 일회용 PGlite 실제 PostgreSQL 테스트 15개. 외부 QA 도구가 없으면 후자만 명시 skip이며 운영/CI PASS로 합산하지 않는다. `npx tsc --noEmit --pretty false` exit0 및 소유 파일 `git diff --check` PASS.

```powershell
$env:QA_TOOLS_DIR='C:/Users/Public/Documents/ESTsoft/CreatorTemp/weekly-goals-qa-tools'
npx.cmd vitest run tests/ops/weekly-goals-migrate.test.ts
```

합성 검증: preflight 무변경, exact-only/다른 pending 보존, filename 이력/중복 번호, checksum fail/no-op/저장값 보존, unknown flags, untracked/conflicting table 거부, RLS/정책/PUBLIC/컬럼/constraint drift 차단, direct browser default grant 회수와 global defaults 보존, SQL+이력 실패 시 원자 rollback. 실제 외부 DB/SSH/워크플로/실수강생 데이터는 사용하지 않았다.

운영 적용·운영 catalog·실계정 저장·Notion 실제 붙여넣기: **NOT_RUN**. 본 문서는 독립 검수 판정이나 RELEASE가 아니다.

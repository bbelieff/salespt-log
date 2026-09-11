# #947 주간 목표 — 정확한 0005 적용·전달 검수 계약

상태: **현재 진단 head 운영 실행 NOT_RUN / 기존 OG preflight는 아래 실패 증거 참조 / 새 검수 전 실행·머지·배포 금지**.
기존 custom `schema_migrations` 이력을 유지한다. Supabase CLI 이력/새 자격증명/인프라 정책을 만들지 않는다.

## 승인된 이력 ACL 한정 회수와 앱 연결 비교 (새 delta 검수 전 HOLD)

Camus 승인:2026-09-11 11:23:41 KST, Slack C0BM0JCFM55/thread1788882607.566779/message1789093421.892039. OG run34553595400은 PUBLIC 권한 없음, anon/authenticated7권한, column ACL/기타 grantee 없음으로 보고했다. 승인 범위는 **public.schema_migrations에서 두 browser grantee 권한만 회수**하는 것이며 owner/service/server·이력 데이터·다른 table/role/default privilege/RLS는 보존한다. 재승인은 요구하지 않지만 이 구현 delta의 독립 검수/OG RELEASE 전 실행하지 않는다.

- 기존 exact workflow에 `repair_history_acl=false`, `compare_runtime=false` 기본값을 추가했다. installed 모드에서는 둘 다 false만 허용한다. exact 쓰기는 compare_runtime=true가 필요하며 repair_history_acl=true와 execute=true를 함께 지정하면 보호된 접속 전에 거절한다.
- 일반 preflight는 여전히 READ ONLY이며 자동 수리하지 않는다. repair 요청은 런타임 비교 → 한정 수리 → preflight, migration apply 요청은 런타임 비교 → preflight → exact0005 → postflight → 런타임 비교로 분리한다.
- 고정 수리 SQL은 `revoke all privileges on table public.schema_migrations from anon, authenticated restrict` 한 개다. BEGIN·lock/statement timeout·기존 advisory key786569 transaction lock·해당 이력 table exclusive lock 뒤 실행한다. CASCADE/일반 SQL 입력/다른 table/role 변경 없음.
- 수리 전 카탈로그가 승인된 범위인지 확인한다. PUBLIC/unknown/column ACL/RLS/예상 밖 구조는 수정하지 않고 실패한다. table grant가 이미 없으면 검증된 NO_OP이다. 상속 등으로 browser 실효 권한이 남으면 rollback한다.
- 이력 count와 digest는 DB aggregate로만 비교한다. 원행은 반환/출력하지 않는다. 두 browser를 제외한 ACL 및 owner/service/current server의 실효 권한 snapshot이 같아야 commit한다. 출력은 count, digestMatches, permissionsPreserved 등이며 실제 hash/이력 내용/역할명을 출력하지 않는다. 수리 전후 런타임 안정성 재확인 실패도 rollback한다.

### 실제 런타임 해석 범위

`pm2 jlist`는 host 내부 메모리로만 읽는다. 고정 salespt-log/online/cwd의 단일 프로세스 계통에서 :3000 listen socket을 실제 소유한 유일한 Next server PID를 선택한다. `/proc`의 초기 환경·시작 tick·cwd와 환경파일의 시각/내용 hash를 비공개로 확인한다. PM2/env/명령줄/URL/driver 오류는 로그로 내보내지 않는다.

설치된 `@next/env`를 별도 host-local child에서 사용하여 process env 우선 → .env.production.local → .env.local → .env.production → .env 및 expansion을 재현한다. URL 전달은 private IPC뿐이며 stdout/stderr는 전달하지 않는다. 이는 debugger로 JS 메모리를 읽는 것이 아니라 실제 시작 입력과 변경되지 않은 파일의 해석이다. 파일/root가 시작 이후 변경됐거나 startup preload/모드/프로세스가 모호하면 성공으로 추정하지 않고 중단한다. 실제 listener와 observer의 Node executable도 같아야 하며, 별도 PG* fallback 환경이 있으면 설정을 바꾸지 않고 거절한다.

artifact의 `runtime-contract.json`은 검수된 db/client.ts와 next.config.mjs의 hash만 담는다. 설치 소스가 다르거나 시작 이후 변경, build config의 DATABASE_URL 치환, Next env 구현 교체 시 중단한다. 실행 중 프로세스 지문과 migration resolver 값도 종료 전에 재확인한다.

앱 해석 URL과 기존 migration resolver(env 우선, .env.local>.env)를 비교한다. endpoint/database/options 및 설정 role이 같아야 두 연결의 READ ONLY DB/current/session role/server endpoint 관찰을 대조한다. 차이·불명확은 실패다. stdout에는 matching boolean과 고정3table의 존재/SELECT/INSERT/UPDATE/DELETE boolean만 낸다. 연결문자열·비밀번호·임의 DB/role명·학생 행 조회 없음. 이 비교는 인증된 앱 저장 E2E의 대체가 아니다.

모든 새 host 관찰/수리/DB apply/배포는 아직 NOT_RUN. 합성 PostgreSQL 및 로컬 Next env 재현만 수행하며 최종 검증 수치와 immutable head/manifest는 #947 체크포인트를 따른다. 코드 수리 없이 런타임이 지원 범위 밖이면 그 관찰을 OG에 반환하며 설정을 자동 변경하지 않는다.

## OG read-only 관찰과 제한된 실패 진단

OG가 실행한 [run34552514192](https://github.com/bbelieff/salespt-log/actions/runs/34552514192)는 a82f056 artifact/보호된 SSH 검증 후 `UNSAFE_HISTORY_SECURITY`로 exit1했다. 이 writer는 해당 run을 재실행하지 않았다. 목표 migration/머지/배포는 없으며 마지막 정상 앱5790609는 유지된다. 아래 새 진단 helper는 아직 운영 실행하지 않았다.

거부 조건·비0 종료·rollback은 바꾸지 않는다. 거부된 이력의 데이터 SELECT 전, 같은 READ ONLY transaction에서 카탈로그 CTE만 추가 조회한다. CLI stderr JSON은 고정 error 코드 및 `public.schema_migrations`의 allowlist 필드만 출력한다:

- RLS/force RLS/policy 수, 기존 unexpected ACL/column ACL 여부.
- PUBLIC/anon/authenticated 존재 여부와 SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER별 boolean. PUBLIC은 직접 grant, 두 browser 역할은 상속/PUBLIC 포함 실효 권한이다.
- `columnGrants`는 해당 grantee의 직접 column ACL 존재다. `effectiveColumnAccess`는 browser의 table grant까지 포함한 column 접근 여부이므로, true만으로 column grant가 있다고 해석하지 않는다. PUBLIC 항목은 직접 column grant 여부다.
- `unknownGrantees`는 owner/service_role/PUBLIC/두 browser 역할을 제외한 grantee의 table/column/합집합 수만 표시한다. category는 고정이며 임의 role/account명·OID를 출력하지 않는다. 수가0보다 크다는 사실을 악의적 권한으로 단정하지 않는다.
- 현재 server의 owner/superuser/role bypass/effective RLS bypass와 권한별 boolean만 표시한다. 연결 대상 비교나 실제 app 저장 검증은 별도 남은 인수 조건이다.

추가 진단 조회 실패는 원래 거부를 유지하며 `available:false`/미확인 값 null로 보고한다. 임의 driver message/stack/cause/연결문자열/환경/이력 값은 출력하지 않는다. 출력 직전에 필드를 다시 투영한다. 기존 ACL/role/schema 교정이나 gate 완화는 없다. 정확한 원인은 새 head 검수 후 OG의 별도 read-only 관찰까지 미확인이다.

## immutable 대상

- SQL: `lib/repo/db/migrations/0005_weekly_goals.sql`
- UTF-8 bytes SHA256: `144b15924b59f0ebb757482540752154d48068207f9c905a51293986b2eb4831`
- 이력 키: `0005_weekly_goals.sql` **전체 파일명**. 중복 `0002_*.sql`도 별개다.
- 도구: `scripts/ops/weekly-goals-migrate.mjs`; 검사: `weekly-goals-migrate-catalog.mjs`.
- 키는 서버 해석 student_id(spreadsheetId) × cohort × course_start × week_start다. 로그인 이메일 별칭을 영속 키로 쓰지 않는다.
- 아직 적용되지 않은 SQL이다. 적용 후에는 immutable이며 다른 checksum 환경을 자동 교정하지 않는다.

## broad runner와 분리

`deploy.yml`은 migration을 실행하지 않는다. `db-migrate.yml` 기존 `installed` 모드는 설치된 VPS 코드의 broad pending runner이며 **master에서만** 허용한다. feature-ref는 exact mode만 허용한다. 누락/unknown mode가 broad 실행으로 떨어지지 않는다. 기존 `--dry-run`도 이력 테이블을 생성하므로 진짜 read-only가 아니다. 미지원 `--only`/`--version`은 사용하지 않는다. 다른 pending의 `0004` DROP INDEX를 실행하지 않는다.

## 진짜 read-only와 안전 gate

첫 SQL `BEGIN READ ONLY` → 트랜잭션 한정 timeout 설정 → `to_regclass`/pg_catalog/존재하는 history 조회 → `ROLLBACK`. CREATE/ALTER/INSERT/학생 행 조회/이력 초기화/advisory lock이 없다. 다음은 실패하며 변경하지 않는다.

- 승인 SQL bytes/적용된 파일 checksum 불일치.
- 이력 없이 목표 relation 존재, 적용 이력은 있지만 목표 테이블 부재.
- 컬럼·타입·NULL·default·PK·CHECK·index·trigger/rule/inheritance 충돌.
- 목표 RLS 비활성/정책 존재/PUBLIC·미확인 ACL/컬럼 ACL/anon·authenticated 실효 접근.
- 이력 RLS/정책으로 전체 이력 조회 불가, 이력 PUBLIC·browser·미확인 ACL.
- 서버 연결의 필요한 권한/RLS 우회·소유권 부족.

기존 history ACL이 안전하지 않으면 **읽기 전용 실패 증거만 보고**한다. 기존 보안 정책 변경은 OG/사용자 판단이며 자동 revoke/grant하지 않는다. history 부재 preflight는 생성하지 않는다. exact execute에서 새로 만드는 history만 같은 transaction에서 PUBLIC/anon/authenticated 직접 grants를 회수한다. global default privileges는 유지한다.

## 보호된 feature-ref delivery — RELEASE 후에만

OG는 최종 검수한 PR full SHA, last-good production SHA, SQL/helper checksum을 기록한다. 아래 `<reviewed-full-head-sha>`는 그 **40자리 소문자 SHA**로 치환한다. 명령은 제안이며 dispatch NOT_RUN이다.

```sh
gh workflow run db-migrate.yml --repo bbelieff/salespt-log --ref feat/weekly-goals -f mode=0005_weekly_goals.sql -f expected_sha=<reviewed-full-head-sha> -f expected_sql_sha256=144b15924b59f0ebb757482540752154d48068207f9c905a51293986b2eb4831 -f execute=false
```

1. SSH/Tailscale/키 사용 **전** `github.sha == expected_sha`와 SQL checksum/mode/run id를 검증한다. checkout은 immutable SHA와 `persist-credentials:false`다. [공식 gh 문서](https://cli.github.com/manual/gh_workflow_run)의 `--ref`는 지정 branch workflow를 실행한다. branch가 움직이면 old expected SHA는 실패한다.
2. `weekly-goals-delivery.mjs`는 다음 allowlist만 보낸다. `scripts/db-migrate.mjs`(resolver만 import), `scripts/ops/weekly-goals-migrate.mjs`, `weekly-goals-migrate-catalog.mjs`, `weekly-goals-delivery.mjs`, `weekly-goals-delivery-run.mjs`, `weekly-goals-history-repair.mjs`, `weekly-goals-runtime.mjs`, 정확한 `lib/repo/db/migrations/0005_weekly_goals.sql`, `inventory.json`(전체 migration **파일명/checksum만**), `runtime-contract.json`(앱 resolver/config 소스 checksum만), `manifest.json`(reviewed SHA/SQL checksum/모든 payload file SHA256). 다른 SQL bytes는 보내지 않는다.
3. 기존 SSH/Tailscale/host fallback/`accept-new` 경로로 앱 밖 `/opt/salespt-migrations/<run-id>-<attempt>-<sha>/payload`에 stage한다. archive hash를 먼저 검증한 뒤 extract하고 파일명/regular-file/no-symlink/checksum 검사 후에만 `ARTIFACT_READY`를 기록한다. 앱 checkout/npm/build/PM2/env 파일은 변경·복사하지 않는다.
4. 매 실행 payload를 재검증한다. cwd `/opt/salespt-log`, 기존 protected env resolver, `createRequire('/opt/salespt-log/package.json')('pg')`를 사용한다. 자격증명을 인자/export/log로 전달하지 않는다. workflow concurrency `db-migrate`와30분 job 한도, SSH rc255만 최대15회 재시도한다. DB/application 오류는 즉시 실패한다.
5. preflight pending/history/catalog를 검수한다. 예상 밖 보안/구조/이력은 변경 없이 중단한다. 허용된 적용 dispatch는 동일 최종 SHA로 다음 명령이며 preflight → exact execute → 사후 preflight 순이다.

```sh
gh workflow run db-migrate.yml --repo bbelieff/salespt-log --ref feat/weekly-goals -f mode=0005_weekly_goals.sql -f expected_sha=<reviewed-full-head-sha> -f expected_sql_sha256=144b15924b59f0ebb757482540752154d48068207f9c905a51293986b2eb4831 -f compare_runtime=true -f repair_history_acl=false -f execute=true
```

감사용 원격 형태(직접 실행 권고 아님): cwd `/opt/salespt-log`에서 `node /opt/salespt-migrations/<run>-<attempt>-<sha>/payload/scripts/ops/weekly-goals-delivery-run.mjs preflight|execute <sha> <manifest-sha256> <sql-sha256>`.

manifest/inventory/helper hashes는 Actions artifact와 stdout에 보존한다. 성공 DB 결과는 stage의 `preflight-result.json`/`execute-result.json`에 남는다. 최종 commit 전 artifact checksum을 최종 SHA의 것으로 주장하지 않는다. 부분 업로드·실패 stage는 앱 tree 밖에 남고 실행 증거로 취급하지 않는다.

## 적용·노출·복구 순서

`--execute`는 BEGIN과 timeout 설정 **후** 기존 advisory lock **786569**를 획득한다. connection15초/lock10초/statement60초/client query65초로 대기 상한을 둔다. 같은 transaction에서 상태 재검사 → exact SQL → filename/checksum 이력 → 사후 catalog → commit. 동일 hash/정상 catalog는 `NO_OP`, 충돌은 rollback. 관련 없는 pending/history를 적용·수정하지 않는다.

`APPLIED_EXACT_ONLY` 또는 검증된 `NO_OP`, 사후 `ALREADY_APPLIED`, version/checksum/appliedAt/RLS/policies/browserAccess/serverCanStore/관찰시각/run 결과를 #947에 기록한 **뒤에** 기능을 직렬 머지·배포한다. 기능이 먼저 노출되지 않도록 merge 전 feature-ref artifact로 적용한다.

정확한 merge SHA 배포 run success/health와 인증된 안전한 조회 흐름은 별개다. `/api/health`는 auth env만 검사하며 goal DB 준비를 증명하지 않는다. catalog는 실제 인증 저장 E2E 증거가 아니다. 실수강생 테스트 쓰기를 하지 않으며 승인된 합성 운영 대상이 없으면 실제 저장 검증 NOT_RUN을 유지한다.

코드 rollback은 feature revert와 기존 배포 절차다. **테이블·저장 데이터·이력은 유지**하며 down/DROP/DELETE/cleanup SQL이 없다. PUBLIC revoke만으로 직접 anon/authenticated grants가 사라지지는 않는다([공식 Data API 보안 문서](https://supabase.com/docs/guides/api/securing-your-api)). 새 테이블 직접 grants만 회수하고 RLS를 켜며 정책은 만들지 않는다.

## 합성 검증 및 미실행

이번 ops 진단 패치: migration36 + client2 + delivery17 + diagnostics5 =60 tests. 신규9건은 일회용 PostgreSQL 실제 ACL 구분4건과 전달 CLI 실패/비밀값 비출력5건이다. 새 테스트의 mock 출력 인덱스 타입 오류는 optional 접근으로 교정했고 타입 검사 자체는 변경하지 않았다. 전체 게이트/CI 최종 결과와 정확한 head는 #947 체크포인트에 남긴다. 앱/UI 소스 불변이므로 이번 Next build·브라우저는 재실행하지 않으며, 이전 a82f056의 build/브라우저28 증거와 구별한다.

- `tests/ops/weekly-goals-migrate.test.ts`32 + `weekly-goals-migrate-client.test.ts`2: 총34 PASS = pure/synthetic client16 + disposable PGlite18 (migration helper evidence,2026-09-11). QA 도구 미설정 시 PGlite만 skip; CI/운영 PASS로 합산하지 않는다.
- `tests/ops/weekly-goals-delivery.test.ts`:17 PASS = strict inputs/immutable inventory+hash/missing-extra-tampered files/fresh output/workflow ordering/transport retry contract. 일회용 로컬 합성 파일만 사용한다.

```powershell
$env:QA_TOOLS_DIR='C:/Users/Public/Documents/ESTsoft/CreatorTemp/weekly-goals-qa-tools'
npx.cmd vitest run tests/ops/weekly-goals-migrate.test.ts tests/ops/weekly-goals-migrate-client.test.ts tests/ops/weekly-goals-delivery.test.ts
```

위34건은 a82f056 이전 증거다. 현재 migration36건 중22건은 일회용 PostgreSQL이며 CI에서 해당 도구가 없으면 명시 skip된다. 나머지38건은 CI에서도 실행 가능한 ops 검사다.

이 writer의 새 운영 SSH/dispatch/진단 DB preflight·적용/실계정 저장/Notion 실제 붙여넣기: **NOT_RUN**. OG가 수행한 이전 run34552514192 실패와 혼동하지 않는다. KPI/Notion/Kakao 변경 없음. 독립 검수 판정이나 RELEASE가 아니다.

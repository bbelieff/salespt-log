# #947 주간 목표 — 정확한 0005 적용·전달 검수 계약

상태: **검수용 구현 / 운영 실행 NOT_RUN / OG RELEASE 전 실행·머지·배포 금지**.
기존 custom `schema_migrations` 이력을 유지한다. Supabase CLI 이력/새 자격증명/인프라 정책을 만들지 않는다.

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
2. `weekly-goals-delivery.mjs`는 다음 allowlist만 보낸다. `scripts/db-migrate.mjs`(resolver만 import), `scripts/ops/weekly-goals-migrate.mjs`, `weekly-goals-migrate-catalog.mjs`, `weekly-goals-delivery.mjs`, `weekly-goals-delivery-run.mjs`, 정확한 `lib/repo/db/migrations/0005_weekly_goals.sql`, `inventory.json`(전체 migration **파일명/checksum만**), `manifest.json`(reviewed SHA/SQL checksum/모든 payload file SHA256). 다른 SQL bytes는 보내지 않는다.
3. 기존 SSH/Tailscale/host fallback/`accept-new` 경로로 앱 밖 `/opt/salespt-migrations/<run-id>-<attempt>-<sha>/payload`에 stage한다. archive hash를 먼저 검증한 뒤 extract하고 파일명/regular-file/no-symlink/checksum 검사 후에만 `ARTIFACT_READY`를 기록한다. 앱 checkout/npm/build/PM2/env 파일은 변경·복사하지 않는다.
4. 매 실행 payload를 재검증한다. cwd `/opt/salespt-log`, 기존 protected env resolver, `createRequire('/opt/salespt-log/package.json')('pg')`를 사용한다. 자격증명을 인자/export/log로 전달하지 않는다. workflow concurrency `db-migrate`와30분 job 한도, SSH rc255만 최대15회 재시도한다. DB/application 오류는 즉시 실패한다.
5. preflight pending/history/catalog를 검수한다. 예상 밖 보안/구조/이력은 변경 없이 중단한다. 허용된 적용 dispatch는 동일 최종 SHA로 다음 명령이며 preflight → exact execute → 사후 preflight 순이다.

```sh
gh workflow run db-migrate.yml --repo bbelieff/salespt-log --ref feat/weekly-goals -f mode=0005_weekly_goals.sql -f expected_sha=<reviewed-full-head-sha> -f expected_sql_sha256=144b15924b59f0ebb757482540752154d48068207f9c905a51293986b2eb4831 -f execute=true
```

감사용 원격 형태(직접 실행 권고 아님): cwd `/opt/salespt-log`에서 `node /opt/salespt-migrations/<run>-<attempt>-<sha>/payload/scripts/ops/weekly-goals-delivery-run.mjs preflight|execute <sha> <manifest-sha256> <sql-sha256>`.

manifest/inventory/helper hashes는 Actions artifact와 stdout에 보존한다. 성공 DB 결과는 stage의 `preflight-result.json`/`execute-result.json`에 남는다. 최종 commit 전 artifact checksum을 최종 SHA의 것으로 주장하지 않는다. 부분 업로드·실패 stage는 앱 tree 밖에 남고 실행 증거로 취급하지 않는다.

## 적용·노출·복구 순서

`--execute`는 BEGIN과 timeout 설정 **후** 기존 advisory lock **786569**를 획득한다. connection15초/lock10초/statement60초/client query65초로 대기 상한을 둔다. 같은 transaction에서 상태 재검사 → exact SQL → filename/checksum 이력 → 사후 catalog → commit. 동일 hash/정상 catalog는 `NO_OP`, 충돌은 rollback. 관련 없는 pending/history를 적용·수정하지 않는다.

`APPLIED_EXACT_ONLY` 또는 검증된 `NO_OP`, 사후 `ALREADY_APPLIED`, version/checksum/appliedAt/RLS/policies/browserAccess/serverCanStore/관찰시각/run 결과를 #947에 기록한 **뒤에** 기능을 직렬 머지·배포한다. 기능이 먼저 노출되지 않도록 merge 전 feature-ref artifact로 적용한다.

정확한 merge SHA 배포 run success/health와 인증된 안전한 조회 흐름은 별개다. `/api/health`는 auth env만 검사하며 goal DB 준비를 증명하지 않는다. catalog는 실제 인증 저장 E2E 증거가 아니다. 실수강생 테스트 쓰기를 하지 않으며 승인된 합성 운영 대상이 없으면 실제 저장 검증 NOT_RUN을 유지한다.

코드 rollback은 feature revert와 기존 배포 절차다. **테이블·저장 데이터·이력은 유지**하며 down/DROP/DELETE/cleanup SQL이 없다. PUBLIC revoke만으로 직접 anon/authenticated grants가 사라지지는 않는다([공식 Data API 보안 문서](https://supabase.com/docs/guides/api/securing-your-api)). 새 테이블 직접 grants만 회수하고 RLS를 켜며 정책은 만들지 않는다.

## 합성 검증 및 미실행

- `tests/ops/weekly-goals-migrate.test.ts`32 + `weekly-goals-migrate-client.test.ts`2: 총34 PASS = pure/synthetic client16 + disposable PGlite18 (migration helper evidence,2026-09-11). QA 도구 미설정 시 PGlite만 skip; CI/운영 PASS로 합산하지 않는다.
- `tests/ops/weekly-goals-delivery.test.ts`:17 PASS = strict inputs/immutable inventory+hash/missing-extra-tampered files/fresh output/workflow ordering/transport retry contract. 일회용 로컬 합성 파일만 사용한다.

```powershell
$env:QA_TOOLS_DIR='C:/Users/Public/Documents/ESTsoft/CreatorTemp/weekly-goals-qa-tools'
npx.cmd vitest run tests/ops/weekly-goals-migrate.test.ts tests/ops/weekly-goals-migrate-client.test.ts tests/ops/weekly-goals-delivery.test.ts
```

운영 SSH/dispatch/DB preflight·적용/catalog/실계정 저장/Notion 실제 붙여넣기: **NOT_RUN**. KPI/Notion/Kakao 변경 없음. 독립 검수 판정이나 RELEASE가 아니다.

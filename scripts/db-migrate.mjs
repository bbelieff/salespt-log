#!/usr/bin/env node
/**
 * db/migrations/*.sql 를 순서대로 적용하는 범용 마이그레이션 러너 (BBE-54, R7 Phase 1).
 *
 * lib/repo/db/client.ts 의 "CREATE TABLE IF NOT EXISTS 지연생성" 방식은 컬럼 추가까지만
 * 안전하다(파괴적 변경·백필+제약 강화는 표현 불가, 실행 이력이 안 남는다). 이 러너가 그 갭을
 * 메운다 — 앞으로 모든 스키마 변경은 이 위에 번호 파일(lib/repo/db/migrations/NNNN_*.sql)로 얹는다.
 * lib/repo/db/expense-ledger.ts 의 expense_schema_migrations(자체 추적 테이블)가 이미 이 패턴이
 * 이 레포에서 동작함을 증명했다 — 그 교훈을 도메인마다 재발명하지 않도록 일반화한 버전.
 *
 * 사용: DATABASE_URL=... node scripts/db-migrate.mjs [--dry-run]
 * 동시 실행 안전: pg_advisory_lock(고정 키)으로 배포 인스턴스가 여러 개 겹쳐 돌아도 직렬화.
 * 체크섬 보호: 이미 적용된 마이그레이션 파일이 이후 수정되면 즉시 실패 — ADR 불변 원칙과 같은
 *   이유로, 적용된 마이그레이션은 사실상 불변으로 취급한다. 변경이 필요하면 새 번호 파일을 추가한다.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/repo/db/migrations",
);

// 이 러너 전용 고정 advisory lock 키(임의 값 — 다른 용도와 충돌만 피하면 됨).
const ADVISORY_LOCK_KEY = 786569;

/** .sql 파일 이름순 로드 + 체크섬. 디렉토리가 없으면 빈 배열(첫 실행 전 상태도 안전). */
export async function loadMigrationFiles(dir = MIGRATIONS_DIR) {
  let names;
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  } catch (e) {
    if (e && e.code === "ENOENT") return [];
    throw e;
  }
  const out = [];
  for (const name of names) {
    const sql = await readFile(join(dir, name), "utf8");
    out.push({ version: name, sql, checksum: createHash("sha256").update(sql).digest("hex") });
  }
  return out;
}

/**
 * 순수 함수 — 어떤 마이그레이션이 대기 중인지 계산. DB 연결 없이 단위 테스트 가능.
 * 이미 적용된 파일의 체크섬이 안 맞으면 throw(적용후 수정 감지 — 조용한 드리프트 금지).
 */
export function computePending(files, appliedRows) {
  const applied = new Map(appliedRows.map((r) => [r.version, r.checksum]));
  const pending = [];
  for (const f of files) {
    const appliedChecksum = applied.get(f.version);
    if (appliedChecksum === undefined) {
      pending.push(f);
      continue;
    }
    if (appliedChecksum !== f.checksum) {
      throw new Error(
        `[db-migrate] 이미 적용된 마이그레이션이 수정됨: ${f.version} — 체크섬 불일치. ` +
          `적용된 마이그레이션은 사실상 불변으로 취급한다. 변경이 필요하면 새 번호 파일을 추가해라.`,
      );
    }
  }
  return pending;
}

async function run({ dryRun }) {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("[db-migrate] DATABASE_URL 미설정");
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // client.ts 와 동일 패턴(Supabase Session Pooler)
  });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`);
    const files = await loadMigrationFiles();
    const { rows: appliedRows } = await client.query(
      "select version, checksum from schema_migrations",
    );
    const pending = computePending(files, appliedRows);

    if (pending.length === 0) {
      console.log(`[db-migrate] 적용할 마이그레이션 없음(전체 ${files.length}건 이미 최신)`);
      return;
    }
    console.log(`[db-migrate] 대기 중: ${pending.map((p) => p.version).join(", ")}`);
    if (dryRun) {
      console.log("[db-migrate] --dry-run — 실행 안 함");
      return;
    }

    for (const f of pending) {
      await client.query("begin");
      try {
        await client.query(f.sql);
        await client.query(
          "insert into schema_migrations (version, checksum) values ($1, $2)",
          [f.version, f.checksum],
        );
        await client.query("commit");
        console.log(`[db-migrate] ✅ 적용 완료: ${f.version}`);
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw new Error(
          `[db-migrate] ❌ 실패: ${f.version} — ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  } finally {
    // 둘 다 정리(cleanup) 목적 — 이미 발생한 마이그레이션 에러를 정리 단계 실패로 덮어쓰지 않는다.
    await client.query("select pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    await client.end().catch(() => {});
  }
}

// 직접 실행될 때만 동작(임포트 시에는 top-level 부작용 없음 — 단위 테스트가 안전하게 import 가능).
// 문자열 비교 대신 경로 비교 — Windows 에서 file:// URL 과 process.argv[1] 의 슬래시/인코딩이
// 달라 문자열 비교가 항상 거짓이 되는 함정을 피한다.
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  run({ dryRun: process.argv.includes("--dry-run") }).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

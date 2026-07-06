/**
 * Supabase keep-alive — SELECT 1 (db-migration-pilot §0 대응①).
 * 무료 티어 7일 무요청 일시정지 방지. GitHub Actions 크론(db-keepalive.yml, 주 1회)이
 * 실행. 성공 로그가 곧 DATABASE_URL(주소·비밀번호 인코딩 포함) 유효성 실증.
 * ★URL·비밀번호는 로그에 출력하지 않는다.
 */
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("db-keepalive: DATABASE_URL 미설정 — skip");
  process.exit(0);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  max: 1,
});

const t0 = Date.now();
try {
  const res = await pool.query("select 1 as ok");
  console.log(
    `db-keepalive: SELECT 1 OK (${Date.now() - t0}ms, result=${res.rows[0]?.ok}) — Supabase 일시정지 방지 완료`,
  );
  process.exit(0);
} catch (e) {
  const msg = (e instanceof Error ? e.message : String(e)).replace(
    /postgres(ql)?:\/\/\S+/gi,
    "[DATABASE_URL]",
  );
  console.error(`db-keepalive: 실패 — ${msg}`);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}

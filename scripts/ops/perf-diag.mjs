#!/usr/bin/env node
/**
 * BBE-242 전용 — 읽기 전용 속도 진단. 실데이터 변경 0, DB 쓰기 0(SELECT/EXPLAIN 만).
 * VPS 자원(uptime·메모리·PM2 프로세스 상태)과 DB 쿼리 실측(EXPLAIN ANALYZE·인덱스 사용량)을
 * 한 run 에 모아 belie "다른 요인" 의심을 수치로 검증한다.
 *
 * 실행(VPS, 읽기 전용): node scripts/ops/perf-diag.mjs
 * 비밀값(연결 문자열 등) 절대 미출력 — 에러 메시지도 마스킹.
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { Pool } from "pg";

function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";
const DB_URL = env("DATABASE_URL");

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 10_000 }).trim();
  } catch (e) {
    return `(실패: ${String(e?.message ?? e).slice(0, 200)})`;
  }
}

function vpsStats() {
  console.log("\n=== VPS 자원 ===");
  console.log(`uptime/loadavg: ${sh("uptime")}`);
  console.log(`메모리:\n${sh("free -h")}`);
  console.log(`디스크(앱 볼륨):\n${sh("df -h / 2>/dev/null | tail -2")}`);
  const pm2 = sh(
    "pm2 jlist 2>/dev/null | node -e \"let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);for(const p of j){console.log(`${p.name}: pid=${p.pid} status=${p.pm2_env.status} restarts=${p.pm2_env.restart_time} uptime_ms=${Date.now()-p.pm2_env.pm_uptime} mem_mb=${Math.round(p.monit.memory/1048576)} cpu_pct=${p.monit.cpu}`)}}catch(e){console.log('(pm2 jlist 파싱 실패)')}})\"",
  );
  console.log(`PM2 프로세스:\n${pm2 || "(pm2 없음/미실행)"}`);
  console.log(`Node 버전: ${sh("node -v")}`);
}

async function dbStats(pool) {
  console.log("\n=== DB 통계 ===");
  const size = await pool.query(
    `select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) as total_size
     from pg_stat_user_tables where relname in ('sheet_rows','users','cohorts','gcal_event_ids','gcal_tokens')
     order by n_live_tup desc`,
  );
  console.log("테이블 행수·크기:");
  for (const r of size.rows) console.log(`  ${r.relname}: ${r.n_live_tup}행, ${r.total_size}`);

  const idx = await pool.query(
    `select indexrelname, idx_scan, idx_tup_read, pg_size_pretty(pg_relation_size(indexrelid)) as idx_size
     from pg_stat_user_indexes where relname = 'sheet_rows' order by indexrelname`,
  );
  console.log("\nsheet_rows 인덱스 사용량(idx_scan=0 이면 그 인덱스는 read 에서 한 번도 안 쓰였다 — 쓰기 비용만 유발):");
  for (const r of idx.rows) console.log(`  ${r.indexrelname}: idx_scan=${r.idx_scan}, idx_tup_read=${r.idx_tup_read}, size=${r.idx_size}`);

  const conns = await pool.query(
    `select count(*) as n, state from pg_stat_activity where datname = current_database() group by state`,
  );
  console.log("\n현재 커넥션(state별):");
  for (const r of conns.rows) console.log(`  ${r.state ?? "(null)"}: ${r.n}`);
}

async function pickSampleSpreadsheetId(pool) {
  const r = await pool.query(
    `select spreadsheet_id from sheet_rows where tab = 'meetings' group by spreadsheet_id order by count(*) desc limit 1`,
  );
  return r.rows[0]?.spreadsheet_id ?? null;
}

async function explainQueries(pool) {
  console.log("\n=== 대표 쿼리 EXPLAIN ANALYZE (실제 실행시간, ms) ===");
  const sid = await pickSampleSpreadsheetId(pool);
  if (!sid) {
    console.log("(sheet_rows 에 meetings 표본이 없어 EXPLAIN 스킵)");
    return;
  }
  const queries = [
    {
      label: "readMeetingsFromDb (04 미팅 목록, lib/repo/db/read-daily.ts)",
      sql: `explain (analyze, buffers, format text)
            select payload from sheet_rows
            where spreadsheet_id = $1 and tab = 'meetings'
              and coalesce((payload->>'_cleared')::boolean, false) = false`,
      params: [sid],
    },
    {
      label: "sheet_rows sales 전체 (01 영업관리, cohort+tab 인덱스 경로)",
      sql: `explain (analyze, buffers, format text)
            select payload from sheet_rows where spreadsheet_id = $1 and tab = 'sales'`,
      params: [sid],
    },
    {
      label: "registry users (BBE-56 게이트 ON 후 세션 조회 경로, lib/repo/db/registry-read.ts)",
      sql: `explain (analyze, buffers, format text)
            select email, cohort, name, spreadsheet_id, role, status, assigned_trainer, team,
                   cohort_label, name_label, course_start_iso, graduation_iso, sort_order,
                   drive_parent_path, feedback_folder_id, drive_link_status, memo, captain_of,
                   gcal_token, gcal_settings
            from users`,
      params: [],
    },
  ];
  for (const q of queries) {
    console.log(`\n--- ${q.label} ---`);
    try {
      const res = await pool.query(q.sql, q.params);
      const plan = res.rows.map((r) => Object.values(r)[0]).join("\n");
      console.log(plan);
    } catch (e) {
      console.log(`(실패: ${String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")})`);
    }
  }
}

async function main() {
  vpsStats();
  if (!DB_URL) {
    console.log("\n(DATABASE_URL 미설정 — DB 섹션 스킵)");
    return;
  }
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  try {
    await dbStats(pool);
    await explainQueries(pool);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error(`perf-diag 실패: ${msg}`);
  process.exitCode = 1;
});

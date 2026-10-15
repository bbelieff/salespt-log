#!/usr/bin/env node
/**
 * masked-snapshot — 운영 DB 를 **읽기만** 해서 "가짜로 바꾼 사본"을 VPS 의 /tmp 에 파일로 만든다.
 * 원본 값은 이 프로세스 밖으로 나가지 않는다(가리기는 메모리 안에서, 파일엔 가린 값만).
 *
 * 목적: 화석 코드 정비의 연습장(샌드박스) — 저장 구조 변경(행 키·payload 모양)을 실제 데이터 "모양"
 * 그대로 시험(belie 2026-10-15 승인). 규칙 = scripts/ops/mask-snapshot-core.mjs(테스트로 고정).
 *
 * 실행(VPS, 읽기 전용 — DB 쓰기 0, SELECT 만): node scripts/ops/masked-snapshot.mjs
 *   → /tmp/salespt-masked-<시각>.ndjson.gz (권한 600). 이 PC 로 옮긴 뒤 VPS 쪽 파일은 지운다.
 * 출력: 표별 행 수, 운영 설정 스위치 몇 개의 켜짐 여부(값 자체는 비밀이 아닌 "1"/미설정만), 파일 경로.
 * 비밀값(연결 문자열 등)은 출력하지 않는다. 원본 흔적 검사(assertNoPii)에 걸리면 파일을 지우고 실패.
 */
import { createWriteStream, existsSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createGzip } from "node:zlib";
import { once } from "node:events";
import { Pool } from "pg";
import { DROP_ROW_TABLES, assertNoPii, makeMasker, piiPaths } from "./mask-snapshot-core.mjs";

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

const SWITCHES = ["COURSE_DATE_DB_READ", "COURSE_DATE_DB_WRITE", "DASHBOARD_SHADOW_COMPARE", "DB_MIGRATION_FREEZE"];
const BATCH = 2000;

async function main() {
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL 없음");
  console.log("=== 운영 설정 스위치(값은 '1'/미설정/기타만) ===");
  for (const k of SWITCHES) {
    const v = env(k);
    console.log(`  ${k}: ${v === "" ? "미설정" : v === "1" ? "1" : "기타 값"}`);
  }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
  const masker = makeMasker(randomBytes(24).toString("hex"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const path = `/tmp/salespt-masked-${stamp}.ndjson.gz`;
  const gz = createGzip();
  const file = createWriteStream(path, { mode: 0o600 });
  gz.pipe(file);
  const write = async (obj) => {
    const line = JSON.stringify(obj);
    assertNoPii(line);
    if (!gz.write(line + "\n")) await once(gz, "drain");
  };

  // 한 연결 안에서 읽기 전용 스냅숏 트랜잭션 — 모든 표를 같은 시점으로 읽는다.
  const db = await pool.connect();
  try {
    await db.query("begin transaction isolation level repeatable read read only");
    const tables = (await db.query(
      `select table_name from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE' order by table_name`,
    )).rows.map((r) => r.table_name);
    const schema = [];
    for (const t of tables) {
      const cols = (await db.query(
        `select column_name, data_type, udt_name from information_schema.columns
         where table_schema='public' and table_name=$1 order by ordinal_position`, [t],
      )).rows;
      schema.push({ name: t, columns: cols.map((c) => ({ name: c.column_name, type: c.udt_name || c.data_type })) });
    }
    await write({ kind: "schema", tables: schema });

    console.log("=== 표별 행 수 (가짜 사본에 담긴 수) ===");
    for (const t of tables) {
      const total = Number((await db.query(`select count(*)::bigint as n from "${t}"`)).rows[0].n);
      if (DROP_ROW_TABLES.has(t)) { console.log(`  ${t}: ${total} (비밀 표 — 행 제외)`); continue; }
      let done = 0;
      for (let off = 0; off < total; off += BATCH) {
        const rows = (await db.query(`select * from "${t}" order by ctid limit ${BATCH} offset ${off}`)).rows;
        for (const r of rows) {
          const masked = masker.maskRow(r);
          try {
            await write({ kind: "row", t, r: masked });
          } catch (e) {
            // 값은 내보내지 않고 위치(표·경로)만 알린다 — 규칙 보완용.
            const where = [...new Set(piiPaths(masked))].slice(0, 5).join(", ");
            throw new Error(`${e instanceof Error ? e.message : e} (표 ${t}, 위치 ${where || "알 수 없음"})`);
          }
        }
        done += rows.length;
      }
      console.log(`  ${t}: ${done}`);
    }
    await db.query("rollback");
    gz.end();
    await once(file, "finish");
    chmodSync(path, 0o600);
    console.log(`=== 완료 — 파일: ${path} (원본 흔적 검사 통과) ===`);
  } catch (e) {
    gz.destroy();
    file.destroy();
    try { rmSync(path, { force: true }); } catch {}
    throw e;
  } finally {
    db.release();
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  const msg = String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "postgres://***");
  console.error(`❌ 실패: ${msg}`);
  process.exit(1);
});

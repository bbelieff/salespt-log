#!/usr/bin/env node
/**
 * sandbox-load — 가짜로 바꾼 사본(masked-snapshot 결과 .ndjson.gz)을 **이 PC 의 PGlite** 연습장에 싣고,
 * 화석 코드 정비에 필요한 실측 질문을 돌린다. 운영 DB·네트워크 접근 없음.
 *
 * 실행: node scripts/ops/sandbox-load.mjs <사본.ndjson.gz> [연습장 폴더(기본 .sandbox/pg)] [--queries-only]
 *  - 표는 사본 머리의 컬럼 정보로 만든다(운영 스키마 모양 그대로 — 코드 DDL 과 다른 곳이 있으면 그것도 발견).
 *  - 결과는 숫자 집계만 출력한다(행 내용 출력 없음).
 * `.sandbox/` 는 gitignore — 사본·연습장은 커밋하지 않는다.
 */
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { PGlite } from "@electric-sql/pglite";

const [, , snapshot, dirArg, flag] = process.argv;
if (!snapshot || !existsSync(snapshot)) {
  console.error("사용법: node scripts/ops/sandbox-load.mjs <사본.ndjson.gz> [연습장 폴더] [--queries-only]");
  process.exit(1);
}
const dir = dirArg && !dirArg.startsWith("--") ? dirArg : ".sandbox/pg";
const queriesOnly = [dirArg, flag].includes("--queries-only");
mkdirSync(dir, { recursive: true });
const db = new PGlite(dir);

const TYPE = { jsonb: "jsonb", json: "jsonb", text: "text", varchar: "text", bpchar: "text", uuid: "uuid",
  int4: "integer", int8: "bigint", int2: "smallint", numeric: "numeric", float8: "double precision",
  bool: "boolean", timestamptz: "timestamptz", timestamp: "timestamp", date: "date", bytea: "bytea" };
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function load() {
  const rl = createInterface({ input: createReadStream(snapshot).pipe(createGunzip()), crlfDelay: Infinity });
  const cols = new Map();
  const counts = new Map();
  for await (const line of rl) {
    if (!line) continue;
    const rec = JSON.parse(line);
    if (rec.kind === "schema") {
      for (const t of rec.tables) {
        cols.set(t.name, t.columns);
        await db.exec(`drop table if exists ${q(t.name)} cascade`);
        await db.exec(`create table ${q(t.name)} (${t.columns.map((c) => `${q(c.name)} ${TYPE[c.type] ?? "text"}`).join(", ")})`);
      }
      continue;
    }
    const c = cols.get(rec.t);
    const names = c.map((x) => x.name);
    const vals = names.map((n) => {
      const v = rec.r[n];
      return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    await db.query(`insert into ${q(rec.t)} (${names.map(q).join(",")}) values (${names.map((_, i) => `$${i + 1}`).join(",")})`, vals);
    counts.set(rec.t, (counts.get(rec.t) ?? 0) + 1);
  }
  console.log("=== 연습장에 실은 행 수 ===");
  for (const [t, n] of counts) console.log(`  ${t}: ${n}`);
}

/** 화석 조사 ②(저장 구조)·①(데이터 경로)의 실측 질문 — 숫자만. */
const QUERIES = [
  ["탭별 전체·백필(열문자) 행", `select tab, count(*) total, count(*) filter (where payload->>'_backfill'='true') backfill from sheet_rows group by tab order by tab`],
  ["meetings: 열문자만 있고 필드명 id 없는 행", `select count(*) n from sheet_rows where tab='meetings' and payload ? 'A' and not payload ? 'id'`],
  ["contracts: 모양 조합(C열·필드명·meetingId)", `select (payload ? 'C') col_c, (payload ? '계약일') field, (payload ? 'meetingId') mid, count(*) n from sheet_rows where tab='contracts' group by 1,2,3 order by n desc`],
  ["meetings: 구형 이월 _carryRaw", `select count(*) n from sheet_rows where tab='meetings' and payload ? '_carryRaw'`],
  ["contracts·db: row_key 가 시트 줄번호 꼴", `select tab, count(*) filter (where row_key ~ '(^|:)r?\\d+$') rownum_key, count(*) filter (where row_key !~ '(^|:)r?\\d+$') other from sheet_rows where tab in ('contracts','db') group by tab`],
  ["db: _row 없는 행", `select count(*) n from sheet_rows where tab='db' and not payload ? '_row'`],
  ["탭별 지움 표시(_cleared)", `select tab, count(*) filter (where payload->>'_cleared'='true') cleared, count(*) total from sheet_rows group by tab order by tab`],
  ["contracts: 머리글 영역 쓰레기 후보(백필+계약일이 날짜 아님)", `select count(*) n from sheet_rows where tab='contracts' and payload->>'_backfill'='true' and coalesce(payload->>'C','') !~ '^\\d{4}-\\d{2}-\\d{2}$' and coalesce(payload->>'C','') !~ '^\\d{5}$'`],
  ["db: 대문자 TRUE/FALSE 값이 있는 행", `select count(*) n from sheet_rows s where tab='db' and exists (select 1 from jsonb_each_text(s.payload) e where e.value in ('TRUE','FALSE'))`],
  ["미러 대기(mirror_pending)", `select count(*) n from sheet_rows where mirror_pending is true`],
  ["schema_migrations", `select count(*) n from schema_migrations`],
];

async function queries() {
  console.log("\n=== 실측 질문 ===");
  for (const [label, sql] of QUERIES) {
    try {
      const r = await db.query(sql);
      console.log(`- ${label}: ${JSON.stringify(r.rows)}`);
    } catch (e) {
      console.log(`- ${label}: (실행 불가 — ${String(e?.message ?? e).slice(0, 120)})`);
    }
  }
}

if (!queriesOnly) await load();
await queries();
await db.close();

#!/usr/bin/env node
/**
 * BBE-59 Phase 2 — 03 DB관리(tab='db') 레거시 행(`{섹션}:r{row}`)에 payload._row 를 채운다.
 *
 * 왜 이 스크립트인가(R7-#10 "row_key 마이그레이션"의 안전한 절반): Phase 1(#757) 이후 신규
 * append 는 UUID 키(`{섹션}:{uuid}`) + `payload._row` 를 함께 쓴다. 하지만 Phase 1 이전에
 * 이미 쌓인 레거시 행은 row_key 자체(`{섹션}:r{row}`)에서만 행번호를 얻을 수 있다 —
 * read-db-tab.ts 의 `rowNumOf` 가 이미 그 폴백을 갖고 있어 **읽기는 지금도 정확**하지만,
 * payload 만 보면 신규/레거시 행을 구분해야 하는 비대칭이 영구히 남는다.
 *
 * 이 스크립트가 하는 일: 레거시 row_key 에서 행번호를 파싱해 **같은 payload 에 `_row` 필드만
 * 추가**한다(jsonb 병합, 기존 필드 무변경). row_key 자체는 **절대 바꾸지 않는다**.
 *
 * 왜 row_key 는 안 바꾸나(의도적 축소, §0.8 Solve) — row_key 개명(rename)은 03 화면이 파일럿
 * 기수에서 이미 라이브(DB read, R2-5)라 학생이 그 행을 동시에 편집 중일 수 있다. resolveWriteKey
 * (db/row-key.ts)가 "행번호로 현재 키 조회 → 그 키로 write" 순으로 동작하는데, 조회와 쓰기
 * 사이에 이 스크립트가 같은 행의 키를 바꿔버리면 그 write 가 옛 키를 찾다 실패해 **엉뚱한
 * 새 행(upsert 의 INSERT 분기)을 만들 수 있다** — 방지하려던 유령행 사고를 이 스크립트가
 * 오히려 만드는 역설. `_row` 를 payload 에 추가하는 것은 jsonb 병합이라 이 경쟁 문제가 없다
 * (기존 update/clear 의 payload 병합과 동일한 안전 패턴 — 동시 쓰기가 있어도 각자의 병합이
 * 순서대로 누적될 뿐 서로를 지우지 않는다). row_key 자체의 UUID 재작성은 별도 카드로 남긴다
 * (마이그레이션 창 또는 애플리케이션 레벨 락 설계가 선행돼야 안전).
 *
 * 멱등: WHERE 절이 `payload._row IS NULL`(또는 누락)인 행만 골라 갱신 — 재실행하면 이미 채운
 * 행은 대상에서 자동 제외된다. 실행할수록 대상이 줄어 수렴한다.
 *
 * 실행(VPS, DATABASE_URL 만 있으면 됨 — Sheets 접근 불필요):
 *   node scripts/ops/backfill-db-row-numbers.mjs [--dry-run] [--execute]
 *   기본 = dry-run(카운트·샘플만 출력). --execute 를 줘야 실제 UPDATE.
 * ★URL·비밀번호 로그 미출력.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
export function resolveDatabaseUrl() {
  return (process.env.DATABASE_URL || fileEnv.DATABASE_URL || "").trim();
}

const SECTIONS = ["매입DB", "직접생산", "현수막", "콜지기소"];

/** 레거시 03 db-tab row_key(`{섹션}:r{행}`) → 행번호. 매치 안 되면 null(신규 UUID 키 등). */
export function legacyRowNumber(rowKey) {
  const m = /^(매입DB|직접생산|현수막|콜지기소):r(\d+)$/.exec(rowKey);
  return m ? Number(m[2]) : null;
}

/** payload 에 이미 유효한 _row 가 있으면 true(스킵 대상 아님). */
export function hasRowNumber(payload) {
  const n = Number(payload?._row);
  return Number.isFinite(n) && n > 0;
}

/** dry-run/execute 공용 대상 판정 — row_key,payload 쌍에서 채워 넣을 행번호(없으면 null). */
export function pendingRowNumber(rowKey, payload) {
  if (hasRowNumber(payload)) return null;
  return legacyRowNumber(rowKey);
}

const EXECUTE = process.argv.includes("--execute");

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error("backfill-db-row-numbers: DATABASE_URL 미설정");
    process.exit(1);
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 3 });
  try {
    const { rows } = await pool.query(
      `select spreadsheet_id, row_key, payload from sheet_rows
       where tab = 'db'
         and row_key ~ '^(매입DB|직접생산|현수막|콜지기소):r[0-9]+$'
         and coalesce((payload->>'_row')::int, 0) <= 0`,
    );
    const targets = rows
      .map((r) => ({ ...r, row: legacyRowNumber(r.row_key) }))
      .filter((r) => r.row !== null);

    console.log(`backfill-db-row-numbers: 대상 ${targets.length}건 (mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"})`);
    for (const t of targets.slice(0, 20)) {
      console.log(`  ${t.spreadsheet_id} / ${t.row_key} → _row=${t.row}`);
    }
    if (targets.length > 20) console.log(`  ... 이하 ${targets.length - 20}건 생략`);

    if (!EXECUTE) {
      console.log("\nDRY-RUN — DB 미기록. 실행하려면 --execute.");
      return;
    }

    let updated = 0;
    for (const t of targets) {
      const res = await pool.query(
        `update sheet_rows set payload = payload || jsonb_build_object('_row', $1::int), updated_at = now()
         where spreadsheet_id = $2 and tab = 'db' and row_key = $3
           and coalesce((payload->>'_row')::int, 0) <= 0`,
        [t.row, t.spreadsheet_id, t.row_key],
      );
      updated += res.rowCount ?? 0;
    }
    console.log(`\n실행 완료 — ${updated}건 갱신(대상 ${targets.length}건 중, 동시 갱신으로 이미 채워진 행은 0행 영향).`);
  } finally {
    await pool.end().catch(() => {});
  }
}

// Windows 에서 file:// URL 과 process.argv[1] 슬래시/인코딩 차이로 문자열 비교가 항상 거짓이 되는
// 함정을 피하려고 경로 비교(db-migrate.mjs 와 동일 패턴).
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((e) => {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
    console.error(`backfill-db-row-numbers 실패: ${msg}`);
    process.exit(1);
  });
}

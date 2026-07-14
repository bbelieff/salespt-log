/**
 * 8기 등 지정 기수 시트 전체 → Supabase sheet_rows 1회 적재 (db-migration-pilot §1 P1).
 *
 * 실행 위치: **VPS** (.env/.env.local 에 SA·SHEETS_REGISTRY_ID·DATABASE_URL 보유)
 *   — GitHub Actions "DB Backfill" 워크플로가 SSH 로 실행. 기본 dry-run.
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 8 [--execute]
 *   node scripts/ops/backfill-sheet-rows.mjs --cohort 연습 --sheet <시트ID> [--execute]
 *     ↑ **파일럿 편입 전 선백필** — registry B(cohort)가 빈 계정은 --cohort 로 못 찾으므로
 *       시트를 명시해 먼저 DB 를 채우고, 그 다음 B 를 쓴다(순서 반대면 게이트가 DB 로 붙어 빈 화면).
 *
 * row_key 규칙 — lib/repo/db/mirror.ts 의 dual-write 와 **반드시 동일**:
 *   meetings=A열 id · todos=A열 id · contracts=r{행} · db={섹션}:r{행} ·
 *   sales={ISO날짜}:{채널} · company_archive=C열 계약ref.
 * payload = 열문자→값(비어있지 않은 셀만) + _backfill:true. 멱등: upsert(jsonb 병합).
 * ★URL·비밀번호·SA 키 로그 미출력.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";
import { Pool } from "pg";

// ── env (.env.local 우선 병합 — append-updates 는 첫 파일만 읽는 것과 달리 둘 다) ──
function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) { // 뒤(.env.local)가 우선 덮어씀
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

const COHORT = (() => {
  const i = process.argv.indexOf("--cohort");
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : "";
})();
/**
 * --sheet <spreadsheetId> (선택) — **명시 타겟**. 레지스트리 cohort 와 무관하게 그 시트만 백필.
 * 왜: 기본 선택은 registry B(cohort) 매칭인데, **아직 파일럿에 편입되지 않은 계정은 B 가 비어**
 * 있어 --cohort 로는 찾을 수 없다(연습용/테스터). 그런 계정을 파일럿에 넣으려면 **B 를 쓰기 전에**
 * DB 를 먼저 채워야 하는데(먼저 넣으면 게이트가 DB 로 붙어 빈 화면), 그 선백필을 가능케 한다.
 * email 은 그 시트의 registry 행에서 가져오고, cohort 스탬프는 --cohort 인자 값을 쓴다.
 */
const SHEET = (() => {
  const i = process.argv.indexOf("--sheet");
  return i >= 0 ? String(process.argv[i + 1] ?? "").trim() : "";
})();
const EXECUTE = process.argv.includes("--execute");
// R2-1.5(아레나): 콤마 목록 허용 — 예: --cohort "A1-0,A1-1,A1-2" (단일 라벨 동작 불변).
const COHORTS = COHORT.split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);
if (!COHORT) {
  console.error(
    "사용법: node backfill-sheet-rows.mjs --cohort <기수라벨> [--sheet <시트ID>] [--execute]\n" +
      "  --sheet 지정 시: 그 시트만 백필(레지스트리 cohort 무관). --cohort 는 DB 에 스탬프할 라벨.",
  );
  process.exit(1);
}

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("backfill: SA/레지스트리 env 누락"); process.exit(1);
}
if (EXECUTE && !DB_URL) {
  console.error("backfill: --execute 인데 DATABASE_URL 없음"); process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));
const rowObj = (r, startColIdx = 0) => {
  const o = { _backfill: true };
  r.forEach((v, i) => {
    const s = String(v ?? "").trim();
    if (s !== "") o[colName(startColIdx + i)] = s;
  });
  return o;
};
async function grid(sid, range) {
  // SERIAL_NUMBER — repo(readCourseStart)와 동일. FORMATTED_STRING 이면 O1 이
  // 로케일 서식("2026. 5. 30.")으로 와서 ISO 파싱 실패 → sales 전체 조용히 스킵
  // (dry-run #1 실측 버그, 2026-07-07).
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  }).catch(() => null);
  return res?.data.values ?? [];
}
const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};

/** 한 사용자 시트 → {tab → [{rowKey, payload}]} (dual-write 와 동일 키 규칙). */
async function extractUserRows(sid) {
  const out = { meetings: [], contracts: [], todos: [], sales: [], db: [], company_archive: [] };

  // 04 미팅 — A=id
  for (const [i, r] of (await grid(sid, "'04 업체관리(앱자동작성용)'!A2:AP")).entries()) {
    const id = String(r[0] ?? "").trim();
    if (id) out.meetings.push({ rowKey: id, payload: rowObj(r), row: i + 2 });
  }
  // 05 실무투두 — A=id (탭 없으면 빈 배열)
  for (const [i, r] of (await grid(sid, "'05 실무투두'!A2:N")).entries()) {
    const id = String(r[0] ?? "").trim();
    if (id) out.todos.push({ rowKey: id, payload: rowObj(r), row: i + 2 });
  }
  // 02 계약수납 — 행 고정 키 r{행}. 신형(계약수납관리) 우선, 구형(계약관리) 폴백.
  // 시작행 = 앱 레이아웃(lib/repo/contract-payment.ts TAB_ALIASES)과 동일: 신형 6 / 구형 5.
  // 과거 `>= 3` 이 헤더·예시 구간(r3 "수납총액" 안내행, r5 "00유통" 템플릿 예시행)을
  // 유령 계약으로 적재한 사고 수정(2026-07-12, 전 기수 94행 — repair 스크립트로 정리).
  for (const [tabName, firstDataRow] of [["02 계약수납관리", 6], ["02 계약관리", 5]]) {
    const rows = await grid(sid, `'${tabName}'!C1:AK`);
    if (rows.length === 0) continue;
    rows.forEach((r, i) => {
      const 계약일 = String(r[0] ?? "").trim(); // C
      const sheetRow = i + 1;
      if (계약일 && sheetRow >= firstDataRow && !/계약일/.test(계약일)) {
        out.contracts.push({ rowKey: `r${sheetRow}`, payload: rowObj(r, 2), row: sheetRow });
      }
    });
    break; // 첫 존재 탭만
  }
  // 03 DB관리 — 4섹션, {섹션}:r{행}, 행 4~100, 첫 컬럼 비면 제외
  const SEC = [
    ["매입DB", "B", "H"], ["직접생산", "I", "O"], ["현수막", "P", "V"], ["콜지기소", "X", "AD"],
  ];
  for (const [name, c1, c2] of SEC) {
    const rows = await grid(sid, `'03 DB관리'!${c1}4:${c2}100`);
    rows.forEach((r, i) => {
      if (String(r[0] ?? "").trim() !== "") {
        const startIdx = c1.length === 1 ? c1.charCodeAt(0) - 65 : 26 + c1.charCodeAt(1) - 65;
        out.db.push({ rowKey: `${name}:r${i + 4}`, payload: rowObj(r, startIdx), row: i + 4 });
      }
    });
  }
  // 01 영업관리 E~H — (날짜,채널) 자연키. 좌표: row = 10 + (주-1)*34 + 일*4 + 채널idx.
  const CH = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
  const o1 = (await grid(sid, "'01 영업관리'!O1"))[0]?.[0];
  const startISO = serialToISO(o1);
  if (!startISO) console.warn(`    ⚠ O1(수강시작일) 파싱 실패 — sales 스킵 (raw=${typeof o1})`);
  if (startISO) {
    const start = new Date(startISO + "T00:00:00Z");
    const block = await grid(sid, "'01 영업관리'!E10:H349"); // 10주 × 34 stride
    for (let w = 1; w <= 10; w++) {
      for (let d = 0; d < 7; d++) {
        for (let c = 0; c < 4; c++) {
          const sheetRow = 10 + (w - 1) * 34 + d * 4 + c;
          const r = block[sheetRow - 10] ?? [];
          const [E, F, G, H] = [r[0], r[1], r[2], r[3]].map((v) => String(v ?? "").trim());
          if (E === "" && F === "" && G === "" && H === "") continue;
          const date = new Date(start.getTime() + ((w - 1) * 7 + d) * 86400000)
            .toISOString().slice(0, 10);
          out.sales.push({
            rowKey: `${date}:${CH[c]}`,
            payload: {
              _backfill: true, date, channel: CH[c],
              ...(E !== "" ? { production: Number(E) || E } : {}),
              ...(F !== "" ? { inflow: Number(F) || F } : {}),
              ...(G !== "" ? { contactProgress: Number(G) || G } : {}),
              ...(H !== "" ? { meetingReservation: Number(H) || H } : {}),
            },
            row: sheetRow,
          });
        }
      }
    }
  }
  // 06 업체정보 — C=계약ref
  for (const [i, r] of (await grid(sid, "'06 업체정보'!A2:AB")).entries()) {
    const ref = String(r[2] ?? "").trim();
    if (ref) out.company_archive.push({ rowKey: ref, payload: rowObj(r), row: i + 2 });
  }
  return out;
}

async function main() {
  // 레지스트리에서 대상 사용자(시트 보유) 목록
  const reg = await grid(REGISTRY_ID, "'users'!A2:R");
  const all = reg.map((r) => ({
    email: String(r[0] ?? "").trim().toLowerCase(),
    cohort: String(r[1] ?? "").trim(),
    sid: String(r[3] ?? "").trim(),
    role: String(r[4] ?? "").trim() || "trainee",
  }));
  const notStaff = (u) => u.role !== "trainer" && u.role !== "admin";
  const users = SHEET
    ? // 명시 타겟: 그 시트 행만(레지스트리 cohort 무관 — 아직 빈 B 라도 선백필 가능).
      //   DB 에 스탬프할 cohort 는 --cohort 인자(파일럿 라벨)로 강제.
      all
        .filter((u) => u.sid === SHEET && notStaff(u))
        .map((u) => ({ ...u, cohort: COHORTS[0] ?? u.cohort }))
    : all.filter(
        (u) => u.sid && COHORTS.includes(u.cohort.replace(/기\s*$/, "")) && notStaff(u),
      );
  if (SHEET && users.length === 0) {
    console.error(`backfill: --sheet ${SHEET} 에 해당하는 registry trainee 행이 없습니다.`);
    process.exit(1);
  }
  // 같은 시트 중복 행 제거(부부 멀티계정 — 시트 1개당 1회)
  const seen = new Set();
  const targets = users.filter((u) => !seen.has(u.sid) && seen.add(u.sid));
  const scope = SHEET ? `시트 ${SHEET} (라벨 ${COHORT} 로 스탬프)` : `기수 ${COHORT}`;
  console.log(`backfill: ${scope} — 대상 시트 ${targets.length}개 (mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"})`);

  const pool = EXECUTE
    ? new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 })
    : null;
  const TABS = ["meetings", "contracts", "todos", "sales", "db", "company_archive"];
  const totals = Object.fromEntries(TABS.map((t) => [t, 0]));
  let upserted = 0;

  for (const u of targets) {
    const rows = await extractUserRows(u.sid);
    const line = TABS.map((t) => `${t}:${rows[t].length}`).join(" ");
    console.log(`  ${u.email} → ${line}`);
    for (const t of TABS) {
      totals[t] += rows[t].length;
      if (!EXECUTE) continue;
      for (const item of rows[t]) {
        await pool.query(
          `insert into sheet_rows (cohort, email, spreadsheet_id, tab, row_key, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6::jsonb, now())
           on conflict (spreadsheet_id, tab, row_key)
           do update set cohort=$1, email=$2,
             payload = sheet_rows.payload || excluded.payload, updated_at = now()`,
          [u.cohort, u.email, u.sid, t, item.rowKey, JSON.stringify(item.payload)],
        );
        upserted++;
      }
    }
  }

  console.log("\n── 결과 표 (기수·탭별 시트 유효 행수) ──");
  console.log("tab | sheet_rows(시트 추출)");
  for (const t of TABS) console.log(`${t} | ${totals[t]}`);

  if (EXECUTE && pool) {
    console.log(`\nDB upsert 완료: ${upserted}건`);
    // 대조는 대상 사용자들의 실제 cohort 라벨 전체 기준(콤마 목록·기 접미 변형 포괄).
    const cohortLabels = [...new Set(targets.map((u) => u.cohort))];
    const res = await pool.query(
      `select cohort, tab, count(*)::int n from sheet_rows
       where cohort = any($1) and coalesce((payload->>'_cleared')::boolean,false)=false
       group by cohort, tab order by cohort, tab`,
      [cohortLabels.length ? cohortLabels : COHORTS],
    );
    console.log("── 대조 표 (DB 기준) ──");
    console.log("cohort | tab | db행수");
    for (const r of res.rows) console.log(`${r.cohort} | ${r.tab} | ${r.n}`);
    await pool.end();
  } else {
    console.log("\nDRY-RUN — DB 미기록. 실행하려면 --execute.");
  }
}

main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error("backfill 실패:", msg);
  process.exit(1);
});

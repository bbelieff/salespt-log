/**
 * R4 W1-1 실측 M7 — **시트 창 밖(11주+ / 주차 0) sales 행이 DB 에 이미 있는가** (읽기 전용).
 *
 * 왜: W1-1 이 대시보드 집계에 `1~MAX_SHEET_WEEK` 클램프를 넣는다. 클램프 자체는 시트 수식과
 * 대칭이지만(01!R1:R3 = 주차블록 합 실측), **이미 창 밖 행이 DB 에 있다면** 배포 순간 그 사용자의
 * 대시보드 생산/유입/컨택진행이 아무 공지 없이 **감소**한다. 0 건이면 "오늘 수치 불변"이 사후 증명.
 *
 * 창 밖 행이 생길 수 있었던 경로: persistSalesRows(컨택 저장)에는 애초에 주차 가드가 없었다
 * (가드는 단일셀 writer 2개에만). 컨택탭 주차 네비에도 상한이 없다.
 *
 * ★읽기 전용 — INSERT/UPDATE/DELETE 없음. 연결문자열·SA 키·시트ID 미출력.
 * 실행(VPS, .env 에 DATABASE_URL + SA 보유): node scripts/ops/r4-week11-audit.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";
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

const MAX_SHEET_WEEK = 10; // SSOT-COPY: lib/config/cohort-dates.ts MAX_SHEET_WEEK (ops 사본)

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const DB_URL = env("DATABASE_URL");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY || !DB_URL) {
  console.error("audit: env 누락(SA/레지스트리/DATABASE_URL) — VPS 에서 실행하세요");
  process.exit(1);
}

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 });

const parseISO = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const diffDays = (a, b) => Math.round((a.getTime() - b.getTime()) / 86_400_000);
// WEEK-INDEX-SSOT-COPY: lib/util/week.ts weekIndexOf(시작일 앵커) 사본 — .mjs 는 TS import 불가. 수정 시 정본과 동기 (G8)
const weekIndexOf = (date, courseStart) => {
  const d = diffDays(date, courseStart);
  return d < 0 ? 0 : Math.floor(d / 7) + 1;
};

/** sheet_rows 에 sales 행이 있는 시트별로 courseStart(O1) 를 읽는다. */
async function courseStartOf(sid) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: "'01 영업관리'!O1",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const v = res.data.values?.[0]?.[0];
    if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return parseISO(v.slice(0, 10));
    return null;
  } catch {
    return null;
  }
}

const { rows: sheetIds } = await pool.query(
  `select distinct spreadsheet_id from sheet_rows where tab = 'sales'`,
);
console.log(`sales 행 보유 시트 수: ${sheetIds.length}`);

let totalOut = 0;
let totalRows = 0;
const offenders = [];
let noCourseStart = 0;

for (const { spreadsheet_id: sid } of sheetIds) {
  const cs = await courseStartOf(sid);
  if (!cs) { noCourseStart++; continue; }
  const { rows } = await pool.query(
    `select payload->>'date' as date, payload->>'channel' as ch,
            coalesce((payload->>'production')::numeric,0) as p,
            coalesce((payload->>'inflow')::numeric,0) as i,
            coalesce((payload->>'contactProgress')::numeric,0) as c
       from sheet_rows
      where tab = 'sales' and spreadsheet_id = $1
        and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [sid],
  );
  totalRows += rows.length;
  const out = rows.filter((r) => {
    if (!r.date) return false;
    const w = weekIndexOf(parseISO(r.date), cs);
    return w < 1 || w > MAX_SHEET_WEEK;
  });
  if (out.length) {
    totalOut += out.length;
    const sum = out.reduce(
      (a, r) => ({ p: a.p + Number(r.p), i: a.i + Number(r.i), c: a.c + Number(r.c) }),
      { p: 0, i: 0, c: 0 },
    );
    offenders.push({
      sid: sid.slice(0, 6) + "…", // 시트ID 부분 마스킹
      n: out.length,
      dates: [...new Set(out.map((r) => r.date))].sort().slice(0, 5),
      감소분: sum,
    });
  }
}

console.log(`\n=== M7 결과 ===`);
console.log(`검사 sales 행: ${totalRows} · courseStart 미확인 시트: ${noCourseStart}`);
console.log(`창 밖(주차<1 또는 >${MAX_SHEET_WEEK}) 행: **${totalOut}**`);
if (!totalOut) {
  console.log("→ 0 건: W1-1 클램프 배포로 **기존 대시보드 수치 변화 없음**(오늘 수치 불변 사후 증명).");
} else {
  console.log("→ 1건 이상: 배포 시 아래 시트의 대시보드 생산/유입/컨택진행이 그만큼 **감소**한다.");
  for (const o of offenders) {
    console.log(
      `  · ${o.sid} 행${o.n} 날짜예시=${o.dates.join(",")} 감소분(생산/유입/컨택)=${o.감소분.p}/${o.감소분.i}/${o.감소분.c}`,
    );
  }
}
await pool.end();

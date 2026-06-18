/**
 * 진단(읽기 전용) — 시트 #VALUE! 광범위 원인 규명 (2026-06-18).
 * 강구수/이재영/정유영 시트의 깨진 셀 FORMULA(수식 문자열)와 값을 함께 덤프.
 * SA 인증. 쓰기 없음.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

function loadEnvFile() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8").replace(/\r/g, "");
    const out = {};
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
    return out;
  }
  return {};
}
const fileEnv = loadEnvFile();
const env = (k) => process.env[k] || fileEnv[k] || "";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const TAB = env("SHEETS_REGISTRY_TAB") || "users";
if (!SA_EMAIL || !SA_KEY || !REGISTRY_ID) {
  console.error("자격 누락(SA / REGISTRY).");
  process.exit(1);
}
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

// 이름으로 시트ID 찾기 (부분 일치 — 부부행 등 흡수)
const TARGETS = ["강구수", "이재영", "정유영"];
const reg = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: `'${TAB}'!A2:F`,
});
const rows = reg.data.values ?? [];
const found = [];
for (const name of TARGETS) {
  const hit = rows.find(
    (r) => String(r[2] ?? "").includes(name) && String(r[3] ?? "").trim(),
  );
  if (hit) found.push({ name, sheetId: String(hit[3]).trim(), cohort: String(hit[1] ?? "").trim() });
  else console.log(`[⚠] ${name} 레지스트리 행/시트ID 못 찾음`);
}

// 진단 대상 셀 (01 영업관리 + 대시보드)
const SALES = "01 영업관리";
const DASH = "대시보드(자동작성)";
const CELLS = [
  [SALES, "E1:E6"], // funnel 6단계 (미팅/계약 깨짐 의심)
  [SALES, "I2:I6"], // 5지표(생산성)
  [SALES, "K3:L6"], // 채널별 생산/계약
  [SALES, "R1:U6"], // 채널 stacking
  [SALES, "N38"], // 주차1 계약수
  [DASH, "B21:G21"], // 재무(매출/이익)
  [DASH, "C33:H40"], // 활동량
];
const tabRef = (t) => (/[ ()]/.test(t) ? `'${t}'` : t);

for (const f of found) {
  console.log(`\n========== ${f.name} (${f.cohort}) ${f.sheetId.slice(0, 10)}… ==========`);
  let meta;
  try {
    meta = await sheets.spreadsheets.get({
      spreadsheetId: f.sheetId,
      ranges: CELLS.map(([t, a]) => `${tabRef(t)}!${a}`),
      fields: "sheets(data(rowData(values(formattedValue,userEnteredValue,effectiveValue))))",
    });
  } catch (e) {
    console.log(`  [read 실패] ${e.message}`);
    continue;
  }
  const sh = meta.data.sheets ?? [];
  CELLS.forEach(([tab, a1], idx) => {
    console.log(`  --- ${tab}!${a1} ---`);
    const rowData = sh[idx]?.data?.[0]?.rowData ?? [];
    rowData.forEach((rd, ri) => {
      (rd.values ?? []).forEach((cell, ci) => {
        const fv = cell.formattedValue ?? "";
        const formula = cell.userEnteredValue?.formulaValue;
        const isErr = typeof fv === "string" && fv.startsWith("#");
        if (isErr || formula) {
          const mark = isErr ? "❌" : "  ";
          console.log(`    ${mark} [r${ri}c${ci}] val="${fv}"${formula ? `  ⟵ ${formula}` : ""}`);
        }
      });
    });
  });
}
console.log("\n(읽기 전용 — 변경 없음)");

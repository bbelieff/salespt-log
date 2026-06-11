/**
 * 1회용 — 새소식 초기 backfill (announcement-popup §2).
 *
 * `gh pr list --state merged` 기반으로 최근 **사용자-가시**(feat/fix) PR 10개를
 * 레지스트리 `updates` 탭에 등재한다. append-updates.mjs 와 같은 멱등 가드
 * (pr 키 대조 — 두 번 실행해도 중복 0). 문구는 admin 이 팝업관리에서 다듬는다.
 *
 * 실행 (PC, gh 인증 필요): node scripts/backfill-updates.mjs
 */
import { execFileSync } from "node:child_process";
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

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error("backfill-updates: SHEETS_REGISTRY_ID / SA 자격을 찾지 못했습니다.");
  process.exit(1);
}

// ── 최근 사용자-가시 PR 10개 (feat/fix 브랜치) ───────────────────
const raw = execFileSync(
  "gh",
  [
    "pr", "list", "--state", "merged", "--limit", "60", "--base", "master",
    "--json", "number,title,mergedAt,headRefName",
  ],
  { encoding: "utf8" },
);
const prs = JSON.parse(raw)
  .filter((p) => /^(feat|fix)\//.test(p.headRefName))
  .sort((a, b) => b.number - a.number)
  .slice(0, 10);

const cleanTitle = (t) =>
  t.replace(/^(feat|fix|perf|chore|docs|refactor)(\([^)]*\))?!?:\s*/i, "").trim();

const rows = prs
  .map((p) => ({
    pr: p.number,
    date: String(p.mergedAt ?? "").slice(0, 10),
    type: p.headRefName.split("/")[0],
    titleUser: cleanTitle(p.title),
    visible: "TRUE",
  }))
  .sort((a, b) => a.pr - b.pr);

// ── append (멱등 — 기존 pr skip) ─────────────────────────────────
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets",
]);
const sheets = google.sheets({ version: "v4", auth });

// 탭 보장 (멱등 — append-updates.mjs 와 동일 패턴, 첫 배포 전 실행 대비)
const meta = await sheets.spreadsheets.get({
  spreadsheetId: REGISTRY_ID,
  fields: "sheets(properties(title))",
});
if (!(meta.data.sheets ?? []).some((s) => s.properties?.title === "updates")) {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: REGISTRY_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: "updates" } } }] },
    });
  } catch (e) {
    if (!String(e?.message ?? "").includes("already exists")) throw e;
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: REGISTRY_ID,
    range: "'updates'!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["pr", "date", "type", "title_user", "body_md", "milestone", "visible"]],
    },
  });
}

const existing = await sheets.spreadsheets.values.get({
  spreadsheetId: REGISTRY_ID,
  range: "'updates'!A2:A",
});
const seen = new Set(
  (existing.data.values ?? []).map((r) => String(r[0] ?? "").trim()).filter(Boolean),
);
const fresh = rows.filter((r) => !seen.has(String(r.pr)));

if (fresh.length === 0) {
  console.log(`backfill-updates: 신규 0건 (후보 ${rows.length} 전부 기존)`);
  process.exit(0);
}

await sheets.spreadsheets.values.append({
  spreadsheetId: REGISTRY_ID,
  range: "'updates'!A1:G",
  valueInputOption: "RAW",
  insertDataOption: "INSERT_ROWS",
  requestBody: {
    values: fresh.map((c) => [c.pr, c.date, c.type, c.titleUser, "", "", c.visible]),
  },
});
console.log(
  `backfill-updates: ${fresh.length}건 등재 —\n` +
    fresh.map((c) => `  #${c.pr} [${c.type}] ${c.titleUser}`).join("\n"),
);

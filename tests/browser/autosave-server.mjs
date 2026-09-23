// Actual UI components, synthetic in-memory API only. No production credentials.
import { context } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "salespt-autosave-"));
const bundle = await context({ entryPoints: ["tests/browser/autosave-fixture.tsx"], bundle: true,
  outfile: join(dir, "app.js"), platform: "browser", jsx: "automatic",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("navigation")
      ? "export const useRouter=()=>({push:p=>location.assign(p)}); export const usePathname=()=>location.pathname;"
      : 'import React from "react"; export default function Link({href,children,...rest}){return React.createElement("a",{...rest,href},children)}',
      loader: "js", resolveDir: process.cwd() }));
  }}] });
await bundle.rebuild();
await bundle.watch();
const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
assert.equal(css.status, 0, css.stderr);
const goals = { production: 30, inflow: 20, contacts: 10, meetings: 6, contracts: 3 };
const records = new Map(); const privateRecords = new Map(); const writes = [];
const categories = [{ id: "11111111-1111-4111-8111-111111111111", name: "마케팅", isSystem: false, deletedAt: null, archivedAt: null }];
let failNext = false; let delay = 0;
function view(week) {
  const record = records.get(week) ?? { goals, task: "경쟁사 분석\n컨택 연습", revision: 1, updatedAt: null };
  const period = { week, start: "2026-09-18", end: "2026-09-24", record, actuals: goals };
  return { student: { email: "fixture@example.test", name: "테스트 수강생", cohort: "연습기수", courseStart: "2026-09-04", region: "테스트", trainers: ["테스트 트레이너"] },
    current: period, previous: { ...period, week: week - 1 }, reporting: { start: period.start, end: period.end, actuals: goals }, cumulative: goals, canReadInternal: true };
}
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>자동저장 실컴포넌트 검증</title><link rel="stylesheet" href="/style.css"><style>html,body,#root{height:100%}</style><body class="bg-gray-50"><div id="root"></div><script src="/app.js"></script></body></html>';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1"); const path = url.pathname;
  const json = (data, status = 200) => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
  if (path === "/__test/state") return json({ writes });
  if (path === "/__test/control") { failNext = url.searchParams.get("fail") === "1"; delay = Number(url.searchParams.get("delay") || 0); return json({ failNext, delay }); }
  if (path.startsWith("/api/")) {
    const week = Number(url.searchParams.get("week") || 2);
    if (req.method !== "GET") {
      let body = ""; for await (const chunk of req) body += chunk;
      const data = JSON.parse(body || "{}"); writes.push({ path, week, data });
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (failNext) { failNext = false; return json({ error: "검증용 연결 오류 — 입력은 유지됩니다." }, 503); }
      if (path === "/api/weekly-goals") { const revision = view(week).current.record.revision + 1; records.set(week, { ...data, revision }); return json({ revision }); }
      if (path === "/api/weekly-goals/internal") { const revision = (privateRecords.get(week)?.revision ?? 1) + 1; privateRecords.set(week, { ...data, revision }); return json({ revision }); }
      return json({ ...data, id: "22222222-2222-4222-8222-222222222222", ok: true });
    }
    if (path === "/api/weekly-goals") return json(view(week));
    if (path === "/api/weekly-goals/internal") return json(privateRecords.get(week) ?? { specialNotes: "", priorOutcome: "", revision: 1, updatedAt: null });
    if (path === "/api/expense-categories") return json({ categories });
    if (path === "/api/expense-recurring-rules") return json({ rules: [] });
    if (path === "/api/expenses") return json({ view: "month", month: "2026-09", categories, entries: [], categoryTotals: [], additionalCostTotal: 0 });
    return json({});
  }
  if (path === "/compare") { res.setHeader("Content-Type", "text/html"); return res.end('<!doctype html><title>자동저장 반응형 검증</title><style>body{display:flex;gap:20px;background:#eef2f6;font:14px sans-serif}iframe{height:840px;border:1px solid #ccc;background:white;flex-shrink:0}</style><div>390px<iframe title="모바일 390px" src="/" width="390"></iframe></div><div>1024px<iframe title="PC 1024px" src="/" width="1024"></iframe></div>'); }
  res.setHeader("Content-Type", path === "/app.js" ? "application/javascript" : path === "/style.css" ? "text/css" : "text/html");
  res.end(path === "/app.js" ? readFileSync(join(dir, "app.js")) : path === "/style.css" ? readFileSync(join(dir, "style.css")) : html);
});
server.listen(0, "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}`));

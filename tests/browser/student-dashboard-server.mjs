// Local synthetic API + actual components/CSS/fonts. Browser interaction is performed separately.
// Run after `npm run build`: node tests/browser/student-dashboard-server.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "student-dashboard-"));
await build({ entryPoints: ["tests/browser/student-dashboard-fixture.tsx"], bundle: true,
  outfile: join(dir, "app.js"), platform: "browser", jsx: "automatic",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("navigation")
      ? "export const useRouter=()=>({push:p=>location.assign(p)}); export const usePathname=()=>'/dashboard';"
      : 'import React from "react"; export default function Link({href,children,...rest}){return React.createElement("a",{...rest,href},children)}',
      loader: "js", resolveDir: process.cwd() }));
  }}] });
const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
assert.equal(css.status, 0, css.stderr);
const builtCss = readdirSync(".next/static/css").filter(f => f.endsWith(".css")).map(f => readFileSync(join(".next/static/css", f), "utf8")).join("\n");
const faces = (builtCss.match(/@font-face\{[^}]+\}/g) ?? []).filter(s => s.includes("Noto")).join("\n");
const family = faces.match(/font-family:([^;]+);/)?.[1];
assert.ok(family, "Build first for production font assets");
const fontCss = faces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/") + ':root{--font-noto-sans-kr:' + family + '}';
const media = new Map(readdirSync(".next/static/media").map(f => ["/media/" + f, join(".next/static/media", f)]));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>수강생 대시보드 합성 검증</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';
let failNext = false;
const iso = d => d.toISOString().slice(0, 10);
const add = (d, n) => new Date(d.getTime() + n * 86400000);
const friday = d => add(d, -((d.getUTCDay() + 2) % 7));
const courseStart = new Date("2026-07-03T00:00:00Z");
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const reply = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  if (url.pathname === "/fixture/fail-next") { failNext = true; return reply({ ok: true }); }
  if (url.pathname === "/api/me") return reply({ email: "fixture@example.invalid", name: "가상수강생긴이름", cohort: "연습", sessionRole: "admin", impersonating: "fixture@example.invalid", courseStartISO: "2026-07-03", graduationISO: "2026-10-24" });
  if (url.pathname === "/api/trainer/recruitment") return reply({ email: "fixture@example.invalid", name: "가상수강생긴이름", status: "approved", canStudent: true, canTrainer: !String(req.headers.referer).includes("studentOnly"), isAdmin: true, impersonating: true });
  if (url.pathname === "/api/announcements") return reply({ latestPr: 0, announcements: [], updates: [] });
  if (url.pathname === "/api/dashboard") return reply({
    kpi: { 총매출: 12000000, 총비용: 3000000, 수임비합: 8000000, 수수료합: 4000000, 이월매출: 2000000, 전체매출: 14000000, 이월비용: 100000, 전체비용: 3100000 },
    additionalCost: { dbCostTotal: 2000000, additionalCost: 1000000, status: "available" }, channelMatrix: [], weeklyTrend: [], costBreakdown: [] });
  if (url.pathname === "/api/weekly-goals") {
    if (failNext) { failNext = false; return reply({ error: "합성 조회 실패" }, 503); }
    const date = url.searchParams.get("date") || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const start = friday(new Date(date + "T00:00:00Z"));
    const week = Math.max(1, Math.floor((start - courseStart) / (86400000 * 7)) + 1);
    const student = url.searchParams.get("student") || "fixture@example.invalid";
    const item = w => ({ week: w, start: iso(add(courseStart, (w - 1) * 7)), end: iso(add(courseStart, w * 7 - 1)),
      record: { goals: { production: 20, inflow: 10, contacts: 5, meetings: 3, contracts: 1 }, task: `${w}주 과제`, revision: 0, updatedAt: null }, actuals: { production: student.startsWith("second") ? 99 : w, inflow: 4, contacts: 3, meetings: 2, contracts: 1 } });
    return reply({ student: { email: student, name: "가상 수강생", cohort: "연습", courseStart: iso(courseStart), region: "합성", trainers: [] }, current: item(week), previous: week > 1 ? item(week - 1) : null, canReadInternal: false });
  }
  if (url.pathname.startsWith("/api/")) return reply({ categories: [], entries: [], rules: [], categoryTotals: [], additionalCostTotal: 0 });
  if (url.pathname === "/calendar-customizer") { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(readFileSync("artifacts/dashboard-polish/calendar-customizer.html")); }
  const file = media.get(url.pathname) || (url.pathname === "/salespt-logo.png" ? "public/salespt-logo.png" : null);
  if (file) { res.setHeader("Content-Type", file.endsWith("png") ? "image/png" : "font/woff2"); return res.end(readFileSync(file)); }
  const content = url.pathname === "/app.js" ? readFileSync(join(dir, "app.js")) : url.pathname === "/style.css" ? readFileSync(join(dir, "style.css")) : url.pathname === "/font.css" ? fontCss : html;
  res.setHeader("Content-Type", url.pathname.endsWith("js") ? "application/javascript" : url.pathname.endsWith("css") ? "text/css" : "text/html");
  res.end(content);
});
server.listen(0, "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}`));

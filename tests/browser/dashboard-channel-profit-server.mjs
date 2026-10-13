// Production component/CSS/font reuse; synthetic reads only. Build first, then node this file.
import { context } from "esbuild";
import { channelProfitRoute } from "./dashboard-channel-profit-data.mjs";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "dashboard-followups-"));
const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
assert.equal(css.status, 0, css.stderr);
const bundle = await context({
  entryPoints: ["tests/browser/dashboard-channel-profit-fixture.tsx"], bundle: true, outfile: join(dir, "app.js"),
  platform: "browser", jsx: "automatic", logLevel: "warning",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ loader: "js", resolveDir: process.cwd(), contents: args.path.endsWith("navigation")
      ? "export const useRouter=()=>({push:p=>window.__fixtureNavigate(p),replace:p=>window.__fixtureNavigate(p,true),back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{},prefetch:()=>{}});"
        + "export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search);"
        + "export const useParams=()=>({}); export const redirect=p=>window.__fixtureNavigate(p,true); export const notFound=()=>{};"
      : 'import React from "react"; export default function Link({href,children,prefetch,replace,scroll,...rest}){'
        + 'const to=typeof href==="string"?href:String(href);'
        + 'return React.createElement("a",{...rest,href:to,onClick:e=>{rest.onClick?.(e);if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();window.__fixtureNavigate(to,replace)}},children)}' }));
    // JS 를 다시 묶을 때마다(첫 빌드 제외) Tailwind 도 다시 뽑아 새 클래스가 바로 보이게(목업 반복 수정용).
    let first = true;
    b.onEnd(() => {
      if (first) { first = false; return; }
      spawn(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { stdio: "ignore" });
    });
  } }],
});
await bundle.rebuild();
await bundle.watch();

const builtCss = readdirSync(".next/static/css").filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(".next/static/css", f), "utf8")).join("\n");
const faces = (builtCss.match(/@font-face\{[^}]+\}/g) ?? []).filter((s) => s.includes("Noto")).join("\n");
const family = faces.match(/font-family:([^;]+);/)?.[1];
assert.ok(family, "Build first for production font assets");
const fontCss = faces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/") + ":root{--font-noto-sans-kr:" + family + "}";
const media = new Map(readdirSync(".next/static/media").map((f) => ["/media/" + f, join(".next/static/media", f)]));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>채널별 남은 돈 검증</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';

const cookieOf = (req, name) => (req.headers.cookie ?? "").split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const send = (status, type, body) => { res.writeHead(status, { "Content-Type": type }); res.end(body); };
  if (req.method !== "GET") return send(405, "application/json", '{"error":"read-only fixture"}');
  if (path === "/font.css") return send(200, "text/css", fontCss);
  if (media.has(path)) return send(200, "font/woff2", readFileSync(media.get(path)));
  if (["/app.js", "/app.css", "/style.css"].includes(path)) {
    const f = join(dir, path.slice(1));
    return send(200, path.endsWith(".js") ? "text/javascript" : "text/css", existsSync(f) ? readFileSync(f) : "");
  }
  const t = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const result = channelProfitRoute(req, path, cookieOf, t);
  if (result) return send(result.status ?? 200, "application/json", JSON.stringify(result.body));
  if (path === "/payment") return send(200, "text/html; charset=utf-8", '<html lang="ko"><meta charset="utf-8"><p>합성 실무/수납 링크 목적지</p><a href="/dashboard?channels=demo">대시보드</a></html>');
  if (path.startsWith("/api/")) return send(404, "application/json", '{"error":"fixture endpoint missing"}');
  return send(200, "text/html; charset=utf-8", html);
});
server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}/dashboard?channels=demo`));

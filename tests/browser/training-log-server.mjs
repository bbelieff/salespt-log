// 트레이닝일지 화면 확인 서버 — node tests/browser/training-log-server.mjs [포트]. 합성 응답만(training-log-fixture.tsx).
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "training-log-"));
const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
assert.equal(css.status, 0, css.stderr);
await build({
  entryPoints: ["tests/browser/training-log-fixture.tsx"], bundle: true, outfile: join(dir, "app.js"),
  platform: "browser", jsx: "automatic", logLevel: "warning",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", resolveDir: process.cwd(), contents:
      'import React from "react"; export default function Link({href,children,prefetch,replace,scroll,...rest}){'
      + 'return React.createElement("a",{...rest,href,onClick:e=>{e.preventDefault();window.__fixtureNavigate(href)}},children)}' }));
  } }],
});
const port = Number(process.argv[2] ?? 4317);
createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/app.js" || path === "/app.css" || path === "/style.css") {
    res.writeHead(200, { "Content-Type": path.endsWith(".js") ? "text/javascript" : "text/css" });
    return res.end(readFileSync(join(dir, path.slice(1))));
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"></head><body class="bg-slate-50"><div id="root"></div><script src="/app.js"></script></body></html>');
}).listen(port, () => console.log(`training-log fixture http://localhost:${port}/`));

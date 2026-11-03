// 통화 정리 앞단 화면 확인 서버 — 가상 데이터만, 바깥 요청 없음. 실행: node tests/browser/call-summary-front/server.mjs
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = mkdtempSync(join(tmpdir(), "call-summary-front-"));
await build({
  entryPoints: ["tests/browser/call-summary-front/App.tsx"], bundle: true, outfile: join(output, "app.js"),
  platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
});
const sheetCss = ["db-sheet", "recording", "compact"].map(n => `<link rel="stylesheet" href="/css/${n}.css">`).join("");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>통화 정리 앞단 확인</title>${sheetCss}<link rel="stylesheet" href="/app.css"><style>
*{box-sizing:border-box}html,body,p,h2,ol{margin:0}body{background:#f1f5f9;color:#0f172a;font-family:"Noto Sans KR",system-ui,sans-serif;font-size:14px}button{font:inherit;background:none;border:0;cursor:pointer;color:inherit}#root{max-width:1180px;margin:0 auto;padding:16px}.fixture-detail{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;display:grid;gap:12px;max-width:640px}.fixture-detail h2{margin:0;font-size:18px}@media(max-width:640px){#root{padding:0}}
</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
createServer((req, res) => {
  const p = new URL(req.url, "http://localhost").pathname;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'none'; object-src 'none'; base-uri 'none'");
  if (p === "/app.js" || p === "/app.css") { const f = join(output, p.slice(1)); res.setHeader("Content-Type", p.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8"); return res.end(existsSync(f) ? readFileSync(f) : ""); }
  const css = p.match(/^\/css\/(db-sheet|recording|compact)\.css$/);
  if (css) { res.setHeader("Content-Type", "text/css; charset=utf-8"); return res.end(readFileSync(`app/(app)/db-sheet/${css[1]}.css`)); }
  if (p === "/") { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(html); }
  res.writeHead(404); res.end("Not found");
}).listen(4317, "127.0.0.1", () => console.log("MOCKUP_URL=http://127.0.0.1:4317/"));

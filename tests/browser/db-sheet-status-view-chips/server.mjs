import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = mkdtempSync(join(tmpdir(), "db-sheet-status-chips-"));
await build({
  entryPoints: ["tests/browser/db-sheet-status-view-chips/App.tsx"],
  bundle: true,
  outfile: join(output, "app.js"),
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
});

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DB 상태 필터 칩 검증</title><link rel="stylesheet" href="/db-sheet.css"><style>
*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0}body{background:#f1f5f9;color:#0f172a;font-family:Arial,"Noto Sans KR",sans-serif}.fixture-shell{width:min(1180px,100%);margin:0 auto;padding:24px 16px}.sheet-panel{overflow:hidden;border:1px solid #cbd5e1;border-radius:14px;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.08)}.fixture-head{display:flex;align-items:center;gap:12px;padding:14px 16px}.fixture-head>div{min-width:0}.fixture-head h1{margin:0;font-size:18px}.fixture-head p{margin:3px 0 0;color:#64748b;font-size:12px}.fixture-search{margin-left:auto;min-height:40px;width:min(280px,45vw);border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px}.fixture-reset{min-height:40px;border:0;background:transparent;color:#1d4ed8;font-weight:700}.fixture-list{display:grid;gap:0;margin:0;padding:0;list-style:none}.fixture-list li{display:flex;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}.fixture-list li span{color:#475569}.fixture-state{margin:0;padding:28px 16px;text-align:center;color:#64748b}.fixture-error{color:#b91c1c;background:#fef2f2}.fixture-foot{padding:12px 16px;text-align:right;font-size:13px;font-weight:700}.sheet-status-filter-row{overflow:visible}@media(max-width:640px){.fixture-shell{padding:10px 0}.sheet-panel{border-left:0;border-right:0;border-radius:0}.fixture-head{align-items:flex-start;flex-wrap:wrap;padding:12px}.fixture-head>div{width:100%}.fixture-search{margin-left:0;width:min(100%,260px);flex:1}.fixture-list li{padding:12px}.fixture-foot{padding:12px}}
</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const cssPath = "app/(app)/db-sheet/db-sheet.css";

const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'none'; font-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'");
  if (request.method !== "GET") {
    response.writeHead(405);
    return response.end("Synthetic fixture is read-only");
  }
  if (pathname === "/app.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    return response.end(readFileSync(join(output, "app.js")));
  }
  if (pathname === "/db-sheet.css") {
    response.setHeader("Content-Type", "text/css; charset=utf-8");
    return response.end(readFileSync(cssPath));
  }
  if (pathname === "/" || pathname === "/db-sheet") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.end(html);
  }
  response.writeHead(404);
  response.end("Not found");
});

server.listen(0, "127.0.0.1", () => {
  console.log(`MOCKUP_URL=http://127.0.0.1:${server.address().port}/db-sheet`);
});

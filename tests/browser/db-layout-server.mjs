// Actual RowForm + production CSS; synthetic local state, no API or credentials.
import { context } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
const dir = mkdtempSync(join(tmpdir(), "salespt-db-layout-"));
const bundle = await context({ entryPoints: ["tests/browser/db-layout-fixture.tsx"], bundle: true, outfile: join(dir, "app.js"), platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' } });
await bundle.rebuild();
await bundle.watch();
const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
if (css.status !== 0) throw new Error(css.stderr);
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DB 폼 검증</title><link rel="stylesheet" href="/style.css"><body class="bg-gray-50"><div id="root"></div><script src="/app.js"></script></body></html>';
const server = createServer((req, res) => {
  if (req.url === "/app.js" || req.url === "/style.css") {
    res.setHeader("Content-Type", req.url.endsWith(".js") ? "text/javascript" : "text/css");
    return res.end(readFileSync(join(dir, req.url.slice(1))));
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html);
});
server.listen(0, "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}`));

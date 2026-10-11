// 업체정보 이메일 칸 목업 서버 — 실제 컴포넌트(esbuild 번들) + 실제 Tailwind CSS + (있으면) 운영 빌드 글꼴.
// 데이터는 fixture 안의 합성 값뿐이고 API·인증·DB·시트 호출은 없다(/api/* 는 모두 404 JSON — 페이지는 부르지 않는다).
// 실행: node tests/browser/company-info-email-server.mjs  → http://127.0.0.1:<port>
// 시나리오: ?email=<값> · ?empty=1 · ?view=all|filled|empty (fixture 머리 주석 참조)
import { context } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";

const dir = mkdtempSync(join(tmpdir(), "salespt-company-info-email-"));
const bundle = await context({
  entryPoints: ["tests/browser/company-info-email-fixture.tsx"],
  bundle: true,
  outfile: join(dir, "app.js"),
  platform: "browser",
  jsx: "automatic",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  // OCR 실행기는 파일을 읽을 때만 dynamic import — 목업은 이미지 OCR 을 돌리지 않으므로 번들에서 뺀다.
  external: ["tesseract.js", "pdfjs-dist"],
  logLevel: "warning",
});
await bundle.rebuild();
await bundle.watch(); // 컴포넌트를 고치면 새로고침만 하면 된다.

const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
if (css.status !== 0) throw new Error(css.stderr);

// 운영 빌드(.next)가 있으면 같은 Noto Sans KR 글꼴을 쓴다. 없으면 시스템 글꼴로 띄우고 알린다.
let fontCss = "";
const media = new Map();
if (existsSync(".next/static/css") && existsSync(".next/static/media")) {
  const built = readdirSync(".next/static/css").filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(".next/static/css", f), "utf8")).join("\n");
  const faces = (built.match(/@font-face\{[^}]+\}/g) ?? []).filter((s) => s.includes("Noto")).join("\n");
  const family = faces.match(/font-family:([^;]+);/)?.[1];
  if (family) {
    fontCss = faces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/") + `:root{--font-noto-sans-kr:${family}}`;
    for (const f of readdirSync(".next/static/media")) media.set("/media/" + f, join(".next/static/media", f));
  }
}
if (!fontCss) console.warn("[company-info-email] .next 글꼴이 없어 시스템 글꼴로 보여요(npm run build 뒤에는 운영 글꼴).");

const html =
  '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  "<title>업체정보 이메일 칸 합성 목업</title>" +
  '<link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css">' +
  '<body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ error: "목업에는 서버 API 가 없어요(합성 데이터만)." }));
  }
  if (url.pathname === "/app.js" || url.pathname === "/style.css") {
    res.setHeader("Content-Type", url.pathname.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(readFileSync(join(dir, url.pathname.slice(1))));
  }
  if (url.pathname === "/font.css") {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    return res.end(fontCss);
  }
  const font = media.get(url.pathname);
  if (font) {
    res.setHeader("Content-Type", "font/woff2");
    return res.end(readFileSync(font));
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
});
server.listen(0, "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}`));

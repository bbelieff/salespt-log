/**
 * 사업계획서 작성도구 라이브 셸 목업 서버(localhost 전용). node tests/browser/bizplan-live/server.mjs
 * 실제 사이드바·헤더·글꼴 + 합성 본문. /api 는 가상 값. 제공사·DB 호출 없음.
 * 글꼴은 이 작업 폴더나 메인 체크아웃의 .next 빌드 산출물에서 읽는다(없으면 시스템 글꼴).
 */
import { context } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";

const dir = mkdtempSync(join(tmpdir(), "bizplan-live-"));
const nav = `import React,{useSyncExternalStore} from 'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);export const go=p=>{history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'))};export const useRouter=()=>({push:go,replace:go,refresh:()=>{},prefetch:()=>{}});export const useSearchParams=()=>new URLSearchParams(location.search);export default function Link({href,children,...p}){return <a {...p} href={href}>{children}</a>}`;
const mocks = { "next-auth/react": `export const signOut=()=>{};export const useSession=()=>({data:null});` };
const ctx = await context({
  entryPoints: ["tests/browser/bizplan-live/App.tsx"], bundle: true, outfile: join(dir, "app.js"), platform: "browser", jsx: "automatic", logLevel: "warning",
  external: ["tesseract.js", "pdfjs-dist/*"], define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "mock", setup(b) {
    b.onResolve({ filter: /.*/ }, a => {
      if (mocks[a.path]) return { path: a.path, namespace: "mock" };
      if (/^next\/(link|navigation)$/.test(a.path)) return { path: "navigation", namespace: "mock" };
      if (a.path.endsWith("auth/RoleViewSwitch")) return { path: "role", namespace: "mock" };
      if (a.path.endsWith("announcements/AnnouncementsGate")) return { path: "ann", namespace: "mock" };
    });
    b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({
      contents: a.path === "navigation" ? nav
        : a.path === "role" ? `export default function RoleViewSwitch(){return null};export const useTrainerState=()=>({data:{canStudent:true,canTrainer:false}});`
        : a.path === "ann" ? `export const ANNOUNCEMENTS_SEEN_EVENT='mock-ann';export const hasUnseenUpdates=()=>false;export default function AnnouncementsGate(){return null};`
        : mocks[a.path],
      loader: "tsx", resolveDir: process.cwd(),
    }));
  } }],
});
await ctx.rebuild();
await ctx.watch();

const css = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css"), "--content", "app/**/*.{ts,tsx},components/**/*.{ts,tsx},lib/**/*.{ts,tsx},tests/browser/bizplan-live/**/*.{ts,tsx}"], { encoding: "utf8" });
if (css.status !== 0) throw new Error(css.stderr);

const nextDir = [".next", "../../../.next"].map(p => resolve(p)).find(p => existsSync(join(p, "static/css")) && existsSync(join(p, "static/media")));
let fontCss = "";
const media = new Map();
if (nextDir) {
  const built = readdirSync(join(nextDir, "static/css")).filter(f => f.endsWith(".css")).map(f => readFileSync(join(nextDir, "static/css", f), "utf8")).join("\n");
  const faces = (built.match(/@font-face\{[^}]+\}/g) || []).filter(s => s.includes("Noto")).join("\n");
  const family = faces.match(/font-family:([^;]+);/)?.[1];
  if (family) fontCss = faces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/") + `:root{--font-noto-sans-kr:${family}}`;
  for (const f of readdirSync(join(nextDir, "static/media"))) media.set("/media/" + f, join(nextDir, "static/media", f));
}

const KIT = { ready: true, builder: { name: "사업계획서빌더_v4.8_2in1.md", version: "4.8", updatedAt: "2026-11-23T08:58:12Z", size: 193936 }, clinic: { name: "현장클리닉_보고서_양식.docx", version: "", updatedAt: "2026-11-23T08:58:16Z", size: 120 }, interview: { name: "팩트파인딩_인터뷰지_양식.docx", version: "", updatedAt: "2026-11-23T08:58:19Z", size: 120 }, folderUrl: "https://drive.google.com/drive/folders/mock" };
// 공식 파일 내용은 가상 글자(실제 빌더는 목업에 넣지 않는다).
const KIT_FILE = { "/api/bizplan/kit/builder": "# 가상 빌더 v4.8 (목업)", "/api/bizplan/kit/clinic": "가상 현장클리닉 양식", "/api/bizplan/kit/interview": "가상 인터뷰지 양식" };
const api = path => (path === "/api/me" ? { name: "연습사용자", cohort: "12", email: "mock@example.invalid", sessionRole: "student", courseStartISO: "2026-09-01", feedbackFolderId: "mock-folder", driveLinkStatus: "ok" } : path === "/api/bizplan/kit" ? (process.env.NO_KIT ? { ready: false, builder: null, clinic: null, interview: null } : KIT) : {});
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>사업계획서 작성도구 — 라이브 셸 목업</title><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><body class="bg-slate-100 font-sans antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';
createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (KIT_FILE[path]) { res.setHeader("Content-Type", "application/octet-stream"); res.end(KIT_FILE[path]); return; }
  if (path.startsWith("/api/")) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(req.method === "GET" ? api(path) : { ok: true })); return; }
  const file = media.get(path) ?? { "/app.js": join(dir, "app.js"), "/app.css": join(dir, "app.css"), "/style.css": join(dir, "style.css") }[path];
  res.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript;charset=utf-8" : path.endsWith(".css") ? "text/css;charset=utf-8" : path.endsWith(".woff2") ? "font/woff2" : "text/html;charset=utf-8");
  if (path === "/font.css") return res.end(fontCss);
  if (file) return res.end(existsSync(file) ? readFileSync(file) : "");
  const pub = resolve("public" + decodeURIComponent(path));
  if (pub.startsWith(resolve("public")) && /\.(png|svg|webp|jpg|ico)$/.test(pub) && existsSync(pub)) {
    res.setHeader("Content-Type", { png: "image/png", svg: "image/svg+xml", webp: "image/webp", jpg: "image/jpeg", ico: "image/x-icon" }[pub.split(".").pop()]);
    return res.end(readFileSync(pub));
  }
  res.end(html);
}).listen(Number(process.env.PORT || 0), "127.0.0.1", function () { console.log(`BIZPLAN_LIVE http://127.0.0.1:${this.address().port}/work-tools/business-plan${nextDir ? "" : " (글꼴 없음: npm run build 필요)"}`); });

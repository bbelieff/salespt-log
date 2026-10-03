// 수리3 레이아웃 회귀 — 실제 컴포넌트/CSS + 합성 API. 운영 인증·DB·개인정보 미사용.
// QA_TOOLS_DIR 은 playwright 를 담은 외부 도구 디렉터리(제품 의존성 아님)를 가리킨다.
// 실행: QA_TOOLS_DIR=<도구경로> node tests/browser/trainer-admin-shell-browser.mjs
import { build } from "esbuild";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const toolsDir = process.env.QA_TOOLS_DIR;
assert.ok(toolsDir, "QA_TOOLS_DIR 필요 — playwright 를 담은 외부 도구 디렉터리");
const { chromium } = createRequire(resolve(toolsDir, "package.json"))("playwright");

const EVIDENCE = "docs/qa/trainer-admin-shell-evidence";
const VIEWPORTS = [
  { name: "pc", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const dir = mkdtempSync(join(tmpdir(), "trainer-admin-shell-"));
mkdirSync(EVIDENCE, { recursive: true });

await build({
  entryPoints: ["tests/browser/trainer-admin-shell-fixture.tsx"],
  bundle: true,
  outfile: join(dir, "app.js"),
  platform: "browser",
  jsx: "automatic",
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  plugins: [{
    name: "fixture-next",
    setup(b) {
      // next/link·navigation 은 앱 라우터 런타임 없이는 동작하지 않아 스텁으로 대체한다.
      b.onResolve({ filter: /^next\/(navigation|link)$/ }, a => ({ path: a.path, namespace: "fx" }));
      b.onLoad({ filter: /.*/, namespace: "fx" }, a => ({
        contents: a.path.endsWith("navigation")
          ? "export const useRouter=()=>({push:p=>{window.__lastNav=p},refresh:()=>{}}); export const usePathname=()=>'/trainer'; export const useSearchParams=()=>new URLSearchParams();"
          : 'import React from "react"; export default function Link({href,children,...rest}){return React.createElement("a",{...rest,href,onClick:e=>{e.preventDefault();window.__lastNav=href}},children)}',
        loader: "js",
        resolveDir: process.cwd(),
      }));
      // 세션 종료·PostHog 는 브라우저 픽스처에서 부작용만 있으므로 no-op.
      b.onResolve({ filter: /^next-auth\/react$/ }, a => ({ path: a.path, namespace: "fx-noop" }));
      b.onLoad({ filter: /.*/, namespace: "fx-noop" }, () => ({
        contents: "export const signOut=async()=>{}; export const useSession=()=>({data:null});",
        loader: "js",
        resolveDir: process.cwd(),
      }));
    },
  }],
});

const tailwind = spawnSync(
  process.execPath,
  ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")],
  { encoding: "utf8" },
);
assert.equal(tailwind.status, 0, tailwind.stderr);

// 운영 빌드의 실제 루트 폰트를 재사용한다 — 브라우저 기본 폰트로는 줄바꿈/높이가 달라진다.
const builtCss = readdirSync(".next/static/css").filter(f => f.endsWith(".css"))
  .map(f => readFileSync(join(".next/static/css", f), "utf8")).join("\n");
const fontFaces = (builtCss.match(/@font-face\{[^}]+\}/g) ?? []).filter(s => s.includes("Noto")).join("\n");
const fontFamily = fontFaces.match(/font-family:([^;]+);/)?.[1];
assert.ok(fontFamily, "next build 를 먼저 실행해 루트 폰트 자산을 공급하세요");
const fontCss = fontFaces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/")
  + ":root{--font-noto-sans-kr:" + fontFamily + "}";
const mediaFiles = new Map(readdirSync(".next/static/media").map(n => ["/media/" + n, join(".next/static/media", n)]));

const invitations = [
  { id: "inv-1", recipient_email: "trainer9@example.com", expires_at: "2030-01-01T00:00:00.000Z", accepted_at: null, revoked_at: null },
  { id: "inv-2", recipient_email: "trainer8@example.com", expires_at: "2030-01-01T00:00:00.000Z", accepted_at: "2026-09-01T00:00:00.000Z", revoked_at: null },
];
const api = {
  "/api/me": { email: "admin@example.com", name: "테스트 관리자", cohort: "관리", spreadsheetId: "", isAdmin: true, sessionRole: "admin", impersonating: null },
  "/api/announcements": { latestPr: 0, items: [] },
  "/api/trainer/recruitment": { status: "active", name: "테스트 트레이너", canTrainer: true, canStudent: true, impersonating: null, invitations },
  "/api/admin/trainer-access": { people: [] },
};
const html = '<!doctype html><html lang="ko"><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css">'
  + '<body class="min-h-dvh bg-gray-50 font-sans text-slate-900 antialiased">'
  + '<div id="root"></div><script src="/app.js"></script></body></html>';

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path.startsWith("/api/")) {
    if (req.method === "POST") for await (const _ of req) { /* 본문 소비 */ }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(api[path] ?? { invitations }));
  }
  if (mediaFiles.has(path)) {
    res.setHeader("Content-Type", "font/woff2");
    return res.end(readFileSync(mediaFiles.get(path)));
  }
  if (path === "/font.css") { res.setHeader("Content-Type", "text/css"); return res.end(fontCss); }
  res.setHeader("Content-Type", path === "/app.js" ? "application/javascript" : path === "/style.css" ? "text/css" : "text/html");
  res.end(path === "/app.js" ? readFileSync(join(dir, "app.js"))
    : path === "/style.css" ? readFileSync(join(dir, "style.css")) : html);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;

const results = [];
function check(id, ok, detail) {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("pageerror", e => consoleErrors.push(String(e)));

    // ---------- /admin/trainers ----------
    await page.goto(`${base}/?fixture=admin`, { waitUntil: "load" });
    await page.waitForSelector('[data-qa="invites"] details', { timeout: 15000 });
    await page.waitForSelector('[data-qa="access-editor"] *', { timeout: 15000 });
    await page.waitForTimeout(300);
    const a = await page.evaluate(() => {
      const r = el => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, width: b.width, height: b.height };
      };
      const invites = document.querySelector('[data-qa="invites"] details');
      const accessWrap = document.querySelector('[data-qa="access-editor"]');
      const access = accessWrap?.firstElementChild ?? null;
      const sticky = document.querySelector('[data-qa="mgmt-panel"] header.sticky');
      let maxRight = -Infinity, offender = "";
      for (const el of accessWrap?.querySelectorAll("*") ?? []) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.right > maxRight) {
          maxRight = b.right;
          offender = `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 20)}"`;
        }
      }
      return {
        invites: r(invites), access: r(access), sticky: r(sticky),
        accessTag: access ? access.tagName.toLowerCase() : null,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        maxRight: maxRight === -Infinity ? null : maxRight, offender,
      };
    });
    assert.ok(a.invites, "초대 카드(details) 미발견 — 픽스처가 렌더되지 않았습니다");
    assert.ok(a.access, "권한 편집기 첫 자식 미발견");
    check(`A1[${vp.name}]`, Math.abs(a.invites.left - a.access.left) <= 1,
      `invites.left=${a.invites.left.toFixed(1)} access.left=${a.access.left.toFixed(1)} (<${a.accessTag}>)`);
    check(`A2[${vp.name}]`, Math.abs(a.invites.width - a.access.width) <= 1,
      `invites.w=${a.invites.width.toFixed(1)} access.w=${a.access.width.toFixed(1)}`);
    const centerDev = vp.name === "pc" ? Math.abs(a.invites.left - (a.innerWidth - a.invites.width) / 2) : 0;
    check(`A3[${vp.name}]`, a.invites.left > 0 && centerDev <= 2,
      `left=${a.invites.left.toFixed(1)} innerWidth=${a.innerWidth} centerDev=${centerDev.toFixed(1)}`);
    check(`A4[${vp.name}]`, a.scrollWidth <= a.innerWidth + 1,
      `scrollWidth=${a.scrollWidth} innerWidth=${a.innerWidth}`);
    check(`A5[${vp.name}]`, a.maxRight !== null && a.maxRight <= a.innerWidth + 1,
      `maxRight=${a.maxRight?.toFixed(1)} innerWidth=${a.innerWidth} 최우측=${a.offender}`);
    check(`A6[${vp.name}]`, a.sticky !== null && Math.abs(a.sticky.left) <= 1 && Math.abs(a.sticky.width - a.innerWidth) <= 2,
      a.sticky ? `sticky.left=${a.sticky.left.toFixed(1)} w=${a.sticky.width.toFixed(1)} innerWidth=${a.innerWidth}` : "sticky 헤더 미발견");
    await page.screenshot({ path: join(EVIDENCE, `admin-${vp.name}.png`), fullPage: true });

    // ---------- /trainer ----------
    await page.goto(`${base}/?fixture=trainer`, { waitUntil: "load" });
    await page.waitForSelector('[data-qa="weekly-goal"]', { timeout: 15000 });
    await page.waitForSelector('[data-qa="invites"] details', { timeout: 15000 });
    await page.waitForTimeout(300);
    const read = () => page.evaluate(() => {
      const r = el => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, top: b.top, width: b.width, height: b.height };
      };
      const details = document.querySelector('[data-qa="invites"] details');
      const summary = document.querySelector('[data-qa="invites"] summary');
      const pill = Array.from(document.querySelectorAll("a")).find(el => (el.textContent ?? "").includes("마스터 메뉴")) ?? null;
      const emailInput = document.querySelector('[data-qa="invites"] input[type="email"]');
      const emailRect = emailInput?.getBoundingClientRect();
      return {
        goal: r(document.querySelector('[data-qa="weekly-goal"]')),
        details: r(details),
        open: details ? details.open : null,
        summaryText: summary ? (summary.textContent ?? "") : null,
        summaryVisible: summary
          ? Array.from(summary.querySelectorAll("span"))
            .filter(s => getComputedStyle(s).display !== "none")
            .map(s => (s.textContent ?? "").trim()).join("|")
          : null,
        bodyText: document.body.innerText ?? "",
        pill: r(pill),
        emailVisible: !!emailRect && emailRect.width > 0 && emailRect.height > 0,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    const t0 = await read();
    assert.ok(t0.goal && t0.details, "주간목표 카드 또는 초대 카드 미발견");
    check(`B1[${vp.name}]`, Math.abs(t0.goal.left - t0.details.left) <= 1 && Math.abs(t0.goal.width - t0.details.width) <= 1,
      `goal(left=${t0.goal.left.toFixed(1)},w=${t0.goal.width.toFixed(1)}) invites(left=${t0.details.left.toFixed(1)},w=${t0.details.width.toFixed(1)})`);
    check(`B2[${vp.name}]`, t0.goal.left > 0, `goal.left=${t0.goal.left.toFixed(1)}`);
    check(`B3a[${vp.name}]`, t0.open === false && t0.details.height <= 60,
      `open=${t0.open} collapsed height=${t0.details.height.toFixed(1)} (<=60 기대)`);
    check(`B4a[${vp.name}]`, (t0.summaryVisible ?? "").includes("펼치기 ▾") && !(t0.summaryVisible ?? "").includes("접기 ▴"),
      `보이는 summary span=${JSON.stringify(t0.summaryVisible)}`);
    check(`B5[${vp.name}]`, /수락 대기\s*1/.test(t0.bodyText),
      `접힘 상태 body 에 "수락 대기 1" ${/수락 대기\s*1/.test(t0.bodyText) ? "있음" : "없음"}`);
    check(`B6[${vp.name}]`, t0.pill !== null && t0.pill.top < t0.goal.top,
      t0.pill ? `pill.top=${t0.pill.top.toFixed(1)} goal.top=${t0.goal.top.toFixed(1)}` : "마스터 메뉴 알약 미발견");
    check(`B7a[${vp.name}]`, t0.scrollWidth <= t0.innerWidth + 1,
      `scrollWidth=${t0.scrollWidth} innerWidth=${t0.innerWidth}`);
    await page.screenshot({ path: join(EVIDENCE, `trainer-${vp.name}-collapsed.png`), fullPage: true });

    await page.click('[data-qa="invites"] summary');
    await page.waitForFunction(() => document.querySelector('[data-qa="invites"] details')?.open === true, { timeout: 5000 });
    await page.waitForTimeout(300);
    const t1 = await read();
    check(`B3b[${vp.name}]`, t1.details.height > t0.details.height + 1 && t1.emailVisible,
      `expanded height=${t1.details.height.toFixed(1)} (접힘 ${t0.details.height.toFixed(1)}) 이메일입력 보임=${t1.emailVisible}`);
    check(`B4b[${vp.name}]`, (t1.summaryVisible ?? "").includes("접기 ▴") && !(t1.summaryVisible ?? "").includes("펼치기 ▾"),
      `보이는 summary span=${JSON.stringify(t1.summaryVisible)}`);
    check(`B7b[${vp.name}]`, t1.scrollWidth <= t1.innerWidth + 1,
      `scrollWidth=${t1.scrollWidth} innerWidth=${t1.innerWidth}`);
    await page.screenshot({ path: join(EVIDENCE, `trainer-${vp.name}-expanded.png`), fullPage: true });

    check(`X[${vp.name}]`, consoleErrors.length === 0, `런타임 에러 ${consoleErrors.length}건 ${consoleErrors.slice(0, 2).join(" / ")}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(x => !x.ok);
console.log(`\nTOTAL ${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log("FAILED: " + failed.map(f => f.id).join(", "));
process.exit(failed.length ? 1 : 0);

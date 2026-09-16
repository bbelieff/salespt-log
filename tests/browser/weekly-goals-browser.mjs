// Real React components + local in-memory API; not production auth/DB/live Notion verification.
// QA_TOOLS_DIR points to an external tooling install containing playwright. No production credentials.
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { privateRegressions } from "./weekly-goals-private-browser.mjs";
import { build } from "esbuild";
const requireTools = createRequire(resolve(process.env.QA_TOOLS_DIR, "package.json"));
const { chromium } = requireTools("playwright");
const dir = mkdtempSync(join(tmpdir(), "weekly-goals-browser-"));
const output = resolve("docs/qa/weekly-goals-evidence");
mkdirSync(output, { recursive: true });
await build({
  entryPoints: ["tests/browser/weekly-goals-fixture.tsx"], bundle: true, outfile: join(dir, "app.js"),
  platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-next", setup(b) {
    // Unchanged header/closed ledger are outside this dashboard placement fixture.
    b.onResolve({ filter: /^@\/components\/(TopHeader|dashboard\/expense-ledger\/ExpenseLedgerDialog)$/ }, args => ({ path: args.path, namespace: "fixture-shell" }));
    b.onLoad({ filter: /.*/, namespace: "fixture-shell" }, args => ({ contents: args.path.endsWith("TopHeader") ? 'import React from "react"; export default function Shell(){return <header style={{height:96}}>대시보드</header>}' : "export default function Shell(){return null}", loader: "jsx", resolveDir: process.cwd() }));
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
      contents: args.path.endsWith("navigation") ? "export const useRouter=()=>({push:p=>{window.__lastNav=p}}); export const usePathname=()=>new URLSearchParams(location.search).get('entry')||'/dashboard';" :
        'import React from "react"; export default function Link({href,children,...rest}){return React.createElement("a",{...rest,href,onClick:e=>{e.preventDefault();window.__lastNav=href}},children)}',
      loader: "js", resolveDir: process.cwd(),
    }));
  }}],
});
const tailwind = spawnSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", join(dir, "style.css")], { encoding: "utf8" });
assert.equal(tailwind.status, 0, tailwind.stderr);
// Reuse the built Next root font assets and body classes, not the browser's fixture default font.
const builtCss = readdirSync(".next/static/css").filter(f => f.endsWith(".css"))
  .map(f => readFileSync(join(".next/static/css", f), "utf8")).join("\n");
const fontFaces = (builtCss.match(/@font-face\{[^}]+\}/g) ?? []).filter(s => s.includes("Noto")).join("\n");
const fontFamily = fontFaces.match(/font-family:([^;]+);/)?.[1];
assert.ok(fontFamily, "Run next build first to supply the actual root font assets");
const fontCss = fontFaces.replaceAll("../media/", "/media/").replaceAll("/_next/static/media/", "/media/") + ':root{--font-noto-sans-kr:' + fontFamily + '}';
const mediaFiles = new Map(readdirSync(".next/static/media").map(name => ["/media/" + name, join(".next/static/media", name)]));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/font.css"><link rel="stylesheet" href="/style.css"><body class="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased"><div id="root"></div><script src="/app.js"></script></body></html>';
const server = createServer((req, res) => {
  const file = req.url?.split("?")[0];
  if (mediaFiles.has(file)) { res.setHeader("Content-Type", "font/woff2"); return res.end(readFileSync(mediaFiles.get(file))); }
  if (file === "/font.css") { res.setHeader("Content-Type", "text/css"); return res.end(fontCss); }
  res.setHeader("Content-Type", file === "/app.js" ? "application/javascript" : file === "/style.css" ? "text/css" : "text/html");
  res.end(file === "/app.js" ? readFileSync(join(dir, "app.js")) : file === "/style.css" ? readFileSync(join(dir, "style.css")) : html);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [], errors = [];
const goals = { production: null, inflow: 0, contacts: 5, meetings: 2, contracts: 1 };
const records = new Map();
const internal = new Map();
const privateSteps = [];
let failRead = false, denyRead = false, failSave = false, saves = 0, privateReads = 0;
const empty = () => ({ goals: { ...goals }, task: "", revision: 0, updatedAt: null });
const dates = { 1: ["2026-09-04", "2026-09-10"], 2: ["2026-09-11", "2026-09-17"], 3: ["2026-09-18", "2026-09-24"] };
const view = (week, student = "fixture@example.invalid", role = "trainer") => {
  const item = w => ({ week: w, start: dates[w][0], end: dates[w][1], record: records.get(student + w) ?? empty(),
    actuals: { production: 12, inflow: 4, contacts: 3, meetings: 2, contracts: 1 } });
  return { student: { email: student, name: "가상 수강생", cohort: "연습", courseStart: dates[1][0], region: "테스트지역", trainers: ["가상 트레이너"] },
    current: item(week), previous: week > 1 ? item(week - 1) : null, canReadInternal: role !== "student" };
};
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/contract-payment**", route => route.fulfill({ json: { rows: [] } }));
  await page.route("**/api/me", route => route.fulfill({ json: {courseStartISO: "2026-09-04", graduationISO: "2026-10-24"} }));
  await page.route("**/api/dashboard", route => route.fulfill({ json: {
    kpi: { 총매출: 12000000, 총비용: 3000000, 수임비합: 8000000, 수수료합: 4000000, 이월매출: 2000000, 전체매출: 14000000, 이월비용: 100000, 전체비용: 3100000 },
    additionalCost: { dbCostTotal: 2000000, additionalCost: 1000000, status: "available" },
    channelMatrix: [], weeklyTrend: [], costBreakdown: [],
  } }));
  await page.route("**/api/weekly-goals**", async route => {
    const request = route.request(), url = new URL(request.url()), week = Number(url.searchParams.get("week") || 2);
    const student = url.searchParams.get("student") || "fixture@example.invalid", key = student + week;
    const role = new URL(page.url()).searchParams.get("role") || "trainer";
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (denyRead) return reply({ error: "권한이 변경됐어요." }, 403);
    if (url.pathname.endsWith("/overview")) return reply([{ email: student, name: "가상 수강생", cohort: "연습", week: 2, record: records.get(key) ?? empty(), error: null }]);
    const isPrivate = url.pathname.endsWith("/internal");
    if (isPrivate) { privateReads++; if (role === "student") return reply({ error: "금지" }, 403); }
    if (isPrivate && privateSteps.length) return privateSteps.shift()(route);
    if (request.method() === "PUT") {
      saves++;
      if (failSave) return reply({ error: "충돌: 입력을 보관해 주세요." }, 409);
      const body = request.postDataJSON(), map = isPrivate ? internal : records;
      const previous = map.get(key);
      if (body.revision !== (previous?.revision ?? 0)) return reply({ error: "충돌" }, 409);
      map.set(key, { ...body, revision: body.revision + 1, updatedAt: null });
      return reply({ revision: body.revision + 1 });
    }
    if (failRead) return reply({ error: "조회 실패: 다시 시도해 주세요." }, 503);
    return reply(isPrivate ? internal.get(key) ?? { specialNotes: "", priorOutcome: "", revision: 0, updatedAt: null } : view(week, student, role));
  });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("heading", { name: "이번 주 목표·PT과제" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => [...document.fonts].some(f => f.family.includes("Noto") && f.status === "loaded")), true);
  await page.getByLabel("이번 주 PT과제", { exact: true }).fill("첫 과제\n둘째 과제 <script>alert(1)</script>");
  await page.getByLabel("생산", { exact: true }).fill("20");
  assert.equal(await page.getByRole("button", { name: "목표·PT과제 복사", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("저장됐어요.", { exact: true }).waitFor();
  assert.equal(records.get("fixture@example.invalid2").goals.production, 20);
  assert.equal(records.get("fixture@example.invalid2").goals.inflow, 0);
  assert.equal(await page.getByRole("cell", { name: "20", exact: true }).count(), 1);
  results.push("desktop-save-comparison-null-zero");
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
  await page.getByLabel("트레이닝 후 특이사항", { exact: true }).fill("INTERNAL_ONLY\n<unsafe>");
  await page.getByLabel("지난주 PT과제 성과", { exact: true }).fill("PRIVATE_OUTCOME");
  await page.getByRole("button", { name: "성과·기록 저장" }).click();
  await page.waitForFunction(() => !document.querySelector("button")?.disabled);
  await page.getByRole("button", { name: "회의록 미리보기" }).click();
  assert.equal(await page.locator('textarea[aria-label^="회의록 "]').count(), 14);
  await page.getByLabel("회의록 이번주 PT과제").fill("미리보기 수정\n줄바꿈");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "회의록용 복사", exact: true }).click();
  const fallback = page.getByLabel("직접 선택하여 복사");
  await fallback.waitFor();
  assert.equal((await fallback.inputValue()).split("\t").length, 14);
  results.push("internal-save-editable-preview-14-columns-fallback");
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  assert.equal(await page.getByText("INTERNAL_ONLY").count(), 0);
  assert.equal(await page.locator('textarea[aria-label^="회의록 "]').count(), 0);
  await page.getByRole("button", { name: "목표·PT과제 복사", exact: true }).click();
  assert.equal((await fallback.inputValue()).includes("INTERNAL_ONLY"), false);
  results.push("together-public-copy-no-private");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, "desktop.png"), fullPage: true });
  await page.getByLabel("이번 주 PT과제", { exact: true }).fill("미저장 유지");
  await page.getByRole("button", { name: "다음 주", exact: true }).click();
  await page.getByRole("button", { name: /계속|취소|머무/ }).last().click();
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "미저장 유지");
  results.push("dirty-week-navigation-cancel-preserves-draft");
  const historyUrl = page.url();
  await page.evaluate(() => window.history.pushState({}, "", "?history-test=1"));
  page.once("dialog", dialog => dialog.dismiss());
  await page.goBack();
  assert.equal(page.url(), historyUrl);
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "미저장 유지");
  results.push("native-history-cancel-preserves-draft");
  failRead = true;
  await page.evaluate(() => window.dispatchEvent(new Event("weekly-goals-saved")));
  await page.getByText("조회 실패: 다시 시도해 주세요.", { exact: false }).waitFor();
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "미저장 유지");
  assert.equal(await page.getByRole("button", { name: "목표·PT과제 복사", exact: true }).isDisabled(), true);
  failRead = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  results.push("background-read-failure-preserves-draft-blocks-stale-copy");
  failSave = true;
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("충돌: 입력을 보관해 주세요.", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "미저장 유지");
  failSave = false;
  results.push("save-conflict-preserves-draft-and-saved-data");
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("저장됐어요.", { exact: true }).waitFor();
  await page.reload();
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "미저장 유지");
  results.push("reload-persistence");
  await page.getByRole("button", { name: "이전 주", exact: true }).click();
  await page.getByText("첫 주예요.", { exact: false }).waitFor();
  for (const label of ["생산", "유입", "컨택완료", "미팅완료", "계약"]) await page.getByLabel(label, { exact: true }).fill("");
  await page.getByLabel("이번 주 PT과제", { exact: true }).fill("정량 없이 첫 주 과제");
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("저장됐어요.", { exact: true }).waitFor();
  assert.ok(Object.values(records.get("fixture@example.invalid1").goals).every(v => v === null));
  assert.equal(records.get("fixture@example.invalid2").task, "미저장 유지");
  results.push("week-one-task-only-week-isolation");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("이번 주 PT과제", { exact: true }).fill("모바일 긴 과제 ".repeat(50));
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("저장됐어요.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const inputBoxes = await Promise.all(["생산", "유입", "컨택완료", "미팅완료", "계약"].map(label => page.getByLabel(label, { exact: true }).boundingBox()));
  assert.ok(inputBoxes.every(b => b.height >= 44 && Math.abs(b.y - inputBoxes[0].y) < 1));
  const ringBoxes = await page.getByLabel("주간 목표 실적").locator("svg").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
  assert.equal(new Set(ringBoxes).size, 1);
  results.push("mobile-five-inputs-and-five-rings-single-row-44px");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, "mobile.png"), fullPage: true });
  results.push("mobile390-input-no-overflow");
  const reads = privateReads;
  await page.goto(base + "/?role=student");
  await page.getByRole("heading", { name: "이번 주 목표·PT과제" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "트레이너 기록 열기" }).count(), 0);
  assert.equal(privateReads, reads);
  assert.equal((await page.content()).includes("INTERNAL_ONLY"), false);
  assert.equal((await page.content()).includes("PRIVATE_OUTCOME"), false);
  results.push("student-no-private-request-or-dom");
  await page.goto(base + "/?mode=summary");
  await page.getByRole("button", { name: "목표·PT과제 열기", exact: true }).first().waitFor();
  assert.equal(await page.getByRole("region", { name: "주간 목표", exact: true }).count(), 3);
  assert.equal(await page.getByLabel("주간 목표 실적").count(), 0);
  results.push("three-tabs-compact-summary-no-duplicate-rings");
  await page.getByLabel("업무 입력", { exact: true }).fill("업무 미저장");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "목표·PT과제 열기" }).nth(i).click();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    assert.equal(await page.getByLabel("업무 입력", { exact: true }).inputValue(), "업무 미저장");
  }
  await page.getByRole("button", { name: "목표·PT과제 열기" }).first().click();
  await page.getByRole("button", { name: "💾 저장하고 이동" }).click();
  assert.ok((await page.evaluate(() => window.__lastNav)).startsWith("/weekly-goals"));
  await page.getByLabel("업무 입력", { exact: true }).fill("업무 버릴 초안");
  await page.getByRole("button", { name: "목표·PT과제 열기" }).first().click();
  await page.getByRole("button", { name: "무시하고 이동" }).click();
  assert.equal(await page.getByLabel("업무 입력", { exact: true }).inputValue(), "업무 미저장");
  results.push("business-summary-entry-shared-dirty-guard-cancel-save-discard");
  await page.goto(base + "/?mode=overview");
  await page.getByRole("heading", { name: "담당 수강생 주간 목표" }).waitFor();
  await page.getByRole("button", { name: "가상 수강생 · 연습" }).click();
  await page.getByLabel("주간 목표 실적").waitFor();
  results.push("trainer-overview-and-detail-entry");
  records.set("fixture@example.invalid1", { ...empty(), goals: { ...goals, production: 7 }, task: "지난 과제 보존", revision: 1 });
  await page.goto(base);
  const beforeImport = structuredClone(records.get("fixture@example.invalid2")), beforeWrites = saves;
  await page.getByRole("button", { name: "지난주 목표·과제 가져오기" }).click();
  assert.equal(await page.getByLabel("생산", { exact: true }).inputValue(), "7");
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "지난 과제 보존");
  assert.equal(saves, beforeWrites);
  assert.deepEqual(records.get("fixture@example.invalid2"), beforeImport);
  await page.getByLabel("생산", { exact: true }).fill("99");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "지난주 목표·과제 가져오기" }).click();
  assert.equal(await page.getByLabel("생산", { exact: true }).inputValue(), "99");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "지난주 목표·과제 가져오기" }).click();
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("저장됐어요.", { exact: true }).waitFor();
  assert.equal(records.get("fixture@example.invalid1").revision, 1);
  results.push("previous-import-draft-only-confirm-and-week-isolation");
  const beforeProposal = saves;
  await page.getByRole("button", { name: "역산 제안", exact: true }).click();
  await page.getByLabel("제안 계약 목표").fill("2");
  await page.getByRole("button", { name: "제안 미리보기" }).click();
  await page.getByRole("button", { name: "제안 취소" }).click();
  assert.equal(await page.getByLabel("생산", { exact: true }).inputValue(), "7");
  await page.getByRole("button", { name: "역산 제안", exact: true }).click();
  await page.getByLabel("제안 계약 목표").fill("2147483647");
  await page.getByRole("button", { name: "제안 미리보기" }).click();
  await page.getByText(/제안 목표가 저장 가능한 범위/).waitFor();
  await page.getByLabel("제안 계약 목표").fill("2");
  await page.getByRole("button", { name: "제안 미리보기" }).click();
  await page.getByLabel("생산", { exact: true }).fill("88");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "초안에 적용" }).click();
  assert.equal(await page.getByLabel("생산", { exact: true }).inputValue(), "88");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "초안에 적용" }).click();
  assert.equal(await page.getByLabel("생산", { exact: true }).inputValue(), "30");
  assert.equal(await page.getByLabel("유입", { exact: true }).inputValue(), "25");
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).inputValue(), "지난 과제 보존");
  assert.equal(saves, beforeProposal);
  await page.getByLabel("생산", { exact: true }).fill("31");
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.getByText("저장됐어요.", { exact: true }).waitFor();
  assert.equal(records.get("fixture@example.invalid2").goals.production, 31);
  results.push("proposal-preview-cancel-overflow-dirty-confirm-edit-explicit-save");
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
  await page.getByLabel("트레이닝 후 특이사항", { exact: true }).waitFor();
  denyRead = true;
  await page.evaluate(() => window.dispatchEvent(new Event("weekly-goals-saved")));
  await page.getByText("권한이 변경됐어요.").waitFor();
  assert.equal(await page.getByLabel("트레이닝 후 특이사항", { exact: true }).count(), 0);
  assert.equal((await page.content()).includes("INTERNAL_ONLY"), false);
  denyRead = false;
  results.push("permission-revocation-removes-cached-private-editor");
  await page.goto(base);
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
  await page.getByLabel("트레이닝 후 특이사항", { exact: true }).waitFor();
  const beforeDenied = structuredClone(records.get("fixture@example.invalid2"));
  await page.getByLabel("이번 주 PT과제", { exact: true }).fill("권한 회수 뒤 저장 금지");
  denyRead = true;
  await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('textarea[aria-label="트레이닝 후 특이사항"]'));
  assert.deepEqual(records.get("fixture@example.invalid2"), beforeDenied);
  assert.equal((await page.content()).includes("INTERNAL_ONLY"), false);
  denyRead = false;
  results.push("denied-public-save-refetches-access-removes-private-no-write");
  await page.goto(base);
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
  await page.getByLabel("트레이닝 후 특이사항", { exact: true }).fill("권한 회수 뒤 내부 저장 금지");
  const beforePrivateDenied = structuredClone(internal.get("fixture@example.invalid2"));
  denyRead = true;
  await page.getByRole("button", { name: "성과·기록 저장", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('textarea[aria-label="트레이닝 후 특이사항"]'));
  assert.deepEqual(internal.get("fixture@example.invalid2"), beforePrivateDenied);
  assert.equal((await page.content()).includes("INTERNAL_ONLY"), false);
  denyRead = false;
  results.push("denied-private-save-clears-private-draft-and-copy-no-write");
  await privateRegressions({ page, base, privateSteps, internal, records, results, setPublicDenied: value => { denyRead = value; } });
  records.set("fixture@example.invalid2", {...records.get("fixture@example.invalid2"), goals: {...goals}});
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    for (const [href, label] of [["/dashboard", "대시보드"], ["/trainer/weekly-goals", "담당 수강생"]]) {
      await page.goto(base + "/?role=trainer&returnTo=" + encodeURIComponent(href));
      await page.getByRole("button", { name: "← " + label, exact: true }).click();
      assert.equal(await page.evaluate(() => window.__lastNav), href);
    }
    await page.goto(base + "/?mode=summary&entry=/contact");
    await page.getByRole("button", { name: "목표·PT과제 열기", exact: true }).first().click();
    assert.equal(new URL(await page.evaluate(() => window.__lastNav), base).searchParams.get("returnTo"), "/contact");
    results.push("entry-aware-return-and-summary-link-" + width);
    for (const host of ["db", "contact", "schedule"]) {
      const region = page.getByTestId(host + "-goal-host").getByRole("region", { name: "주간 목표", exact: true });
      await region.getByText("2주 목표", { exact: true }).waitFor();
      const box = await region.boundingBox();
      assert.ok(box.height <= (width === 390 ? 100 : 60), host + " compact height " + box.height);
      assert.ok((await region.getByRole("button").boundingBox()).height >= 44);
    }
    assert.ok(await page.getByTestId("contact-goal-host").getByLabel("컨택완료 실적 3, 목표 5, 60%", { exact: true }).isVisible());
    assert.ok(await page.getByTestId("schedule-goal-host").getByLabel("미팅완료 실적 2, 목표 2, 달성", { exact: true }).isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, "compact-tabs-" + width + ".png"), fullPage: true });
    results.push("compact-tabs-inside-existing-summaries-touch-and-overflow-" + width);
    await page.goto(base + "/?mode=dashboard");
    await page.getByRole("heading", { name: "생산성 지표", exact: true }).waitFor();
    const summary = page.getByRole("region", { name: "주간 목표", exact: true });
    await summary.getByText(/2026-09-11/).waitFor();
    const placement = await summary.evaluate(el => {
      const previous = el.previousElementSibling;
      return { afterProductivity: previous?.textContent.includes("생산성 지표"), below: previous && el.getBoundingClientRect().top >= previous.getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(placement.afterProductivity, true);
    assert.equal(placement.below, true);
    assert.equal(placement.overflow, false);
    const goalBox = await summary.boundingBox();
    const usableHeight = width === 390 ? 784 : 768;
    console.log("goal-first-screen", width, goalBox);
    await page.screenshot({ path: join(output, "first-screen-" + width + ".png") });
    assert.ok(goalBox.y + goalBox.height <= usableHeight, "Goal rings must fit before scrolling: " + JSON.stringify(goalBox));
    results.push("dashboard-first-screen-goals-" + width);
    const financialDetails = page.getByLabel("영업이익과 매출·비용 상세", { exact: true });
    await financialDetails.click();
    assert.ok(await page.getByText("₩14,000,000", { exact: true }).isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await financialDetails.click();
    results.push("financial-details-retain-values-and-no-overflow-" + width);
    await page.screenshot({ path: join(output, "dashboard-" + width + ".png"), fullPage: true });
    results.push("dashboard-goals-below-productivity-" + width);
  }
  await page.goto(base);
  await page.getByRole("button", { name: "PT과제 성과 기록", exact: true }).click();
  const priorTask = structuredClone(records.get("fixture@example.invalid1"));
  await page.getByLabel("지난주 PT과제 성과", { exact: true }).fill("1주 과제 수행 완료 · 소개 요청 3회");
  await page.getByRole("button", { name: "성과·기록 저장", exact: true }).click();
  await page.getByText("성과·기록을 저장했어요.", { exact: true }).waitFor();
  assert.equal(internal.get("fixture@example.invalid2").priorOutcome, "1주 과제 수행 완료 · 소개 요청 3회");
  assert.deepEqual(records.get("fixture@example.invalid1"), priorTask);
  await page.reload();
  await page.getByRole("button", { name: "PT과제 성과 기록", exact: true }).click();
  await page.getByLabel("지난주 PT과제 성과", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("지난주 PT과제 성과", { exact: true }).inputValue(), "1주 과제 수행 완료 · 소개 요청 3회");
  await page.getByRole("button", { name: "다음 주", exact: true }).click();
  await page.getByRole("button", { name: "PT과제 성과 기록", exact: true }).click();
  await page.getByLabel("지난주 PT과제 성과", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("지난주 PT과제 성과", { exact: true }).inputValue(), "");
  await page.getByLabel("지난주 PT과제 성과", { exact: true }).fill("2주 과제 별도 성과");
  await page.getByRole("button", { name: "성과·기록 저장", exact: true }).click();
  await page.getByText("성과·기록을 저장했어요.", { exact: true }).waitFor();
  assert.equal(internal.get("fixture@example.invalid3").priorOutcome, "2주 과제 별도 성과");
  assert.equal(internal.get("fixture@example.invalid2").priorOutcome, "1주 과제 수행 완료 · 소개 요청 3회");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, "pt-outcome-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: join(output, "pt-outcome-desktop.png"), fullPage: true });
  results.push("next-week-outcome-save-reload-and-week-isolation");
  await page.goto(base);
  await page.getByRole("button", { name: "트레이너 기록 열기", exact: true }).click();
  await page.getByRole("button", { name: "회의록 미리보기", exact: true }).click();
  assert.equal(await page.getByLabel("회의록 지역", { exact: true }).inputValue(), "테스트지역");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    write: async items => { window.__richCopy = {html: await (await items[0].getType("text/html")).text(),plain: await (await items[0].getType("text/plain")).text()}; }
  } }));
  await page.getByRole("button", { name: "회의록용 복사", exact: true }).click();
  await page.getByText("복사됨", { exact: true }).waitFor();
  const rich = await page.evaluate(() => window.__richCopy);
  assert.equal((rich.html.match(/<tr>/g) ?? []).length, 1);
  assert.equal((rich.html.match(/<td>/g) ?? []).length, 14);
  assert.equal(/<th[ >]|<thead/.test(rich.html), false);
  assert.equal(rich.plain.split("\t").length, 14);
  results.push("browser-rich-clipboard-data-only-fourteen-cells-and-prefilled-region");
  failRead = true;
  await page.goto(base + "/?role=student");
  await page.getByText("조회 실패: 다시 시도해 주세요.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "목표·PT과제 저장", exact: true }).count(), 0);
  results.push("initial-read-failure-no-false-empty-save");
  assert.deepEqual(errors, []);
  writeFileSync(join(output, "browser-result.json"), JSON.stringify({ results, count: results.length, saves, pageErrors: errors, productionAuth: "NOT_RUN", notionPaste: "NOT_RUN" }, null, 2));
  console.log(JSON.stringify({ pass: results.length, results, errors, output }));
} finally { await browser.close(); server.close(); }

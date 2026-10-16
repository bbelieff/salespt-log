import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const toolsDir = process.env.QA_TOOLS_DIR;
assert.ok(toolsDir, "QA_TOOLS_DIR 필요 — playwright가 설치된 외부 도구 디렉터리");
const { chromium } = createRequire(import.meta.url)(join(toolsDir, "node_modules", "playwright"));
const evidenceDir = resolve(process.env.EVIDENCE_DIR || join(tmpdir(), "salespt-db-sheet-status-view-chips-r1"));
mkdirSync(evidenceDir, { recursive: true });

const child = spawn(process.execPath, ["tests/browser/db-sheet-status-view-chips/server.mjs"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
});
const serverUrl = await new Promise((resolveUrl, reject) => {
  const timeout = setTimeout(() => reject(new Error("fixture server start timeout")), 60_000);
  let output = "";
  child.stdout.on("data", chunk => {
    output += chunk;
    const match = output.match(/MOCKUP_URL=(\S+)/);
    if (match) { clearTimeout(timeout); resolveUrl(match[1]); }
  });
  child.stderr.on("data", chunk => { output += chunk; });
  child.on("exit", code => { if (code) { clearTimeout(timeout); reject(new Error(`fixture server exited ${code}: ${output}`)); } });
});

const viewports = [
  { name: "pc", width: 1280, height: 800 },
  { name: "430", width: 430, height: 860 },
  { name: "375", width: 375, height: 820 },
  { name: "320", width: 320, height: 760 },
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const writeRequests = [];
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writeRequests.push(`${request.method()} ${request.url()}`); });
    await page.goto(serverUrl, { waitUntil: "networkidle" });

    assert.equal(await page.getByRole("group", { name: "DB 상태 필터" }).count(), 1);
    const chips = page.getByRole("button").filter({ has: page.locator(".sheet-status-chip-check") });
    assert.equal(await chips.count(), 5);
    assert.deepEqual(await chips.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))), ["false", "false", "false", "false", "false"]);
    const metrics = await page.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      chipHeights: [...document.querySelectorAll(".sheet-status-chip")].map(node => node.getBoundingClientRect().height),
      chipTops: [...new Set([...document.querySelectorAll(".sheet-status-chip")].map(node => Math.round(node.getBoundingClientRect().top)))],
    }));
    assert.ok(metrics.scrollWidth <= metrics.clientWidth, `${viewport.name}: horizontal overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
    assert.ok(metrics.chipHeights.every(height => height >= (viewport.width <= 640 ? 44 : 36)), `${viewport.name}: touch target`);
    if (viewport.width <= 430) assert.ok(metrics.chipTops.length >= 2, `${viewport.name}: chips must wrap`);

    await chips.nth(1).click();
    await chips.nth(4).click();
    assert.deepEqual(await page.locator(".fixture-list li").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-result"))), ["부재", "컨택진행", "상담 후 거절"]);
    assert.equal(await page.getByTestId("filtered-count").textContent(), "3");
    for (const index of [0, 2, 3]) await chips.nth(index).click();
    assert.equal(await page.locator(".fixture-list li").count(), 7);
    assert.equal(await page.locator('[data-result="새 결과"]').count(), 1);
    assert.equal(await page.locator(".sheet-status-filter-summary").textContent(), "전체 표시");
    await page.getByRole("button", { name: "초기화" }).click();
    assert.deepEqual(await chips.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))), ["false", "false", "false", "false", "false"]);
    await chips.first().focus();
    await page.keyboard.press("Space");
    assert.equal(await chips.first().getAttribute("aria-pressed"), "true");
    assert.equal(writeRequests.length, 0);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(evidenceDir, `status-chips-${viewport.name}.png`), fullPage: true });
    results.push({ viewport: `${viewport.width}x${viewport.height}`, wraps: metrics.chipTops.length, minTouch: Math.min(...metrics.chipHeights), xOverflow: metrics.scrollWidth - metrics.clientWidth });
    await context.close();
  }

  const stateContext = await browser.newContext({ viewport: { width: 375, height: 820 } });
  const statePage = await stateContext.newPage();
  for (const [mode, role, text] of [["loading", "status", "불러오는 중"], ["error", "alert", "불러오지 못했습니다"], ["empty", null, "표시할 DB가 없습니다"]]) {
    await statePage.goto(`${serverUrl}?mode=${mode}`, { waitUntil: "networkidle" });
    assert.equal(await statePage.getByRole("group", { name: "DB 상태 필터" }).count(), 1);
    const locator = role ? statePage.getByRole(role) : statePage.getByText(text);
    await assert.doesNotReject(() => locator.waitFor());
    assert.ok((await locator.textContent()).includes(text));
  }
  await stateContext.close();
} finally {
  await browser.close();
  child.kill();
}

console.log(JSON.stringify({ result: "PASS", syntheticOnly: true, writeRequests: 0, evidenceDir, viewports: results }, null, 2));

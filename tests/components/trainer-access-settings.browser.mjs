// Real React editor, synthetic HTTP store. No production users/auth/credentials.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { build } from "esbuild";
const requireTools = createRequire(resolve(process.env.QA_TOOLS_DIR, "package.json"));
const { chromium } = requireTools("playwright");
const output = resolve("docs/qa/trainer-access-settings"); mkdirSync(output, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), "trainer-access-browser-"));
await build({ entryPoints: ["tests/components/trainer-access-settings-fixture.tsx"], outfile: join(dir, "app.js"),
  bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' } });
const defaults = grade => ({ active: { read: !!grade, write: !!grade }, arena: { read: grade === "senior", write: grade === "senior" }, archived: { read: grade === "senior", write: grade === "senior" } });
let people = ["senior", "regular", "apprentice", null].map((grade, i) => ({ email: `fixture-${i}@example.test`, name: i < 2 ? "동명이인" : `합성 트레이너 ${i}`, status: "active", grade, grants: defaults(grade), version: grade ? 1 : 0 }));
let getCount = 0, putCount = 0, failPut = 0, failNextGet = false, failAfterSave = false;
const bodies = [];
const approvedFont = process.env.QA_APPROVED_MOCKUP
  ? (readFileSync(process.env.QA_APPROVED_MOCKUP, "utf8").match(/@font-face\{[^}]+\}/g) ?? []).join("\n") : "";
const server = createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/app.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(readFileSync(join(dir, "app.js"))); }
  if (path === "/api/admin/trainer-access") {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET") {
      getCount++;
      if (failNextGet) { failNextGet = false; res.statusCode = 503; return res.end('{}'); }
      return res.end(JSON.stringify({ trainers: people }));
    }
    if (req.method === "PUT") {
      putCount++; let text = ""; for await (const chunk of req) text += chunk;
      const input = JSON.parse(text); bodies.push(input);
      if (failPut) { res.statusCode = failPut; failPut = 0; return res.end('{}'); }
      const current = people.find(p => p.email === input.email);
      if (input.version !== current.version) { res.statusCode = 409; return res.end('{}'); }
      Object.assign(current, input, { grants: current.grade === input.grade ? input.grants : defaults(input.grade), version: current.version + 1 });
      if (failAfterSave) { failNextGet = true; failAfterSave = false; }
      return res.end('{"saved":true}');
    }
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + approvedFont + 'body{margin:0;background:#f7f9fb;font-family:"Mockup Noto",Arial,sans-serif}#root{max-width:1112px;margin:auto;padding:12px}button,input,select{font:inherit}</style><div id="root"></div><script src="/app.js"></script></html>');
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = []; page.on("pageerror", err => errors.push(err.message));
const url = `http://127.0.0.1:${server.address().port}`;
let assertions = 0;
function equal(actual, expected) { assertions++; assert.deepEqual(actual, expected); }
async function checked(name, value) { equal(await page.getByRole("checkbox", { name, exact: true }).isChecked(), value); }
async function submit() {
  await page.getByRole("button", { name: "변경사항 저장", exact: true }).click();
  equal(await page.getByRole("dialog").isVisible(), true);
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "등급 기본값으로" }).waitFor();
  await page.waitForFunction(() => document.querySelector('.trainer-access').getAttribute('aria-busy') === 'false');
}
try {
  await page.goto(url); await page.getByLabel("트레이너 등급").waitFor();
  await checked("아레나 조회", true);
  await page.getByRole("checkbox", { name: "아레나 조회", exact: true }).uncheck(); await checked("아레나 수정", false);
  await page.getByRole("checkbox", { name: "아레나 수정", exact: true }).check(); await checked("아레나 조회", true);
  await page.getByRole("checkbox", { name: "아레나 수정", exact: true }).uncheck();
  await page.getByRole("button", { name: "변경 취소" }).click(); await checked("아레나 수정", true);
  await page.getByRole("checkbox", { name: "아레나 수정", exact: true }).uncheck();
  await page.getByRole("button", { name: "등급 기본값으로" }).click(); await checked("아레나 수정", true);
  await page.getByRole("checkbox", { name: "아레나 수정", exact: true }).uncheck();
  await page.getByRole("button", { name: "변경사항 저장", exact: true }).click();
  await page.keyboard.press("Escape"); equal(await page.getByRole("dialog").isVisible(), false); equal(putCount, 0);
  const readsBefore = getCount; await submit();
  equal(putCount, 1); equal(getCount, readsBefore + 1); await checked("아레나 수정", false);
  equal(Object.keys(bodies[0]).sort(), ["email", "grade", "grants", "version"]);
  equal(await page.getByRole("button", { name: "변경사항 저장", exact: true }).isDisabled(), true);
  await page.getByLabel("트레이너 등급").selectOption("regular"); await checked("아레나 조회", false); await checked("보관 수정", false);
  await submit(); equal(people[0].grade, "regular"); equal(people[0].grants, defaults("regular"));
  await page.getByRole("checkbox", { name: "활성 수정", exact: true }).uncheck(); failPut = 503;
  await submit(); await checked("활성 수정", false); equal(await page.getByRole("alert").isVisible(), true);
  equal(await page.getByRole("button", { name: "변경사항 저장", exact: true }).isEnabled(), true);
  failPut = 409; await submit(); await checked("활성 수정", false);
  equal((await page.getByRole("alert").textContent()).includes("다른 변경사항"), true);
  failAfterSave = true; const beforeSave = putCount; await submit();
  equal(putCount, beforeSave + 1); equal(await page.getByRole("button", { name: "변경사항 저장", exact: true }).isDisabled(), true);
  await checked("활성 수정", false); await page.getByRole("button", { name: "저장 결과 다시 조회" }).click();
  await page.getByText("저장한 권한을 다시 확인했습니다.").waitFor(); equal(putCount, beforeSave + 1);
  // Same display name, exact distinct email selection, no broad default for unclassified.
  await page.getByRole("button", { name: /fixture-1@example.test/ }).click(); equal(await page.getByLabel("트레이너 등급").inputValue(), "regular");
  await page.getByRole("button", { name: /fixture-3@example.test/ }).click(); equal(await page.getByLabel("트레이너 등급").inputValue(), ""); await checked("활성 조회", false);
  await page.getByLabel("트레이너 등급").selectOption("apprentice"); await submit(); equal(people[3].grade, "apprentice"); equal(people[1].version, 1);
  // Dirty selection confirmation preserves rejected navigation.
  await page.getByRole("checkbox", { name: "활성 수정", exact: true }).uncheck();
  page.once("dialog", d => d.dismiss()); await page.getByRole("button", { name: /fixture-0@example.test/ }).click(); await checked("활성 수정", false);
  await page.getByRole("button", { name: "변경 취소" }).click();
  const widths = [];
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth); equal(scroll, width); widths.push({ width, scrollWidth: scroll });
    const boxes = await page.locator('.permission-savebar button').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height)); equal(boxes.every(h => h >= 44), true);
    await page.screenshot({ path: join(output, `editor-${width}.png`), fullPage: true });
  }
  await page.goto(url + "?readonly"); await page.getByLabel("트레이너 등급").waitFor(); equal(await page.getByLabel("트레이너 등급").isDisabled(), true);
  equal(await page.getByRole("button", { name: "등급 기본값으로" }).isDisabled(), true);
  equal(errors, []);
  const result = { result: "PASS", assertions, widths, requests: { GET: getCount, PUT: putCount }, reactErrors: errors, syntheticOnly: true };
  writeFileSync(join(output, "browser-result.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }); }

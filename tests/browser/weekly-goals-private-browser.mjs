// Synthetic browser privacy regressions. No production accounts, DB, or clipboard preservation.
import assert from "node:assert/strict";
export async function privateRegressions({ page, base, privateSteps, internal, records, results, setPublicDenied }) {
  const target = "fixture@example.invalid2";
  const field = () => page.getByLabel("트레이닝 후 특이사항", { exact: true });
  const reload = () => page.getByRole("button", { name: "내부 기록 최신 내용 불러오기", exact: true });
  const denied = (status = 403) => route => route.fulfill({ status, contentType: "text/html", body: "" });
  const open = async () => {
    await page.goto(base);
    await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
    await field().waitFor();
  };
  const noPrivate = async () => {
    await page.waitForFunction(() => !document.querySelector('textarea[aria-label="트레이닝 후 특이사항"]'));
    assert.equal(await page.locator('textarea[aria-label^="회의록 "]').count(), 0);
    const html = await page.content();
    assert.equal(html.includes("INTERNAL_ONLY"), false);
    assert.equal(html.includes("PRIVATE_OUTCOME"), false);
    assert.equal(html.includes("RACE_OLD_PRIVATE"), false);
  };
  const preview = async () => {
    await page.getByRole("button", { name: "회의록 미리보기" }).click();
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
    await page.getByRole("button", { name: "회의록용 복사", exact: true }).click();
    assert.ok((await page.getByLabel("직접 선택하여 복사").last().inputValue()).includes("INTERNAL_ONLY"));
  };
  await open(); await preview();
  privateSteps.push(denied());
  await reload().click(); await noPrivate();
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "저장하지 않고 나갈까요?" }).count(), 0);
  privateSteps.push(denied());
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
  await page.getByText("접근 권한을 다시 확인해 주세요.", { exact: true }).waitFor();
  await noPrivate();
  // Explicit fresh revalidation can restore access; it does not reuse the denied state.
  await reload().click(); await field().waitFor();
  results.push("clean-private-nonjson403-clears-preview-fallback-public-stays-explicit-revalidation");

  await field().fill("UNSAVED_PRIVATE_401");
  const before401 = structuredClone(internal.get(target));
  privateSteps.push(denied(401));
  await page.getByRole("button", { name: "내부 기록 저장", exact: true }).click();
  await noPrivate(); assert.deepEqual(internal.get(target), before401);
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "저장하지 않고 나갈까요?" }).count(), 0);
  assert.equal((await page.content()).includes("UNSAVED_PRIVATE_401"), false);
  results.push("dirty-private-empty401-clears-registration-and-saved-copy-without-write");

  await open(); await field().fill("PRIVATE_DENIED_BEFORE_DISCARD");
  const beforeDiscard = structuredClone(internal.get(target));
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  privateSteps.push(denied());
  await page.getByRole("button", { name: "💾 저장하고 이동", exact: true }).click();
  await page.getByText("1건 저장 실패 — 다시 시도해주세요", { exact: true }).waitFor();
  await noPrivate();
  await page.getByRole("button", { name: "무시하고 이동", exact: true }).click();
  await noPrivate();
  assert.equal((await page.content()).includes("PRIVATE_DENIED_BEFORE_DISCARD"), false);
  assert.deepEqual(internal.get(target), beforeDiscard);
  results.push("dirty-private-PUT403-then-dirtyguard-discard-never-restores-saved-copy");

  await open();
  const beforeFailures = structuredClone(internal.get(target));
  await field().fill("UNSAVED_PRIVATE_CONTROL");
  privateSteps.push(route => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "fixture conflict" }) }));
  await page.getByRole("button", { name: "내부 기록 저장", exact: true }).click();
  await page.getByText("fixture conflict", { exact: true }).waitFor();
  assert.equal(await field().inputValue(), "UNSAVED_PRIVATE_CONTROL");
  privateSteps.push(route => route.fulfill({ status: 503, contentType: "text/html", body: "" }));
  page.once("dialog", dialog => dialog.accept());
  await reload().click();
  await page.getByText("응답을 확인하지 못했어요. 다시 시도해 주세요.", { exact: true }).waitFor();
  assert.equal(await field().inputValue(), "UNSAVED_PRIVATE_CONTROL");
  assert.deepEqual(internal.get(target), beforeFailures);
  assert.equal(await page.getByRole("button", { name: "회의록 미리보기" }).isDisabled(), true);
  results.push("private409-and503-preserve-draft-and-saved-data-block-stale-copy");

  // Ignore transport abort deliberately: generation must reject A even if fetch still resolves.
  const ignoreAbort = () => page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, init) => original(url, { ...init, signal: undefined });
  });
  const delayed = () => {
    let release, started;
    const arrived = new Promise(resolve => { started = resolve; });
    privateSteps.push(async route => {
      started(); await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ specialNotes: "RACE_OLD_PRIVATE", priorOutcome: "RACE_OLD_PRIVATE", revision: 1, updatedAt: null }) });
    });
    return { arrived, release: async () => {
      const received = page.waitForResponse(response => response.url().includes("/internal") && response.status() === 200);
      release(); await received;
      // Flush response.json promise/React commit after the intercepted response is delivered.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    } };
  };
  await open(); await ignoreAbort(); await preview();
  const oldReload = delayed();
  await reload().click(); await oldReload.arrived;
  privateSteps.push(denied()); await reload().click();
  await noPrivate(); await oldReload.release(); await noPrivate();
  results.push("late-private-A200-after-B403-cannot-resurrect-preview-or-record");

  await page.goto(base); await ignoreAbort();
  const oldInitial = delayed();
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click(); await oldInitial.arrived;
  await page.getByRole("button", { name: "함께 보기", exact: true }).click();
  privateSteps.push(denied());
  await page.getByRole("button", { name: "트레이너 기록 열기" }).click();
  await page.getByText("접근 권한을 다시 확인해 주세요.", { exact: true }).waitFor();
  await oldInitial.release(); await noPrivate();
  results.push("late-initial-private-effect-after-unmount-and-new-denial-is-ignored");

  await open(); await preview();
  const beforePublic = structuredClone(records.get(target));
  setPublicDenied(true);
  await page.evaluate(() => window.dispatchEvent(new Event("weekly-goals-saved")));
  await page.getByText("권한이 변경됐어요.", { exact: false }).waitFor();
  await noPrivate();
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).count(), 0);
  setPublicDenied(false);
  const background = page.waitForResponse(response => response.url().includes("/api/weekly-goals?") && response.status() === 200);
  await page.evaluate(() => window.dispatchEvent(new Event("weekly-goals-saved"))); await background;
  assert.equal(await page.getByLabel("이번 주 PT과제", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await page.getByLabel("이번 주 PT과제", { exact: true }).waitFor();
  assert.deepEqual(records.get(target), beforePublic);
  await noPrivate(); // Revalidated public view defaults to Together, not an old private preview.
  results.push("public-denial-with-open-private-preview-locks-target-until-explicit-revalidation");
}

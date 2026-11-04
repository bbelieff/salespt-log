/** 0015_contact_scripts + repo/service — 계정마다 한 벌, 고치면 그 글로, 되돌리면 기본 대본. 가상 이메일만. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true, getDbPool: () => holder.db }));

import { getContactScript, resetContactScript, saveContactScript } from "@/service/contact-script";
import { DEFAULT_CONTACT_SCRIPT, DEFAULT_CONTACT_SMS } from "@/config/contact-script";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  const sql = readFileSync("lib/repo/db/migrations/0015_contact_scripts.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql);
  holder.db = db;
}, 60000);
afterAll(async () => { await db?.close(); });

describe("컨택 대본 저장", () => {
  it("고친 적 없으면 기본 대본", async () => {
    expect(await getContactScript("a@example.test")).toEqual({ script: DEFAULT_CONTACT_SCRIPT, sms: DEFAULT_CONTACT_SMS, custom: false });
  });
  it("저장하면 다음에 그 글로 열린다(대소문자 무관), 다른 계정은 그대로", async () => {
    await saveContactScript("A@example.test", { script: "내 대본", sms: "내 문자" });
    await saveContactScript("a@example.test", { script: "고친 대본", sms: "고친 문자" });
    expect(await getContactScript("a@example.test")).toEqual({ script: "고친 대본", sms: "고친 문자", custom: true });
    expect((await getContactScript("b@example.test")).custom).toBe(false);
  });
  it("기본 대본으로 되돌리면 내 줄만 지운다", async () => {
    await saveContactScript("b@example.test", { script: "b", sms: "b" });
    expect((await resetContactScript("a@example.test")).custom).toBe(false);
    expect((await getContactScript("a@example.test")).script).toBe(DEFAULT_CONTACT_SCRIPT);
    expect((await getContactScript("b@example.test")).script).toBe("b");
  });
});

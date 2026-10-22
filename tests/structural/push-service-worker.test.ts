/**
 * web-push-notifications §5-1 — 서비스워커는 푸시 전용이다.
 * fetch 처리기(빈 것 포함)는 페이지 이동마다 워커를 깨워 로딩을 늦추고(BBE-242), 받은 푸시는
 * 반드시 알림을 띄워야 한다(안 띄우면 Safari 가 권한을 회수).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sw = readFileSync(join(__dirname, "..", "..", "public", "sw.js"), "utf8");

describe("public/sw.js", () => {
  it("registers no fetch handler and uses no cache storage", () => {
    expect(sw).not.toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(sw).not.toMatch(/\bonfetch\b/);
    expect(sw).not.toMatch(/\bcaches\./);
  });
  it("always shows a notification for a push", () => {
    expect(sw).toMatch(/addEventListener\(\s*["']push["'][\s\S]*showNotification\(/);
  });
});

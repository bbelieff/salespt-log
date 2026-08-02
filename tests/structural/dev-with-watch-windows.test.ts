import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(process.cwd(), "scripts/dev-with-watch.mjs"), "utf8");

describe("dev-with-watch Windows launcher", () => {
  it("uses a shell only for the Windows .cmd launcher and keeps the console hidden", () => {
    expect(SOURCE).toContain('const isWindows = process.platform === "win32";');
    expect(SOURCE).toContain('isWindows ? "npx.cmd" : "npx"');
    expect(SOURCE).toContain('{ stdio: "inherit", shell: isWindows, windowsHide: true }');
  });

  it.runIf(process.platform === "win32")("launches npx.cmd without EINVAL on Windows", () => {
    const result = spawnSync("npx.cmd", ["--version"], {
      encoding: "utf8",
      shell: true,
      windowsHide: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\./);
  });
});

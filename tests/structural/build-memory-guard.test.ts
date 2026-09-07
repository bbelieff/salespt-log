/**
 * 빌드 메모리 가드 — 2026-09-07 배포 실패 재발 방지.
 *
 * ## 무엇이 터졌나
 * VPS 빌드가 `--max-old-space-size=2048` 에서 힙을 터뜨렸다
 * (`FATAL ERROR: Reached heap limit` → 스택 최상단 `JsonStringify`). 재시도도 같은 자리에서
 * 실패 — 마진 문제가 아니라 빌드가 실제로 2GB 를 넘긴 것이었다.
 *
 * ## 왜 힙을 안 올렸나
 * 이 레포에서 **이미 반증된 처방**이다. RAM 3.8GB VPS 라 4096 으로 올렸더니 OOM-killer 가
 * 프로세스를 죽여 **BUILD_ID 누락 silent failure** 를 냈다(2026-05-13, deploy.yml 주석에 박제).
 * 그래서 한도를 올리는 대신 **일을 줄였다.**
 *
 * ## 무엇을 줄였나 — 만들어서 버리던 소스맵
 * `SENTRY_AUTH_TOKEN` 이 없으면 소스맵은 **업로드되지 않고**, `hideSourceMaps: true` 라
 * 사용자에게 **제공되지도 않는다**. 즉 만들어서 버리고 있었다 — 끄면 잃는 관측성이 0 이다.
 * 토큰을 넣는 순간 자동으로 다시 켜진다.
 *
 * 실측: 이 변경 전 로컬 2048MB 빌드 OOM → 변경 후 같은 조건에서 통과.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const config = readFileSync("next.config.mjs", "utf8");
const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");

describe("★빌드가 2GB 안에 들어오게 유지한다", () => {
  it("★토큰이 없으면 소스맵을 아예 만들지 않는다", () => {
    expect(config).toContain("sourcemaps: { disable: !sentryUploadEnabled }");
    expect(config).toContain("const sentryUploadEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN)");
  });

  it("★토큰이 있으면 다시 켜진다 — 껐다는 걸 잊어도 자동 복원", () => {
    // disable 이 상수 true 로 굳으면 토큰을 넣어도 안 켜진다. 그 회귀를 막는다.
    expect(config).not.toContain("sourcemaps: { disable: true }");
  });

  it("★VPS 빌드 힙 한도는 2048 유지 — 올리면 OOM-killer(2026-05-13 사고)", () => {
    expect(deploy).toContain("--max-old-space-size=2048");
    expect(deploy).not.toContain("--max-old-space-size=4096");
  });
});

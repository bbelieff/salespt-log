import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 실제 PG 경합 테스트가 pg_ctl 을 직접 fast stop 하면 57P01 unhandled error 로 check.sh 가
// 간헐 실패한다(2026-09-27·28 두 번, 파일만 달랐다). 정지는 tests/repo/pg-test-server.ts 한 곳에서만.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("PG 테스트 정지는 공용 헬퍼로만", () => {
  it("테스트 파일이 pg_ctl stop 을 직접 부르지 않는다", () => {
    const offenders = walk("tests")
      .filter((p) => !p.replace(/\\/g, "/").endsWith("tests/repo/pg-test-server.ts") && !p.includes("structural"))
      .filter((p) => /"pg_ctl"[\s\S]{0,200}"stop"/.test(readFileSync(p, "utf8")));
    expect(offenders, "❌ pg_ctl stop 을 직접 호출 — tests/repo/pg-test-server.ts 의 stopTestPostgres 를 쓰세요").toEqual([]);
  });
});

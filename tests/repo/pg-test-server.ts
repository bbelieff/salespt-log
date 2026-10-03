import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * 테스트용 임시 PostgreSQL 을 안전하게 끈다 — 실제 PG 경합 테스트의 afterAll 전용.
 *
 * `pool.end()` 는 클라이언트 소켓이 실제로 닫히기 전에 끝난다. 그 직후 `pg_ctl -m fast` 로
 * 끄면 아직 나가는 중인 세션이 FATAL 57P01(admin shutdown)을 받고 vitest 가 unhandled error 로
 * 잡아 check.sh 가 실패한다(2026-09-27 autosave · 2026-09-28 trainer-recruitment, 테스트는 전부 통과).
 * smart 는 세션이 다 나갈 때까지 기다린다. 막힌 세션이 있어도 teardown 이 걸리지 않게 10초 뒤 fast 로 폴백.
 * 새 PG 테스트는 pg_ctl stop 을 직접 부르지 말고 이 함수를 쓴다(tests/structural/pg-test-teardown.test.ts).
 */
export function stopTestPostgres(bin: string, dataDir: string): void {
  const stop = (mode: "smart" | "fast") =>
    execFileSync(join(bin, "pg_ctl"), ["-D", dataDir, "-m", mode, "-t", "10", "-w", "stop"], { stdio: "pipe" });
  try { stop("smart"); } catch { stop("fast"); }
}

/**
 * Layer: repo — 배포와 간편인증의 약속(deploy.yml · scripts/ops/simple-auth-drain.mjs).
 * - `.deploy/simple-auth-draining`: 배포가 만든다 → 곧 PM2 재시작이니 새 승인 대기를 시작하지 않는다.
 * - `.deploy/simple-auth-active.json`: 앱이 쓴다 → 메모리에서 진행 중인 간편인증 수와 늦어도 끝날 시각({ n, until, at }). 배포는 0이 될 때까지 기다린다.
 *   DB 를 거치지 않는다(2026-11-11 실측: 세션 풀러가 꽉 차 배포 쪽 조회가 안 될 때가 있음).
 * 위치는 앱 실행 폴더(/opt/salespt-log) 기준. 로컬·CI 에서는 폴더가 없으면 쓰지 않는다. 실패해도 조용히 넘어간다.
 */
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SIMPLE_AUTH_DRAIN_FILE = ".deploy/simple-auth-draining";
export const SIMPLE_AUTH_ACTIVE_FILE = ".deploy/simple-auth-active.json";

export function simpleAuthDraining(): boolean {
  try { return existsSync(join(process.cwd(), SIMPLE_AUTH_DRAIN_FILE)); } catch { return false; }
}

/** n = 진행 중 작업 수, until = 그 작업들이 늦어도 끝날 시각(ms). 배포는 n>0 이고 until 전이면 기다린다. */
export function reportSimpleAuthActive(n: number, until: number): void {
  try {
    const dir = join(process.cwd(), ".deploy");
    if (!existsSync(dir)) return;
    const file = join(process.cwd(), SIMPLE_AUTH_ACTIVE_FILE);
    writeFileSync(`${file}.tmp`, JSON.stringify({ n, until, at: Date.now(), pid: process.pid }));
    renameSync(`${file}.tmp`, file);
  } catch { /* 배포 대기는 부가 기능 — 앱 동작은 막지 않는다 */ }
}

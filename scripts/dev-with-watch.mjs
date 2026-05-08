#!/usr/bin/env node
/**
 * scripts/dev-with-watch.mjs
 *
 * Cross-platform (Windows/PowerShell + macOS + Linux + Git Bash) 호환 dev 런처.
 * Hashimoto 가드 — dev server가 origin/master 뒤처지지 않게 자동 sync.
 *
 * 동작:
 *   - Next.js dev server 실행 (foreground)
 *   - 30초마다 origin/master fetch → 변경 시 ff pull
 *   - Ctrl+C 한 번에 둘 다 종료
 *
 * 이전 버전(scripts/dev-with-watch.sh)은 bash 의존이라 PowerShell에서 실패.
 * Node로 재작성해서 PATH에 bash 없어도 동작.
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const INTERVAL_MS = parseInt(process.env.WATCH_INTERVAL_SEC ?? "30", 10) * 1000;

// === Next.js dev server (foreground) ===
const isWindows = process.platform === "win32";
const next = spawn(
  isWindows ? "npx.cmd" : "npx",
  ["--no", "--", "next", "dev"],
  { stdio: "inherit", shell: false },
);

next.on("exit", (code) => {
  console.log(`\n[dev-with-watch] next dev exited (code=${code})`);
  process.exit(code ?? 0);
});

// === watcher loop (background) ===
let watcherActive = true;

function gitOutput(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { code: r.status ?? 1, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

async function watchOnce() {
  // fetch (조용히, 네트워크 실패 무시)
  const fetched = gitOutput(["fetch", "origin", "master", "--quiet"]);
  if (fetched.code !== 0) return;

  const local = gitOutput(["rev-parse", "HEAD"]).stdout;
  const remote = gitOutput(["rev-parse", "origin/master"]).stdout;
  if (!local || !remote || local === remote) return;

  const shortRemote = gitOutput(["rev-parse", "--short", "origin/master"]).stdout;
  console.log(`\n🔄 [dev-watch] origin/master 갱신 (${shortRemote}) — pull...`);

  // 워킹 디렉토리 변경사항이 있으면 stash
  const dirty =
    gitOutput(["diff", "--quiet"]).code !== 0 ||
    gitOutput(["diff", "--cached", "--quiet"]).code !== 0;
  if (dirty) {
    console.log("   ⚠ 작업 변경사항 있음 — stash 후 진행");
    spawnSync("git", ["stash", "push", "-u", "-m", `dev-watch ${Date.now()}`], { stdio: "ignore" });
  }

  const pulled = gitOutput(["pull", "origin", "master", "--ff-only", "--quiet"]);
  if (pulled.code === 0) {
    const newHead = gitOutput(["rev-parse", "--short", "HEAD"]).stdout;
    console.log(`   ✅ ${newHead} 으로 업데이트. Next.js 가 자동 hot-reload.\n`);
  } else {
    console.log(`   ✘ pull 실패 (fast-forward 불가). 수동 처리 필요.\n`);
  }

  if (dirty) {
    const popped = gitOutput(["stash", "pop"]);
    console.log(popped.code === 0 ? "   ↻ stash 복원\n" : "   ⚠ stash 복원 실패. git stash list 확인\n");
  }
}

async function watcherLoop() {
  console.log(`🔁 [dev-watch] 시작 (${INTERVAL_MS / 1000}s interval) — origin/master 자동 sync`);
  while (watcherActive) {
    try {
      await watchOnce();
    } catch (err) {
      console.error("[dev-watch] error:", err?.message ?? err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

watcherLoop().catch((err) => console.error("[dev-watch] fatal:", err));

// === Cleanup ===
function shutdown() {
  watcherActive = false;
  if (!next.killed) {
    try {
      next.kill(isWindows ? undefined : "SIGTERM");
    } catch {}
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

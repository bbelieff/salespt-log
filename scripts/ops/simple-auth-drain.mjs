#!/usr/bin/env node
/**
 * 배포 직전 「간편인증 진행 중 요청」이 끝나기를 기다린다(deploy.yml → 원자 swap 직전, 실행 폴더 /opt/salespt-log).
 * 간편인증 작업은 앱 메모리에서 대표 승인(최대 4분 30초)과 서류 받기를 기다리므로, 그 사이 PM2 재시작이 오면 끊긴다
 * (2026-11-11 수강생 오류). 새 보내기는 앱이 `.deploy/simple-auth-draining` 표시를 보고 막는다.
 *
 * - 진행 중 수는 앱이 `.deploy/simple-auth-active.json`({ n, until, at })에 쓴다(lib/repo/deploy-drain.ts).
 *   DB 를 거치지 않는다 — 세션 풀러가 꽉 차 조회가 안 될 때가 있다(2026-11-11 실측).
 * - n>0 이고 until(늦어도 끝날 시각) 전이면 10초마다 다시 본다. 최대 SIMPLE_AUTH_DRAIN_MAX_S(기본 480초).
 * - 파일이 없거나 못 읽으면 기다리지 않는다. 어떤 경우든 종료코드 0 — 기다림은 배포의 부가 기능이다.
 */
import { readFileSync } from "node:fs";

const FILE = ".deploy/simple-auth-active.json";
const MAX_S = Number(process.env.SIMPLE_AUTH_DRAIN_MAX_S || 480);
const STEP_S = Number(process.env.SIMPLE_AUTH_DRAIN_STEP_S || 10);

/** 지금 기다려야 할 진행 중 수(0 = 기다릴 것 없음). */
export function activeCount(raw, now = Date.now()) {
  try {
    const j = JSON.parse(raw);
    const n = Number(j?.n) || 0, until = Number(j?.until) || 0;
    return n > 0 && until > now ? n : 0;
  } catch { return 0; }
}

function read() {
  try { return activeCount(readFileSync(FILE, "utf8")); } catch { return 0; }
}

async function main() {
  const start = Date.now();
  for (;;) {
    const n = read();
    const waited = Math.round((Date.now() - start) / 1000);
    if (n === 0) { console.log(`[simple-auth-drain] 진행 중 간편인증 0건 — 배포 계속 (기다린 시간 ${waited}초)`); return; }
    if (waited >= MAX_S) { console.log(`[simple-auth-drain] ${MAX_S}초 넘김 — 진행 중 ${n}건을 두고 배포 계속`); return; }
    console.log(`[simple-auth-drain] 진행 중 간편인증 ${n}건 — 끝나기를 기다리는 중 (${waited}초)`);
    await new Promise((r) => setTimeout(r, STEP_S * 1000));
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("simple-auth-drain.mjs")) {
  main().catch((e) => console.log(`[simple-auth-drain] 확인 실패(${e?.name ?? "error"}) — 배포 계속`));
}

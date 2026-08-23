#!/usr/bin/env node
/**
 * BBE-242 SLO 루프 전용 — 7개 주요 경로 실측(curl TTFB/총시간, 5회 중앙값+최대) +
 * 불안정 원인 축(DB-path vs Sheets-path, localhost vs public) 진단.
 *
 * 쓰기는 오직 "일지 저장"(POST /api/daily/:date) 1건뿐이며, 반드시 "연습" 코호트
 * (더미/테스트 계정, DB_READ_COHORTS 파일럿)에서 GET으로 읽은 값을 그대로 재-POST하는
 * 멱등 라운드트립만 수행한다 — 실데이터 변경 없음. 그 외 전부 GET(읽기 전용).
 *
 * 실행(VPS, /opt/salespt-log): node scripts/ops/slo-loop.mjs
 * 비밀값(AUTH_SECRET·이메일 등) 콘솔에 원문 출력 금지 — 이메일은 해시 앞8자만.
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync, exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { encode } from "next-auth/jwt";

const exec = promisify(execCb);

function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";
const DB_URL = env("DATABASE_URL");
const AUTH_SECRET = env("AUTH_SECRET");
const ADMIN_EMAILS = (env("ADMIN_EMAILS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const BASE_LOCAL = "http://127.0.0.1:3000";
const BASE_PUBLIC = "https://salesptlog.online";
const COOKIE_NAME = "__Secure-authjs.session-token"; // 프로덕션은 항상 secure cookie (AUTH_URL=https)

function h8(s) {
  return createHash("sha256").update(String(s)).digest("hex").slice(0, 8);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function mintCookie(email) {
  const value = await encode({
    token: { email, sub: email },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
    maxAge: 60 * 30,
  });
  return `${COOKIE_NAME}=${value}`;
}

async function curlOnce(base, path, { cookie, method = "GET", body } = {}) {
  const args = [
    "curl", "-s", "-o", "/dev/null",
    "-w", "'%{http_code} %{time_starttransfer} %{time_total}'",
    "--max-time", "15",
  ];
  if (cookie) args.push("-H", `'Cookie: ${cookie}'`);
  if (method === "POST") {
    args.push("-X", "POST", "-H", "'Content-Type: application/json'", "-d", `'${body}'`);
  }
  args.push(`'${base}${path}'`);
  try {
    const { stdout } = await exec(args.join(" "), { encoding: "utf8", timeout: 20_000 });
    const [code, ttfb, total] = stdout.trim().split(/\s+/);
    return { ok: true, code: Number(code), ttfbMs: Math.round(Number(ttfb) * 1000), totalMs: Math.round(Number(total) * 1000) };
  } catch (e) {
    return { ok: false, err: String(e?.message ?? e).slice(0, 150) };
  }
}

async function curlBody(base, path, { cookie } = {}) {
  const args = ["curl", "-s", "--max-time", "15"];
  if (cookie) args.push("-H", `'Cookie: ${cookie}'`);
  args.push(`'${base}${path}'`);
  try {
    const { stdout } = await exec(args.join(" "), { encoding: "utf8", timeout: 20_000 });
    return stdout;
  } catch (e) {
    return null;
  }
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

async function runReps(base, path, opts, reps) {
  const samples = [];
  const codes = new Set();
  const errs = [];
  for (let i = 0; i < reps; i++) {
    const r = await curlOnce(base, path, opts);
    if (r.ok) {
      samples.push(r.totalMs);
      codes.add(r.code);
    } else {
      errs.push(r.err);
    }
  }
  return {
    n: samples.length,
    medianMs: samples.length ? median(samples) : null,
    maxMs: samples.length ? Math.max(...samples) : null,
    codes: [...codes],
    errs,
  };
}

async function pickIdentities(pool) {
  const pilot = await pool.query(
    `select email, spreadsheet_id from users where role='trainee' and cohort='연습' and status='active' order by email limit 1`,
  );
  // cohort 컬럼은 레거시 기수에서 "6기" 처럼 접미사가 붙어 저장돼 있을 수 있다
  // (isDbReadPilot 의 정규화 규칙과 동일, daily-source.ts:15-18 참고) — bare 숫자로만
  // 질의하면 0건이 나오는 게 사이클1에서 실측 확인됨. regexp_replace 로 접미사 제거 후 비교.
  const nonpilot = await pool.query(
    `select email, spreadsheet_id from users where role='trainee' and status='active'
       and regexp_replace(cohort, '기\\s*$', '') in ('6','7','10') order by email limit 1`,
  );
  return {
    pilotEmail: pilot.rows[0]?.email ?? null,
    nonpilotEmail: nonpilot.rows[0]?.email ?? null,
    adminEmail: ADMIN_EMAILS[0] ?? null,
  };
}

function vpsStats() {
  const sh = (cmd) => {
    try { return execSync(cmd, { encoding: "utf8", timeout: 10_000 }).trim(); }
    catch (e) { return `(실패: ${String(e?.message ?? e).slice(0, 150)})`; }
  };
  console.log("\n=== VPS 자원(참고) ===");
  console.log(`시각: ${new Date().toISOString()}`);
  console.log(`uptime/loadavg: ${sh("uptime")}`);
  console.log(`메모리: ${sh("free -h | sed -n 2p")}`);
}

async function dbConnStats(pool) {
  console.log("\n=== DB 커넥션(참고) ===");
  const conns = await pool.query(
    `select count(*) as n, state from pg_stat_activity where datname = current_database() group by state`,
  );
  for (const r of conns.rows) console.log(`  ${r.state ?? "(null)"}: ${r.n}`);
}

async function main() {
  if (!AUTH_SECRET) throw new Error("AUTH_SECRET 미설정 — 쿠키 발급 불가");
  if (!DB_URL) throw new Error("DATABASE_URL 미설정");

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  const { pilotEmail, nonpilotEmail, adminEmail } = await pickIdentities(pool);
  console.log(`표본 계정(해시8): pilot(연습)=${pilotEmail ? h8(pilotEmail) : "없음"} nonpilot(6/7/10)=${nonpilotEmail ? h8(nonpilotEmail) : "없음"} admin=${adminEmail ? h8(adminEmail) : "없음"}`);

  const pilotCookie = pilotEmail ? await mintCookie(pilotEmail) : null;
  const nonpilotCookie = nonpilotEmail ? await mintCookie(nonpilotEmail) : null;
  const adminCookie = adminEmail ? await mintCookie(adminEmail) : null;

  const today = todayISO();
  const REPS = 5;
  const SLO_MS = 2000;

  // ── 주요 7경로 (public URL, 실사용자 대표 계정 — 비파일럿 6/7/10 우선, 없으면 파일럿) ──
  const primaryCookie = nonpilotCookie ?? pilotCookie;
  const primaryLabel = nonpilotCookie ? "비파일럿(6/7/10)" : "파일럿(연습)";

  const routes = [
    { key: "1.로그인진입", path: "/", opts: {} },
    { key: "2.일지목록", path: `/api/daily/${today}`, opts: { cookie: primaryCookie } },
    { key: "4.미팅목록", path: `/api/meetings/week/${today}`, opts: { cookie: primaryCookie } },
    { key: "5.계약목록", path: "/api/contract-payment", opts: { cookie: primaryCookie } },
    { key: "6.어드민수강생관리", path: "/admin/users", opts: { cookie: adminCookie } },
    { key: "7.대시보드", path: "/api/dashboard", opts: { cookie: primaryCookie } },
  ];

  // BBE-242 사이클2: 경로 6개를 순차가 아니라 동시(Promise.all)로 측정 — 한 경로(특히
  // 배포직후 콜드버스트 같은 이상치)가 15초씩 막혀도 나머지 경로 측정이 뒤로 안 밀린다.
  // 같은 경로 안의 5회 반복은 순서 유지(실사용자의 연속 재방문과 같은 의미를 보존).
  console.log(`\n=== SLO 실측 (public, 대표계정=${primaryLabel}, 경로당 ${REPS}회·경로간 병렬, SLO=중앙값&최대 ≤ ${SLO_MS}ms) ===`);
  const t0 = Date.now();
  const results = await Promise.all(
    routes.map(async (r) => ({ ...r, res: await runReps(BASE_PUBLIC, r.path, r.opts, REPS) })),
  );
  console.log(`  (병렬 측정 총 소요: ${Date.now() - t0}ms)`);
  for (const { key, res } of results) {
    const flag = res.medianMs !== null && (res.medianMs > SLO_MS || res.maxMs > SLO_MS) ? "⚠️ 초과" : "✅";
    console.log(`  ${flag} ${key}: n=${res.n}/${REPS} median=${res.medianMs}ms max=${res.maxMs}ms code=${res.codes.join(",")}${res.errs.length ? ` err=${res.errs[0]}` : ""}`);
  }

  // ── 3.일지 저장 — 파일럿(연습) 전용, 멱등 라운드트립(GET한 값 그대로 재-POST) ──
  // 이 워크플로우의 유일한 쓰기(SQL 아님, 앱 API 경유) — SLO_ENABLE_WRITE=0 이면 스킵.
  const writeEnabled = env("SLO_ENABLE_WRITE") !== "0";
  console.log(`\n=== 3.일지저장 (POST, 파일럿(연습) 전용, 멱등 라운드트립, ${REPS}회) ===`);
  if (!writeEnabled) {
    console.log("  (SLO_ENABLE_WRITE=0 — 스킵)");
  } else if (pilotCookie) {
    const dailyPath = `/api/daily/${today}`;
    const raw = await curlBody(BASE_PUBLIC, dailyPath, { cookie: pilotCookie });
    let body = null;
    try {
      const view = raw ? JSON.parse(raw) : null;
      if (view?.channels) {
        body = {};
        for (const [ch, v] of Object.entries(view.channels)) {
          body[ch] = {
            production: v.production ?? 0,
            inflow: v.inflow ?? 0,
            contactProgress: v.contactProgress ?? 0,
            meetingReservation: v.meetingReservation ?? 0,
          };
        }
      }
    } catch { /* fallback below */ }
    if (!body) {
      const CH = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];
      body = Object.fromEntries(CH.map((c) => [c, { production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 }]));
      console.log("  (기존값 GET 실패 — 전채널 0 멱등 body 로 대체, 연습 계정이라 안전)");
    }
    const bodyStr = JSON.stringify(body).replace(/'/g, "'\\''");
    const res = await runReps(BASE_PUBLIC, dailyPath, { cookie: pilotCookie, method: "POST", body: bodyStr }, REPS);
    const flag = res.medianMs !== null && (res.medianMs > SLO_MS || res.maxMs > SLO_MS) ? "⚠️ 초과" : "✅";
    results.push({ key: "3.일지저장", res });
    console.log(`  ${flag} 3.일지저장: n=${res.n}/${REPS} median=${res.medianMs}ms max=${res.maxMs}ms code=${res.codes.join(",")}${res.errs.length ? ` err=${res.errs[0]}` : ""}`);
  } else {
    console.log("  (연습 계정 없음 — 스킵)");
  }

  // ── 초과 순위표 ──
  console.log("\n=== 초과 순위표(중앙값 기준, 큰 순) ===");
  const ranked = results.filter((r) => r.res.medianMs !== null).sort((a, b) => b.res.medianMs - a.res.medianMs);
  ranked.forEach((r, i) => console.log(`  ${i + 1}위 ${r.key}: median=${r.res.medianMs}ms max=${r.res.maxMs}ms`));

  // ── 진단축: DB-path(파일럿) vs Sheets-path(비파일럿), localhost vs public — 4개 데이터의존 경로만, 3회 ──
  console.log("\n=== 진단축 — DB-path vs Sheets-path, localhost vs public (각 3회) ===");
  const DIAG_REPS = 3;
  const diagRoutes = [
    { key: "일지목록", path: `/api/daily/${today}` },
    { key: "미팅목록", path: `/api/meetings/week/${today}` },
    { key: "계약목록", path: "/api/contract-payment" },
    { key: "대시보드", path: "/api/dashboard" },
  ];
  await Promise.all(
    diagRoutes.map(async (dr) => {
      const combos = [];
      for (const [baseLabel, base] of [["local", BASE_LOCAL], ["public", BASE_PUBLIC]]) {
        for (const [idLabel, cookie] of [["DB(연습)", pilotCookie], ["Sheets(비파일럿)", nonpilotCookie]]) {
          if (!cookie) continue;
          combos.push({ baseLabel, base, idLabel, cookie });
        }
      }
      const rows = await Promise.all(
        combos.map(async (c) => {
          const res = await runReps(c.base, dr.path, { cookie: c.cookie }, DIAG_REPS);
          return `${c.baseLabel}/${c.idLabel}=${res.medianMs}ms`;
        }),
      );
      console.log(`  ${dr.key}: ${rows.join(" · ")}`);
    }),
  );

  vpsStats();
  await dbConnStats(pool);
  await pool.end().catch(() => {});
}

main().catch((e) => {
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]");
  console.error(`slo-loop 실패: ${msg}`);
  process.exitCode = 1;
});

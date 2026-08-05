/**
 * 아레나 **시즌2(A2) 셋업 배치** — 설계도 `docs/plans/active/arena-season2-setup.md` W1·W2 실행기.
 *
 *   node scripts/ops/arena-season2-batch.mjs --plan                 # 계획만 출력(쓰기 0)
 *   node scripts/ops/arena-season2-batch.mjs --canary <이름>         # 1명만 실제 생성
 *   node scripts/ops/arena-season2-batch.mjs --all                  # 나머지 전체
 *   보조: --season-row  (cohorts A2 행 생성/개강일 기록만)
 *
 * ## 무엇을 하나 (참가자 1명당)
 *   1) 기존 시트를 **Drive 복사**(admin OAuth) — A1 참가자는 A1 시트, 7·8기는 수강 시트가 원본
 *   2) 새 제목 = `세일즈PT_A2_{기수}기 {이름}_대표님 경영일지`
 *   3) `01 영업관리` O1=개막일 / O2=개막일+50 (**RAW ISO 로 쓰지 않고 USER_ENTERED 날짜값**)
 *   4) SA(서비스계정) 편집자 공유 추가 — 10기에서 발견된 공유 누락 갭 재발 방지
 *   5) registry(users) 에 A2 행 append + 원본 행의 email 을 **이관**(원본 행은 보존)
 *
 * ## 안전 장치
 *   - **멱등**: registry 에 같은 (A2 cohort, 이름) 행이 이미 있으면 **skip**. 재실행 안전.
 *   - **이월매출 셀은 건드리지 않는다** — 이월/시즌 매출은 `계약일 < O1` 로 **읽을 때 계산**된다
 *     (`lib/types/contract-status.ts isCarryoverContract`). 셀에 쓰면 사용자값 오염 + 이중계상.
 *   - 원본 시트·원본 registry 행은 **읽기만** 한다(email 열 이관 제외).
 *   - 실패는 그 사람만 건너뛰고 계속 — 마지막에 실패 목록 출력(부분 실패 = 재실행으로 수렴).
 *   - ★비밀값 미출력. email 은 마스킹해 로그.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── env ───────────────────────────────────────────────────────────
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

const arg = (name, fb = "") => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fb;
};
const has = (name) => process.argv.includes(name);

const SEASON_START = arg("--start", "2026-08-07");
const SEASON_DAYS = 50; // ADR-0005: 종강 = 시작 + 50
const SEASON = 2;
const SALES_TAB = "01 영업관리"; // = SHEET_RANGES.sales.tab
const REG = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");

const mask = (e) => (e ? e.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "");
/** googleapis 에러의 정확한 reason 코드(예: insufficientFilePermissions·insufficientPermissions
 * =스코프 문제 vs cannotCopyFile=파일 자체 정책)를 뽑는다. 사람 메시지보다 근인을 정확히 가른다.
 * reason 코드는 enum 문자열이라 PII 없음 — 그대로 출력 안전. */
const reasonOf = (e) => {
  const errs = e?.errors ?? e?.response?.data?.error?.errors ?? [];
  const reasons = errs.map((x) => x.reason).filter(Boolean);
  const status = e?.response?.data?.error?.status ?? e?.code ?? "";
  return reasons.length ? `${reasons.join(",")}${status ? ` (${status})` : ""}` : String(status || "");
};
const isoPlus = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const SEASON_END = isoPlus(SEASON_START, SEASON_DAYS);

// ── clients ───────────────────────────────────────────────────────
function saAuth(scopes) {
  return new google.auth.JWT({
    email: SA_EMAIL,
    key: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes,
  });
}
/** Drive 복사는 **admin OAuth**(refresh token) — SA 는 원본 폴더 소유권이 없어 복사본 위치·용량이 꼬인다. */
function adminAuth() {
  const c = new google.auth.OAuth2(env("AUTH_GOOGLE_ID"), env("AUTH_GOOGLE_SECRET"));
  c.setCredentials({ refresh_token: env("ADMIN_DRIVE_REFRESH_TOKEN") });
  return c;
}
const sheets = google.sheets({ version: "v4", auth: saAuth(["https://www.googleapis.com/auth/spreadsheets"]) });
const drive = google.drive({ version: "v3", auth: adminAuth() });
const driveSA = google.drive({ version: "v3", auth: saAuth(["https://www.googleapis.com/auth/drive"]) });

async function readRange(id, range, dateTimeRenderOption = "FORMATTED_STRING") {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: id, range, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption,
  });
  return r.data.values ?? [];
}

// ── registry ──────────────────────────────────────────────────────
async function loadRegistry() {
  const rows = await readRange(REG, "users!A2:T");
  return rows.map((r, i) => ({
    row: i + 2,
    email: String(r?.[0] ?? "").trim(),
    cohort: String(r?.[1] ?? "").trim(),
    name: String(r?.[2] ?? "").trim(),
    sheetId: String(r?.[3] ?? "").trim(),
    role: String(r?.[4] ?? "").trim(),
    status: String(r?.[5] ?? "").trim(),
    raw: r ?? [],
  }));
}

/** A2 참가 대상 — A1-* 전원 + 7·8기 trainee 전원(설계도 §1·§2-4). 9·10기·T·관리·연습 제외. */
function targets(all) {
  const a1 = all.filter((u) => /^A1-\d+$/.test(u.cohort) && u.sheetId && u.status !== "archived");
  const c78 = all.filter((u) => /^[78]기?$/.test(u.cohort) && u.role === "trainee" && u.sheetId && u.status !== "archived");
  return [
    ...a1.map((u) => ({ ...u, srcKind: "A1", baseCohort: u.cohort.replace(/^A1-/, "") })),
    ...c78.map((u) => ({ ...u, srcKind: "수강", baseCohort: u.cohort.replace(/기$/, "") })),
  ];
}
const a2Cohort = (t) => `A2-${t.baseCohort}기`;
const a2Title = (t) => `세일즈PT_A2_${t.baseCohort}기 ${t.name}_대표님 경영일지`;

// ── 단계별 실행 ────────────────────────────────────────────────────
/**
 * cohorts 탭 A2 행 — 없으면 append, 있으면 J(개강일)만 보정. J 는 RAW(문자열 ISO).
 *
 * **A1 J 도 함께 채운다**(비어 있을 때만). 이유: A1 J 가 비면 `resolveCurrentSeason` 이
 * "개막 여부 미상"으로 0을 반환하고, 0 은 **스코프 전부 통과**라 오늘 만든 A2 행들이
 * 개막 전(8/6 까지) 전광판에 0.0 으로 함께 뜬다. A1 J=2026-06-12(참가자 O1·registry K 실측값)를
 * 채우면 8/6 까지는 시즌1 스코프, 8/7 부터 시즌2 로 **자동 전환**된다.
 */
async function ensureSeasonRow() {
  const rows = await readRange(REG, "cohorts!A2:J");
  const a1i = rows.findIndex((r) => String(r?.[0] ?? "").trim() === "A1");
  if (a1i >= 0 && !String(rows[a1i]?.[9] ?? "").trim()) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: REG, range: `cohorts!J${a1i + 2}`, valueInputOption: "RAW",
      requestBody: { values: [[arg("--a1-start", "2026-06-12")]] },
    });
    console.log(`▶ cohorts A1 J 채움 = ${arg("--a1-start", "2026-06-12")} (개막 전 A2 노출 차단)`);
  }
  const idx = rows.findIndex((r) => String(r?.[0] ?? "").trim() === `A${SEASON}`);
  if (idx < 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: REG, range: "cohorts!A:J", valueInputOption: "RAW",
      requestBody: { values: [[`A${SEASON}`, "active", "아레나 시즌2", "arena", "", "", "", "", "", SEASON_START]] },
    });
    return `cohorts A${SEASON} 행 생성 (J=${SEASON_START})`;
  }
  const cur = String(rows[idx]?.[9] ?? "").trim();
  if (cur === SEASON_START) return `cohorts A${SEASON} 이미 정상 (J=${cur})`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: REG, range: `cohorts!J${idx + 2}`, valueInputOption: "RAW",
    requestBody: { values: [[SEASON_START]] },
  });
  return `cohorts A${SEASON} J 갱신 ${cur || "(빈칸)"} → ${SEASON_START}`;
}

async function copySheet(t) {
  const res = await drive.files.copy({
    fileId: t.sheetId,
    requestBody: { name: a2Title(t) },
    supportsAllDrives: true,
    fields: "id,name",
  });
  return res.data.id;
}

/** O1/O2 = 날짜 값으로 입력(USER_ENTERED). 텍스트로 넣으면 대시보드가 #VALUE! 로 깨진다(9기 사고). */
async function setCourseDates(sheetId) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId, range: `'${SALES_TAB}'!O1:O2`, valueInputOption: "USER_ENTERED",
    requestBody: { values: [[SEASON_START], [SEASON_END]] },
  });
}

/** SA 를 명시 편집자로 추가 — 링크공유에 의존하지 않게(10기 갭). 이미 있으면 무해하게 실패 흡수. */
async function shareToSA(sheetId) {
  try {
    await drive.permissions.create({
      fileId: sheetId, supportsAllDrives: true, sendNotificationEmail: false,
      requestBody: { type: "user", role: "writer", emailAddress: SA_EMAIL },
    });
    return "SA 공유 추가";
  } catch (e) {
    const msg = String(e?.message ?? "");
    if (/already|duplicate/i.test(msg)) return "SA 공유 이미 있음";
    throw e;
  }
}

/**
 * registry: A2 행 append — **email 은 비워서 만든다**(2단계 설계).
 *
 * 왜 지금 이관하지 않나: registry email 을 옮기는 순간 그 사람은 **즉시** A2 시트로 연결된다.
 * 배치는 8/5~8/6 에 도는데 개막·공지는 8/7 이라, 지금 옮기면 공지 전에 화면이 바뀐다.
 * → 복사·행 생성만 미리 해두고, 개막일 아침에 `--flip-emails` 로 한 번에 전환한다(멱등·롤백 쉬움).
 */
async function appendA2Row(t, newSheetId) {
  const row = new Array(20).fill("");
  row[0] = "";                 // A email — 개막일에 --flip-emails 로 채운다
  row[1] = a2Cohort(t);        // B cohort
  row[2] = t.name;             // C name
  row[3] = newSheetId;         // D spreadsheetId
  row[4] = t.raw[4] ?? "";     // E role
  row[5] = "active";           // F status
  row[6] = t.raw[6] ?? "";     // G assignedTrainer
  row[7] = t.raw[7] ?? "";     // H team
  row[10] = SEASON_START;      // K courseStartISO
  row[11] = SEASON_END;        // L graduationISO
  await sheets.spreadsheets.values.append({
    spreadsheetId: REG, range: "users!A:T", valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

/**
 * 개막일(8/7) 실행 — 원본 행의 email 을 A2 행으로 **이관**한다(원본 행 자체는 보존).
 * 멱등: A2 행에 이미 email 이 있으면 skip. 롤백 = 반대로 한 줄씩 원복(또는 --rollback-emails).
 */
async function flipEmails(all, rollback = false) {
  const list = targets(all);
  const a2Rows = all.filter((u) => /^A2-/.test(u.cohort));
  const moved = [], skipped = [];
  for (const t of list) {
    const dst = a2Rows.find((u) => u.cohort === a2Cohort(t) && u.name === t.name);
    if (!dst) { skipped.push(`${t.name} — A2 행 없음(먼저 --all 로 생성)`); continue; }
    const [from, to] = rollback ? [dst, t] : [t, dst];
    if (!from.email) { skipped.push(`${t.name} — 옮길 email 없음`); continue; }
    if (to.email) { skipped.push(`${t.name} — 이미 이관됨`); continue; }
    await sheets.spreadsheets.values.update({
      spreadsheetId: REG, range: `users!A${to.row}`, valueInputOption: "RAW",
      requestBody: { values: [[from.email]] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: REG, range: `users!A${from.row}`, valueInputOption: "RAW",
      requestBody: { values: [[""]] },
    });
    moved.push(`${t.name} ${mask(from.email)} → ${rollback ? t.cohort : a2Cohort(t)}`);
  }
  return { moved, skipped };
}

async function provision(t, existingA2) {
  const key = `${a2Cohort(t)}|${t.name}`;
  if (existingA2.has(key)) return { name: t.name, skipped: true, why: "이미 A2 행 있음" };
  const newId = await copySheet(t);
  await setCourseDates(newId);
  const share = await shareToSA(newId);
  await appendA2Row(t, newId);
  return { name: t.name, cohort: a2Cohort(t), newId, share, email: mask(t.email) };
}

/** 진단 전용 — admin OAuth 토큰이 어느 계정인지(마스킹) + 원본 시트 접근권 실측. 쓰기 0건.
 * "The caller does not have permission" 류 실패의 근인(계정 불일치 vs 공유 누락) 을 가른다.
 * --canary <이름> 을 함께 주면 **그 사람 원본**을 검사(기본은 대상 목록의 첫 사람). */
async function whoami() {
  try {
    const me = await drive.about.get({ fields: "user(emailAddress)" });
    console.log(`admin OAuth 계정: ${mask(me.data.user?.emailAddress ?? "")}`);
  } catch (e) {
    console.log(`admin OAuth 인증 실패: ${String(e?.message ?? e).slice(0, 100)}`);
    return;
  }
  // 실제 부여 scope 확정 — access_token 자체는 절대 로그에 안 남긴다(fetch 후 즉시 지역변수만 사용).
  try {
    const admin = adminAuth();
    const { token } = await admin.getAccessToken();
    if (!token) throw new Error("access_token 발급 실패(빈 값)");
    const info = await (await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`)).json();
    console.log(`토큰 scope: ${info.scope ?? "(응답에 scope 없음)"}`);
    console.log(`토큰 email: ${mask(info.email ?? "")} · expires_in=${info.expires_in ?? "?"}s`);
    if (info.error) console.log(`tokeninfo 오류: ${info.error} ${info.error_description ?? ""}`);
  } catch (e) {
    console.log(`tokeninfo 조회 실패: ${String(e?.message ?? e).slice(0, 120)}`);
  }
  const all = await loadRegistry();
  const target = arg("--canary");
  const sample = target
    ? targets(all).find((t) => t.name === target && t.sheetId)
    : targets(all).find((t) => t.sheetId);
  if (!sample) { console.log(`샘플 원본 시트 없음${target ? `(이름 "${target}" 대상 목록에 없음)` : ""}`); return; }
  try {
    const f = await drive.files.get({
      fileId: sample.sheetId, supportsAllDrives: true,
      fields: "id,name,owners(emailAddress),shared,capabilities(canCopy)",
    });
    console.log(`원본 샘플(${sample.name}, ${sample.cohort}) 소유자: ${(f.data.owners ?? []).map((o) => mask(o.emailAddress ?? "")).join(", ")}`);
    console.log(`shared 플래그: ${f.data.shared} · 이 admin 계정의 복사 가능 여부: ${f.data.capabilities?.canCopy}`);
  } catch (e) {
    console.log(`원본 시트 접근 실패(=권한 없음 가능성): ${String(e?.message ?? e).slice(0, 100)}`);
  }
}

// ── main ──────────────────────────────────────────────────────────
async function main() {
  if (!REG || !SA_EMAIL) { console.error("❌ env 없음(SHEETS_REGISTRY_ID·SA)"); process.exit(2); }
  console.log(`\n🏟  아레나 시즌2 배치 — 개막 ${SEASON_START} · 종강 ${SEASON_END}\n`);

  if (has("--whoami")) { await whoami(); return; }

  const all = await loadRegistry();
  const list = targets(all);
  const existingA2 = new Set(
    all.filter((u) => /^A2-/.test(u.cohort)).map((u) => `${u.cohort}|${u.name}`),
  );

  if (has("--plan")) {
    console.log(`대상 ${list.length}명 (이미 생성 ${existingA2.size})`);
    for (const t of list) {
      const done = existingA2.has(`${a2Cohort(t)}|${t.name}`) ? "  [완료]" : "";
      console.log(` ${t.srcKind.padEnd(3)} ${t.cohort.padEnd(6)} → ${a2Cohort(t).padEnd(8)} ${t.name.padEnd(7)} email=${t.email ? "이관" : "없음(복사만)"}${done}`);
    }
    console.log(`\n(쓰기 0건 — 계획만 출력)\n`);
    return;
  }

  if (has("--flip-emails") || has("--rollback-emails")) {
    const r = await flipEmails(all, has("--rollback-emails"));
    r.moved.forEach((m) => console.log(` ✅ ${m}`));
    r.skipped.forEach((s) => console.log(` ⏭  ${s}`));
    console.log(`\n이관 ${r.moved.length} · 건너뜀 ${r.skipped.length}\n`);
    return;
  }

  if (has("--season-row") || has("--all") || has("--canary")) {
    console.log("▶ " + (await ensureSeasonRow()));
  }
  if (has("--season-row") && !has("--all") && !has("--canary")) return;

  const canary = arg("--canary");
  const queue = canary ? list.filter((t) => t.name === canary) : has("--all") ? list : [];
  if (queue.length === 0) {
    console.log("대상 없음 — 사용법: --plan | --canary <이름> | --all");
    return;
  }

  const done = [], failed = [];
  for (const t of queue) {
    try {
      const r = await provision(t, existingA2);
      done.push(r);
      console.log(r.skipped
        ? ` ⏭  ${t.name} — ${r.why}`
        : ` ✅ ${r.name} (${r.cohort}) sheet=${r.newId} ${r.share} email=${r.email || "없음"}`);
      existingA2.add(`${a2Cohort(t)}|${t.name}`);
    } catch (e) {
      const why = `${String(e?.message ?? e).slice(0, 120)} [reason=${reasonOf(e) || "미상"}]`;
      failed.push({ name: t.name, why });
      console.log(` ❌ ${t.name} — ${why}`);
    }
  }
  const created = done.filter((d) => !d.skipped).length;
  console.log(`\n완료 ${created} · 건너뜀 ${done.filter((d) => d.skipped).length} · 실패 ${failed.length}`);
  if (failed.length) {
    console.log("실패 목록(재실행하면 성공분은 건너뜁니다):");
    failed.forEach((f) => console.log(`  · ${f.name} — ${f.why}`));
    process.exit(1);
  }
  if (created > 0) {
    // BBE-50 항구 규칙: 시트 복사 = 복사 + DB 백필 한 세트. 복사본은 새 spreadsheet_id 라
    // sheet_rows 0건 → 파일럿 게이트(A2 자동 편입)에서 개막일 화면 공백. 반드시 이어서 실행.
    console.log(
      "\n★ 다음 단계 필수 — DB 백필(BBE-50 · 안 하면 개막일 화면 공백):\n" +
        '  node scripts/ops/backfill-sheet-rows.mjs --cohort "A2-1,A2-2,A2-3,A2-4,A2-5,A2-6,A2-7,A2-8"\n' +
        "  (dry-run 확인 후 --execute · VPS 에서 실행 — DATABASE_URL 필요)",
    );
  }
}

main().catch((e) => { console.error("배치 실패:", e?.message ?? e); process.exit(2); });

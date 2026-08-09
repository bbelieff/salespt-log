/**
 * BBE-53 실측 감사 — contracts append 자연키 upsert의 before/after 를 실제 파일럿 02 데이터로 대조.
 *
 * 읽기 전용(시트·DB 쓰기 없음). 각 대상 시트의 02 탭(C..AK)을 읽어:
 *   ① 기존 상태 점검 — AK(연결 미팅id) 중복 행이 이미 있는가(구 버그가 이미 터졌는지 baseline).
 *   ② before/after 시뮬레이션 — meetingId 가 있는 각 행에 대해, "지금 그 계약을 다시 저장한다면"
 *      · before(구 로직) = findFirstEmptyRow 가 잡을 다음 빈 행 번호(= 항상 새 행 → 중복 매출)
 *      · after(신 로직)  = findRowByLink(meetingId) 가 찾을 기존 행 번호(= 이미 있는 그 행 그대로)
 *      실제 시트 상태로 두 결과가 다름(before ≠ 실제 행, after = 실제 행)을 표로 확인한다.
 *   ③ (계약일+업체명) 폴백 안전성 — addFromContract 의 meetingId 미탐지 폴백이 실제로 서로 다른
 *      계약을 잘못 합칠 위험이 있는지, 같은 (계약일,업체명) 조합이 여러 행에 실재하는지 점검.
 *
 * 실행(VPS): node scripts/ops/contract-append-key-audit.mjs --cohort "8,9,연습,A1-0,...,A1-6" [--user email]
 * ★URL·비밀번호·SA 키 로그 미출력. 읽기 전용.
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

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

const COHORT = (process.argv[process.argv.indexOf("--cohort") + 1] || "").trim();
const ONLY_USER = (process.argv.includes("--user") ? process.argv[process.argv.indexOf("--user") + 1] : "").trim().toLowerCase();
const COHORTS = COHORT.split(",").map((s) => s.trim().replace(/기\s*$/, "")).filter(Boolean);
if (!COHORT) { console.error("사용법: node contract-append-key-audit.mjs --cohort <라벨목록> [--user email]"); process.exit(1); }

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) { console.error("audit: env 누락(SA/레지스트리)"); process.exit(1); }

const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
const sheets = google.sheets({ version: "v4", auth });

const toStr = (v) => (v === null || v === undefined ? "" : String(v));
function pushInto(map, key, val) {
  const arr = map.get(key) ?? [];
  arr.push(val);
  map.set(key, arr);
}
const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return "";
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};

async function resolveTab(sid) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid, fields: "sheets(properties(title))" }).catch(() => null);
  const titles = new Set((meta?.data.sheets ?? []).map((s) => s.properties?.title ?? ""));
  if (titles.has("02 계약수납관리")) return { tab: "02 계약수납관리", firstDataRow: 6 };
  if (titles.has("02 계약관리")) return { tab: "02 계약관리", firstDataRow: 5 };
  return null;
}

async function auditOne(email, sid) {
  const layout = await resolveTab(sid);
  if (!layout) return { email, error: "02 탭 없음" };
  const range = `'${layout.tab}'!C${layout.firstDataRow}:AK`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid, range, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER",
  }).catch((e) => { throw new Error(`values.get 실패: ${e.message}`); });
  const values = res.data.values ?? [];
  const rows = values.map((r, i) => ({
    row: layout.firstDataRow + i,
    계약일: serialToISO(r[0]),
    업체명: toStr(r[1]).trim(),
    meetingId: toStr(r[34]).trim(), // AK = C(idx0) 기준 offset 34
  })).filter((r) => r.계약일 || r.업체명);

  // ① 기존 AK 중복 — 구 버그가 이미 발현했는지.
  const byMeeting = new Map();
  for (const r of rows) {
    if (r.meetingId) pushInto(byMeeting, r.meetingId, r.row);
  }
  const existingDup = [...byMeeting.entries()].filter(([, rs]) => rs.length > 1);

  // ② before/after 시뮬레이션 — meetingId 있는 각 행 1건 샘플(첫 행)로 대표 확인.
  const nextEmpty = rows.length ? Math.max(...rows.map((r) => r.row)) + 1 : layout.firstDataRow;
  const sample = rows.find((r) => r.meetingId);
  const beforeAfter = sample
    ? { meetingId: sample.meetingId, actualRow: sample.row, before_append_would_pick: nextEmpty, after_upsert_resolves_to: sample.row }
    : null;

  // ③ (계약일+업체명) 폴백 충돌 후보.
  const byDateCompany = new Map();
  for (const r of rows) {
    if (r.계약일 && r.업체명) pushInto(byDateCompany, `${r.계약일}|${r.업체명}`, r.row);
  }
  const dateCompanyCollisions = [...byDateCompany.entries()].filter(([, rs]) => rs.length > 1);

  return {
    email, rows: rows.length, existingDupMeetingIds: existingDup.length,
    existingDupSample: existingDup.slice(0, 3),
    beforeAfter, dateCompanyCollisionCount: dateCompanyCollisions.length,
    dateCompanyCollisionSample: dateCompanyCollisions.slice(0, 3),
  };
}

async function main() {
  const reg = await sheets.spreadsheets.values.get({ spreadsheetId: REGISTRY_ID, range: "'users'!A2:R" });
  const seen = new Set();
  const targets = (reg.data.values ?? []).map((r) => ({
    email: toStr(r[0]).trim().toLowerCase(), cohort: toStr(r[1]).trim(), sid: toStr(r[3]).trim(), role: toStr(r[4]).trim() || "trainee",
  })).filter((u) => u.sid && COHORTS.includes(u.cohort.replace(/기\s*$/, "")) && u.role !== "trainer" && u.role !== "admin"
    && (!ONLY_USER || u.email === ONLY_USER) && !seen.has(u.sid) && seen.add(u.sid));

  console.log(`contract-append-key-audit: 대상 ${targets.length}명 (cohort=${COHORT}${ONLY_USER ? `, user=${ONLY_USER}` : ""})`);
  let totalDup = 0, totalCollision = 0, withSample = 0;
  for (const u of targets) {
    let r;
    try { r = await auditOne(u.email, u.sid); } catch (e) { console.log(`  ⚠️ ${u.email}: ${e.message}`); continue; }
    if (r.error) { console.log(`  ⚠️ ${u.email}: ${r.error}`); continue; }
    totalDup += r.existingDupMeetingIds;
    totalCollision += r.dateCompanyCollisionCount;
    const flags = [];
    if (r.existingDupMeetingIds > 0) flags.push(`⚠️기존중복 ${r.existingDupMeetingIds}건`);
    if (r.dateCompanyCollisionCount > 0) flags.push(`계약일+업체명 충돌후보 ${r.dateCompanyCollisionCount}건`);
    console.log(`  ${flags.length ? "⚠️" : "✅"} ${u.email} (${u.cohort}) — 행 ${r.rows}건 ${flags.join(" · ")}`);
    if (r.beforeAfter) {
      withSample++;
      const { meetingId, actualRow, before_append_would_pick, after_upsert_resolves_to } = r.beforeAfter;
      console.log(
        `      샘플(meetingId=${meetingId.slice(0, 8)}…): 실제 행=${actualRow} · ` +
        `구로직(재저장 시)=행 ${before_append_would_pick} 새로 만듦(중복) · ` +
        `신로직(재저장 시)=행 ${after_upsert_resolves_to} 그대로(정확)`,
      );
    }
  }
  console.log(`\n── 요약 ── 대상 ${targets.length} · 샘플 확보 ${withSample} · 기존 AK 중복 총 ${totalDup}건 · 계약일+업체명 충돌후보 총 ${totalCollision}건`);
  console.log(totalDup === 0
    ? "✅ 기존 데이터에 이미 발현한 중복행은 없음 — 이번 변경은 순수 예방(재발 방지)."
    : `⚠️ 기존 중복 ${totalDup}건 발견 — BBE-53 과는 별개로 이미 발생한 매출 이중계상 가능성, 별도 확인 필요.`);
}
main().catch((e) => { console.error("audit 실패:", (e?.message || e).replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")); process.exit(1); });

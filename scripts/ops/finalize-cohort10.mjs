/**
 * 10기 날짜 마감 — 개인시트 O1/O2·B3/C3 + 레지스트리 I~L 캐시 동기. finalize-cohort9.mjs 개작.
 *
 * 왜 필요한가 (worklog 2026-08-03 ⑪): 10기 6명은 admin 기수생성으로 정상 등재됐지만,
 * 생성 모달의 날짜 입력이 **자동화 조작으로 React 상태에 반영되지 않아** 서버가 "날짜 없음
 * → 시트 값 유지" 경로를 탔다. 그 결과 6개 시트가 0605 템플릿(8기 사본)의 값을 물고 있다
 * (O1=2026-06-12 · O2==O1+50 수식 · B3=8 · C3=빈값) — 레지스트리 I~L 캐시도 같은 값.
 * O1 은 대시보드 C33:H40 **주차 버킷의 앵커**이고, B3 은 앱 표시 기수의 **정본**
 * (me.ts: 시트 값이 레지스트리 cohort 를 이긴다) → 두면 개막 후 전 지표 0 + "8기" 표시.
 *
 * 실행: 레포 루트(.env.local 의 SA). **dry-run 기본**, --execute 시 실제 기록. 멱등.
 *   node scripts/ops/finalize-cohort10.mjs             # dry-run (대상·현재값·기록계획)
 *   node scripts/ops/finalize-cohort10.mjs --execute    # 기록 + 재실측
 *   node scripts/ops/finalize-cohort10.mjs --verify      # 실측만 (쓰기 0)
 *   [--allow-unexpected] 예상 밖 값도 덮기 · [--allow-existing-records] 기록 있는 시트도 flip
 *
 * 안전장치 (적대리뷰 4렌즈 반영):
 *  ① 대상은 **레지스트리에서 발견**(cohort=10) — 시트ID 하드코딩 0. 행수·유일성·이름 공란 검증.
 *  ② pre-read 실패를 **빈 셀로 오인하지 않는다** — 읽기 실패 행은 무조건 hold(§2.5 가드 유지).
 *  ③ 덮어쓰기는 **알려진 템플릿 지문**(O1=TEMPLATE_O1 · 수식 · 빈값)일 때만. 그 밖은 hold.
 *  ④ **기존 기록이 있는 시트는 flip 금지** — O1 을 옮기면 그 기록의 주차 귀속이 통째로 밀린다.
 *  ⑤ 날짜 hold 인 시트는 프로필(B3/C3)·레지스트리 캐시도 함께 보류 — 캐시가 시트를 앞서지 않게.
 *  ⑥ 시트별 try/catch + 429/5xx 백오프 — 중간 실패에도 성공분만 캐시 기록 + 실패 요약.
 *  ⑦ 최종 검증은 **쓰기 후 재조회**(레지스트리·시트 모두). O2 가 수식으로 남으면 초록 안 줌.
 * ★비밀값 미출력. 수강생 이름은 마스킹 출력(공개 레포에 붙는 로그 — PII 최소화).
 *
 * 다음 기수(11기+)에 또 필요해지면 이 파일을 복사하지 말고 `--cohort/--start` 를 받는
 * 일반 스크립트로 승격할 것(3회째면 harness issue).
 */
import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";

// ── SPEC (FOREMAN 확정 2026-08-05) ──────────────────────────────
const COHORT = "10";
const EXPECTED_ROWS = 6;
const START_ISO = "2026-08-07"; // 개막일 = 수강시작일(시트 O1). 금요일이어야 주차 요일 라벨이 맞음
const GRAD_ISO = "2026-09-26"; // 종강총회(O2) — ADR-0005: O2 직접값이 진실(리터럴 확정)
const TEMPLATE_O1 = "2026-06-12"; // 0605 템플릿(8기 사본) 잔존 지문 — 이 값만 잔재로 인정
const SALES_TAB = "01 영업관리"; // = SHEET_RANGES.sales.tab
const O1 = "O1";
const O2 = "O2";
/**
 * 기존 기록 탐지 범위 (§안전장치 ④). SHEET_RANGES 기준: sales.blockStart 10 + 8주×34 stride,
 * meetings.range A2:AS, contractPayment.firstDataRow 6.
 * ⚠️ **FORMULA 렌더로 읽고 수식·라벨은 세지 않는다** — 0605 템플릿에는 주차 헤더·`=sum(...)`·
 * `=ROW()-5`·"생산건 수 ▶" 같은 골격이 가득해서, 그걸 기록으로 세면 갓 만든 시트도 "기록 있음"
 * 으로 오판한다(실측: 영업관리 37행·02 31행 전부 골격, 04 는 0행).
 * cols = 사용자가 실제로 값을 넣는 열의 0-based 인덱스(range 시작열 기준).
 */
const PROBE = [
  // 영업관리 E~H = 4지표 입력칸(숫자만 들어간다)
  { label: "4지표(영업관리 E~H)", range: `'${SALES_TAB}'!E10:H285`, cols: [0, 1, 2, 3], numericOnly: true },
  // 04 업체관리 A~D = id/예약일/예약시각/미팅날짜 (앱이 append)
  { label: "미팅(04 업체관리)", range: "'04 업체관리(앱자동작성용)'!A2:D200", cols: [0, 1, 2, 3] },
  // 02 A6:E 중 C=계약일·D=업체명·E=수임비 (B 는 `=ROW()-5` 골격)
  { label: "계약(02 계약수납관리)", range: "'02 계약수납관리'!A6:E200", cols: [2, 3, 4] },
];

// ── env ─────────────────────────────────────────────────────────
function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  }
  return out;
}
const fileEnv = loadEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";

const EXECUTE = process.argv.includes("--execute");
const VERIFY_ONLY = process.argv.includes("--verify");
const ALLOW_UNEXPECTED = process.argv.includes("--allow-unexpected");
const ALLOW_EXISTING = process.argv.includes("--allow-existing-records");

const REGISTRY_ID = env("SHEETS_REGISTRY_ID");
const REGISTRY_TAB = env("SHEETS_REGISTRY_TAB") || "users";
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!REGISTRY_ID || !SA_EMAIL || !SA_KEY) {
  console.error(
    "❌ SA/레지스트리 env 누락 — 레포 루트(.env.local 보유)에서 실행하세요.\n" +
      "   키 형식: 1줄 + 리터럴 \\n (따옴표 허용).",
  );
  process.exit(2);
}
// 셸에 남은 옛 변수가 .env.local 을 조용히 이기는 사고 차단.
if (
  process.env.SHEETS_REGISTRY_ID &&
  fileEnv.SHEETS_REGISTRY_ID &&
  process.env.SHEETS_REGISTRY_ID !== fileEnv.SHEETS_REGISTRY_ID
) {
  console.error("❌ 셸 SHEETS_REGISTRY_ID 가 .env.local 과 다릅니다 — 어느 레지스트리인지 확정 후 재실행.");
  process.exit(2);
}
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets",
]);
const sheets = google.sheets({ version: "v4", auth });

// ── 유틸 ────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** 시리얼/로케일 문자열 → ISO (repo/cohorts.normalizeSeasonStart 와 동일 규칙). */
function normDate(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Sheets serial(1899-12-30 기준) → UTC 자정. 시간 성분이 섞여도 날짜만.
    const d = new Date((Math.floor(raw) - 25569) * 86_400_000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (ISO.test(s)) return s;
  const m = s.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?$/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}
function daysBetween(aISO, bISO) {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
/** 공개 레포 로그용 이름 마스킹 (첫·끝 글자만). */
const mask = (n) => {
  const s = String(n ?? "").trim();
  if (s.length <= 1) return s || "-";
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SPEC 자기검산 — offset·요일이 어긋나면 오타로 보고 중단.
const OFFSET = daysBetween(START_ISO, GRAD_ISO);
const ALLOWED_OFFSETS = [50, 57]; // = lib/config/cohort-dates.ALLOWED_GRAD_OFFSETS (mjs 는 TS import 불가)
const startDow = new Date(`${START_ISO}T00:00:00Z`).getUTCDay(); // 5 = 금
if (!ISO.test(START_ISO) || !ISO.test(GRAD_ISO) || !ALLOWED_OFFSETS.includes(OFFSET)) {
  console.error(`❌ SPEC 오류: ${O1}=${START_ISO} ${O2}=${GRAD_ISO} (offset ${OFFSET}일) — 허용 ${ALLOWED_OFFSETS.join("/")}일`);
  process.exit(2);
}
if (startDow !== 5) {
  console.error(`❌ SPEC 오류: ${START_ISO} 이 금요일이 아닙니다(주차 요일 라벨이 통째로 밀림).`);
  process.exit(2);
}

// ── 시트 I/O (실패를 삼키지 않는다 + POST 백오프) ───────────────
async function get(range, sid = REGISTRY_ID, valueRenderOption = "UNFORMATTED_VALUE", dateTimeRenderOption = "FORMATTED_STRING") {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range,
    valueRenderOption,
    dateTimeRenderOption,
  });
  return res.data.values ?? [];
}
/** batchUpdate 는 POST — gaxios 기본 재시도 대상이 아니다(429/5xx 직격). 3회 지수백오프. */
async function batchUpdate(spreadsheetId, data, valueInputOption = "USER_ENTERED") {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption, data },
      });
    } catch (e) {
      lastErr = e;
      const code = e?.code ?? e?.response?.status;
      if (![429, 500, 502, 503].includes(Number(code))) throw e;
      const wait = 2000 * 2 ** attempt;
      console.log(`    ⏳ ${code} — ${wait / 1000}s 후 재시도(${attempt + 1}/3)`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** 레지스트리에서 대상 행 발견 — cohort 정규화("10기"·" 10" 흡수) 후 정확 일치. */
async function targets() {
  const rows = await get(`'${REGISTRY_TAB}'!A2:L`);
  return rows
    .map((r, i) => ({
      row: i + 2,
      email: String(r?.[0] ?? "").trim(),
      cohort: String(r?.[1] ?? "").replace(/기\s*$/, "").trim(),
      name: String(r?.[2] ?? "").trim(),
      sid: String(r?.[3] ?? "").trim(),
      I: String(r?.[8] ?? "").trim(),
      J: String(r?.[9] ?? "").trim(),
      K: normDate(r?.[10]),
      L: normDate(r?.[11]),
    }))
    .filter((u) => u.cohort === COHORT);
}

/**
 * 개인시트 현재값. 읽기 실패는 **삼키지 않고** ok:false 로 올린다(빈 셀 오인 → 덮어쓰기 차단).
 * O1/O2 는 두 렌더 모두 필요: FORMULA(수식 판별) + SERIAL(실제 날짜 확정 — FORMULA 렌더는
 * 표시서식 "6/12" 로 와서 연도를 알 수 없다). B3/C3 도 FORMULA 렌더(수식이면 손대지 않음).
 */
async function sheetState(sid) {
  try {
    const [oF, oS, profF] = await Promise.all([
      get(`'${SALES_TAB}'!${O1}:${O2}`, sid, "FORMULA"),
      get(`'${SALES_TAB}'!${O1}:${O2}`, sid, "UNFORMATTED_VALUE", "SERIAL_NUMBER"),
      get(`'${SALES_TAB}'!B3:C3`, sid, "FORMULA"),
    ]);
    const o1Raw = oF?.[0]?.[0];
    const o2Raw = oF?.[1]?.[0];
    const b3Raw = profF?.[0]?.[0];
    const c3Raw = profF?.[0]?.[1];
    return {
      ok: true,
      o1Raw,
      o2Raw,
      o1: normDate(oS?.[0]?.[0]) || normDate(o1Raw),
      o2: normDate(oS?.[1]?.[0]) || normDate(o2Raw),
      o1IsFormula: String(o1Raw ?? "").startsWith("="),
      o2IsFormula: String(o2Raw ?? "").startsWith("="),
      o1Empty: o1Raw === undefined || String(o1Raw).trim() === "",
      o2Empty: o2Raw === undefined || String(o2Raw).trim() === "",
      b3: String(b3Raw ?? "").trim(),
      c3: String(c3Raw ?? "").trim(),
      b3IsFormula: String(b3Raw ?? "").startsWith("="),
      c3IsFormula: String(c3Raw ?? "").startsWith("="),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 90) : String(e) };
  }
}

/** 기존 기록 탐지 — O1 을 옮기면 이미 적힌 기록의 주차 귀속이 통째로 밀린다(§안전장치 ④). */
async function probeRecords(sid) {
  const found = [];
  for (const p of PROBE) {
    try {
      // FORMULA 렌더 = 수식은 "=..." 로 보인다 → 골격을 기록으로 오인하지 않는다.
      const rows = await get(p.range, sid, "FORMULA");
      const n = rows.filter((r) =>
        p.cols.some((ci) => {
          const s = String((r ?? [])[ci] ?? "").trim();
          if (s === "" || s.startsWith("=")) return false; // 빈칸·수식 = 골격
          return p.numericOnly ? Number.isFinite(Number(s)) : true;
        }),
      ).length;
      if (n > 0) found.push(`${p.label} ${n}행`);
    } catch (e) {
      // 탭이 없는 시트(10기는 5탭)는 정상 — 그 밖의 실패는 보수적으로 "확인 불가"로 올린다.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/Unable to parse range|not found/i.test(msg)) found.push(`${p.label} 확인불가(${msg.slice(0, 40)})`);
    }
  }
  return found;
}

/**
 * 날짜 판정. 알려진 템플릿 지문(O1=TEMPLATE_O1 · 수식 · 빈값)만 잔재로 인정한다.
 * 한쪽만 이미 목표값이면 나머지 한 칸만 마무리(부분 기록 후 영구 hold 로 굳는 것 방지).
 */
function decide(st) {
  if (!st.ok) return { action: "hold", why: `시트 읽기 실패 — ${st.error}` };
  const o1Ok = st.o1 === START_ISO && !st.o1IsFormula;
  const o2Ok = st.o2 === GRAD_ISO && !st.o2IsFormula;
  if (o1Ok && o2Ok) return { action: "skip", why: "이미 목표값(리터럴)" };
  const stale = (iso, isFormula, empty) => isFormula || empty || iso === TEMPLATE_O1;
  const o1Stale = o1Ok || stale(st.o1, st.o1IsFormula, st.o1Empty);
  const o2Stale = o2Ok || stale(st.o2, st.o2IsFormula, st.o2Empty) || st.o2 === GRAD_ISO;
  if (o1Stale && o2Stale) {
    return {
      action: "write",
      why: o1Ok || o2Ok ? "한쪽만 목표값 — 나머지 마무리" : `템플릿 지문(${TEMPLATE_O1}/수식/빈값)`,
    };
  }
  if (ALLOW_UNEXPECTED) return { action: "write", why: "예상 밖이지만 --allow-unexpected" };
  return {
    action: "hold",
    why: `예상 밖 값 — 사람이 넣었을 수 있어 보존 (${O1}=${st.o1 || "?"} ${O2}=${st.o2 || "?"})`,
  };
}

/**
 * B3(기수)/C3(이름) 판정 — 같은 사고의 동반 오염(0605 템플릿이 B3=8·C3 빈값을 물고 옴).
 * B3 는 앱 표시 기수의 정본(me.ts 가 레지스트리보다 우선) → 두면 10기가 "8기"로 보인다.
 * 덮어쓰기는 **빈값 또는 다른 숫자 기수**(=잔재)일 때만. 그 밖 문자열·수식·다른 이름은 hold.
 */
function decideProfile(st, name) {
  if (!st.ok) return { action: "hold", writeB3: false, writeC3: false, hold: [`시트 읽기 실패`] };
  const hold = [];
  const b3Numeric = /^\d+\s*기?$/.test(st.b3);
  const b3Ok = st.b3 === COHORT;
  let writeB3 = false;
  if (!b3Ok) {
    if (st.b3IsFormula) hold.push(`B3 가 수식(${st.b3})`);
    else if (st.b3 === "" || b3Numeric) writeB3 = true;
    else if (ALLOW_UNEXPECTED) writeB3 = true;
    else hold.push(`B3="${st.b3}" 가 예상 밖(숫자 기수 아님)`);
  }
  let writeC3 = false;
  if (st.c3 !== name) {
    if (st.c3IsFormula) hold.push(`C3 가 수식(${st.c3})`);
    else if (st.c3 === "" && !!name) writeC3 = true;
    else if (ALLOW_UNEXPECTED) writeC3 = true;
    else hold.push(`C3="${st.c3}" ≠ 레지스트리 이름`);
  }
  return {
    writeB3,
    writeC3,
    hold,
    action: writeB3 || writeC3 ? "write" : hold.length ? "hold" : "skip",
  };
}

function table(list) {
  console.log("  행# | cohort | name    | sheetId(끝6) | I  | J       | K(시작)    | L(종강)");
  for (const t of list) {
    console.log(
      `  ${String(t.row).padStart(3)} | ${t.cohort.padEnd(6)} | ${mask(t.name).padEnd(7)} | …${t.sid.slice(-6)} | ${(t.I || "-").padEnd(2)} | ${mask(t.J).padEnd(7)} | ${(t.K || "-").padEnd(10)} | ${t.L || "-"}`,
    );
  }
}

/** 실측 검증 — 반드시 **재조회**한 값으로 판정(쓰기 전 스냅샷 재사용 금지). */
async function verify() {
  const rows = await targets();
  console.log(`\n── 레지스트리 ${COHORT}기 행 (${rows.length}행, 재조회) ──`);
  table(rows);
  console.log(`\n── 개인시트 실측 (B3 | C3 | ${O1} | ${O2}) ──`);
  let ok = 0;
  let profOk = 0;
  for (const t of rows) {
    const st = await sheetState(t.sid);
    if (!st.ok) {
      console.log(`  ❌ ${mask(t.name).padEnd(7)} 읽기 실패 — ${st.error}`);
      continue;
    }
    // O2 가 수식으로 남으면 값이 맞아도 초록 아님 (ADR-0005 리터럴 확정 SPEC).
    const good = st.o1 === START_ISO && st.o2 === GRAD_ISO && !st.o1IsFormula && !st.o2IsFormula;
    const pGood = st.b3 === COHORT && st.c3 === t.name && t.name !== "";
    if (good) ok++;
    if (pGood) profOk++;
    console.log(
      `  ${good && pGood ? "✅" : "❌"} ${mask(t.name).padEnd(7)} B3=${st.b3 || "?"} | C3=${mask(st.c3)} | ${O1}=${st.o1 || "?"}${st.o1IsFormula ? "(수식)" : ""} | ${O2}=${st.o2 || "?"}${st.o2IsFormula ? "(수식)" : ""}`,
    );
  }
  const kl = rows.filter(
    (t) => t.K === START_ISO && t.L === GRAD_ISO && t.I === COHORT && t.J === t.name,
  ).length;
  console.log(
    `\n  시트 날짜(리터럴): ${ok}/${rows.length} · 시트 프로필(B3=${COHORT}·C3=이름): ${profOk}/${rows.length} · ` +
      `레지스트리 I~L: ${kl}/${rows.length}   목표 ${O1}=${START_ISO} · ${O2}=${GRAD_ISO}`,
  );
  // 개막 준비 부가 확인(읽기 전용) — admin 기수 박스는 cohorts 탭 기준.
  try {
    const c = await get(`'cohorts'!A2:D`);
    const r = c.find((x) => String(x?.[0] ?? "").trim() === COHORT);
    console.log(
      r
        ? `  cohorts 탭 ${COHORT} 행: status=${r[1] ?? ""} type=${r[3] || "(빈값=cohort)"} ✅`
        : `  ⚠️ cohorts 탭에 ${COHORT} 행이 없습니다 — admin 기수 박스에 안 보입니다.`,
    );
  } catch {
    console.log("  (cohorts 탭 확인 생략 — 읽기 실패)");
  }
  return ok === rows.length && profOk === rows.length && kl === rows.length;
}

async function main() {
  console.log(`\n🗓  ${COHORT}기 날짜 마감 — mode = ${VERIFY_ONLY ? "VERIFY" : EXECUTE ? "EXECUTE" : "DRY-RUN"}`);
  console.log(
    `   레지스트리=…${REGISTRY_ID.slice(-6)} tab=${REGISTRY_TAB} · 목표 ${O1}=${START_ISO}(금) · ${O2}=${GRAD_ISO} (offset ${OFFSET}일)`,
  );
  if (ALLOW_UNEXPECTED) console.log("   ⚠️ --allow-unexpected: 예상 밖 값도 덮어씁니다");
  if (ALLOW_EXISTING) console.log("   ⚠️ --allow-existing-records: 기록 있는 시트도 flip 합니다");

  if (VERIFY_ONLY) {
    const done = await verify();
    process.exit(done ? 0 : 1);
  }

  const list = await targets();
  console.log(`\n── 대상 발견 (레지스트리 cohort=${COHORT}) : ${list.length}행 ──`);
  table(list);
  const noSid = list.filter((t) => !t.sid);
  const noName = list.filter((t) => !t.name);
  const sids = list.map((t) => t.sid);
  const dupSid = sids.filter((s, i) => sids.indexOf(s) !== i);
  // 같은 시트를 공유하는 행(부부)은 email 까지 같을 때만 진짜 중복.
  const hardDup = dupSid.some(
    (s) => new Set(list.filter((t) => t.sid === s).map((t) => t.email.toLowerCase())).size === 1,
  );
  if (list.length !== EXPECTED_ROWS || noSid.length > 0 || noName.length > 0 || hardDup) {
    console.error(
      `\n❌ 대상 검증 실패 — 기대 ${EXPECTED_ROWS}행 · 시트ID 공란 0 · 이름 공란 0 · 동일행 중복 0` +
        ` (실측 ${list.length}행 · 시트ID공란 ${noSid.length} · 이름공란 ${noName.length} · 중복 ${hardDup ? "있음" : "없음"})` +
        `\n   레지스트리를 먼저 확인하세요. 이 상태로는 기록하지 않습니다.`,
    );
    process.exit(1);
  }
  console.log(`  ✅ 대상 검증 통과 (${EXPECTED_ROWS}행 · 시트ID 유일 · 이름·ID 공란 0)`);
  if (dupSid.length > 0) console.log(`  ℹ️ 시트 공유 행 있음(부부 등): …${dupSid.map((s) => s.slice(-6)).join(", …")}`);

  // ── Phase 0: 기존 기록 탐지 (flip 이 기록 귀속을 밀지 않는지) ──
  console.log(`\n[0] 기존 기록 점검 — O1 이동 시 주차 귀속이 밀리는지 (읽기 전용)`);
  const recordHold = new Set();
  for (const t of list) {
    const found = await probeRecords(t.sid);
    if (found.length === 0) {
      console.log(`  ${mask(t.name)}: 기록 0 ✅ (flip 무해)`);
    } else {
      console.log(`  ${mask(t.name)}: ⚠️ ${found.join(" · ")}`);
      if (!ALLOW_EXISTING) recordHold.add(t.row);
    }
  }
  if (recordHold.size > 0) {
    console.log(
      `  → 기록 있는 ${recordHold.size}개 시트는 **보류**합니다(개막일 이동이 그 기록의 주차를 밀기 때문).` +
        `\n     확인 후 의도한 flip 이면: --execute --allow-existing-records`,
    );
  }

  // ── Phase A: 개인시트 O1/O2 + 프로필 B3/C3 ──────────────────
  console.log(`\n[A] 개인시트 ${O1}/${O2} · B3(기수)/C3(이름) — ${SALES_TAB}`);
  const holdRows = new Set(recordHold);
  const failed = [];
  let written = 0;
  let skipped = 0;
  let profWritten = 0;
  for (const t of list) {
    const st = await sheetState(t.sid);
    const d = recordHold.has(t.row) ? { action: "hold", why: "기존 기록 보유(Phase 0)" } : decide(st);
    // 날짜를 hold 한 시트는 프로필도 손대지 않는다 — "안 만진다"는 판정과 동작을 일치.
    const p = d.action === "hold" ? { action: "hold", writeB3: false, writeC3: false, hold: ["날짜 hold 동반"] } : decideProfile(st, t.name);
    const cur = st.ok
      ? `${O1}=${st.o1 || "(빈값)"}${st.o1IsFormula ? "(수식)" : ""} ${O2}=${st.o2 || "(빈값)"}${st.o2IsFormula ? "(수식)" : ""} B3=${st.b3 || "(빈값)"} C3=${mask(st.c3)}`
      : `읽기 실패 — ${st.error}`;
    console.log(
      `  ${mask(t.name)}: 현재 ${cur}\n      날짜→${d.action.toUpperCase()} (${d.why})  ·  프로필→${p.action.toUpperCase()}` +
        (p.hold?.length ? ` (${p.hold.join(", ")})` : p.action === "write" ? ` (${[p.writeB3 && `B3="${st.b3 || "빈값"}"→${COHORT}`, p.writeC3 && `C3 빈값→이름`].filter(Boolean).join(" · ")})` : " (이미 정상)"),
    );

    if (d.action === "hold" || p.action === "hold") holdRows.add(t.row);
    if (d.action === "skip" && p.action !== "write") skipped++;

    const writes = [];
    if (d.action === "write") {
      writes.push(
        { range: `'${SALES_TAB}'!${O1}`, values: [[START_ISO]] },
        { range: `'${SALES_TAB}'!${O2}`, values: [[GRAD_ISO]] },
      );
    }
    if (p.writeB3) writes.push({ range: `'${SALES_TAB}'!B3`, values: [[COHORT]] });
    if (p.writeC3) writes.push({ range: `'${SALES_TAB}'!C3`, values: [[t.name]] });
    if (!EXECUTE || writes.length === 0) continue;

    try {
      // 날짜는 시리얼 인식(주차 계산 전제), B3 은 템플릿과 같은 숫자형이 된다 → USER_ENTERED.
      await batchUpdate(t.sid, writes);
      if (d.action === "write") written++;
      if (p.writeB3 || p.writeC3) profWritten++;
      console.log(`    ✔ 기록 완료 (${writes.map((w) => w.range.split("!")[1]).join("·")})`);
    } catch (e) {
      // 한 시트 실패가 전체를 세우지 않는다 — 그 행만 캐시 보류 + 마지막에 요약.
      holdRows.add(t.row);
      failed.push({ row: t.row, name: t.name, why: e instanceof Error ? e.message.slice(0, 90) : String(e) });
      console.log(`    ❌ 기록 실패 — ${failed[failed.length - 1].why}`);
    }
  }

  // ── Phase B: 레지스트리 I~L 캐시 (시트 실측값의 캐시) ────────
  console.log(`\n[B] 레지스트리 I~L 캐시 (I=기수 · J=이름 · K=시작 · L=종강)`);
  const klTargets = list.filter(
    (t) => t.K !== START_ISO || t.L !== GRAD_ISO || t.I !== COHORT || t.J !== t.name,
  );
  const klWrite = klTargets.filter((t) => !holdRows.has(t.row)); // 시트를 못 고친 행은 캐시도 두지 않는다
  for (const t of klTargets) {
    console.log(
      `  ${t.row}행 ${mask(t.name)}: I="${t.I || "(빈값)"}"→"${COHORT}" J="${t.J ? mask(t.J) : "(빈값)"}"→이름 ` +
        `K="${t.K || "(빈값)"}"→"${START_ISO}" L="${t.L || "(빈값)"}"→"${GRAD_ISO}"` +
        (holdRows.has(t.row) ? "  ⏸ 보류(시트 hold/실패 동반)" : ""),
    );
  }
  if (klTargets.length === 0) console.log("  (전 행 이미 동기 — 멱등 OK)");
  if (EXECUTE && klWrite.length > 0) {
    await batchUpdate(
      REGISTRY_ID,
      klWrite.map((t) => ({
        range: `'${REGISTRY_TAB}'!I${t.row}:L${t.row}`,
        values: [[COHORT, t.name, START_ISO, GRAD_ISO]],
      })),
      "RAW", // 캐시 컬럼은 문자열 그대로 (users.ts 가 String 파싱)
    );
    console.log(`  ✔ I~L 기록 ${klWrite.length}행`);
  }

  // ── 결과 ────────────────────────────────────────────────────
  if (!EXECUTE) {
    const plan = list.filter((t) => !holdRows.has(t.row)).length;
    console.log(
      `\nDRY-RUN — 기록 없음. 계획: 시트 ${plan}개 · 레지스트리 ${klWrite.length}행` +
        `${holdRows.size ? ` · ⚠️보류 ${holdRows.size}개` : ""}` +
        `\n검토 후: node scripts/ops/finalize-cohort10.mjs --execute`,
    );
    process.exit(0);
  }

  console.log(
    `\nEXECUTE 완료 — 날짜 ${written}시트 · 프로필 ${profWritten}시트 · skip ${skipped} · 보류 ${holdRows.size} · 실패 ${failed.length}`,
  );
  if (failed.length > 0) {
    console.log("  실패 행(재실행은 멱등 — 다시 --execute 후 --verify):");
    failed.forEach((f) => console.log(`   · ${f.row}행 ${mask(f.name)} — ${f.why}`));
  }
  const done = await verify();
  console.log(
    done
      ? `\n✅ ${COHORT}기 날짜·프로필·캐시 4항목 일치. 앱 화면 반영은 캐시 TTL(레지스트리 60s·me-bundle 600s) 후.` +
          `\n   ※ O2 는 리터럴이다 — 나중에 O1 을 손으로 고치면 O2 도 같이 고쳐야 한다.`
      : `\n❌ 일부 불일치 — 위 실측 표 확인(보류·실패 행은 사유 출력됨).`,
  );
  process.exit(done ? 0 : 1);
}

main().catch((e) => {
  console.error("실패:", e instanceof Error ? e.message : e);
  process.exit(2);
});

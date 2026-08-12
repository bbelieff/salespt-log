/**
 * BBE-67 — 5기 legacy 탭 정밀 census (READ-ONLY). 2026-08-11.
 *
 * 목적: C작업원B STOP 보고("현행 파싱 가정과 구조적으로 다름, 정밀 census 필요")에 대한
 * 실측 응답. grid-indexed 명시 A1 range 로 8개 5기 시트(영업관리·계약관리·DB관리)를 읽어
 * 헤더 위치·컬럼 배치·채널 라벨·데이터 시작행을 구조로만 확정한다. 실제 셀 값(고객사명·
 * 금액 등 실데이터)은 절대 출력하지 않는다 — 헤더/라벨(템플릿 어휘, PII 아님)만 원문 출력,
 * 데이터 셀은 타입 태그(<date>/<number>/<text:N자>/<empty>)로만 표시.
 *
 * 실행: node scripts/census-bbe67-legacy-5gi-2026-08-11.mjs   (repo root, .env.local 필요)
 * 쓰기: 0건. scope = spreadsheets.readonly.
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
const SA_EMAIL = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const SA_KEY = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
if (!SA_EMAIL || !SA_KEY) { console.error("census: SA 자격 누락."); process.exit(1); }

// READ-ONLY scope — 쓰기 물리 불가.
const auth = new google.auth.JWT(SA_EMAIL, undefined, SA_KEY, [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
]);
const sheets = google.sheets({ version: "v4", auth });

// source ID = G작업원D manifest bbe67-5g-v2(Linear BBE-67 코멘트 f1eca427) 정본 그대로.
// 이름은 이 스크립트/출력물에 남기지 않는다 — source-N 익명 라벨만 사용.
const SOURCES = [
  { label: "source-1", sid: "16F4pKPuNkkgwhFeU8CrWa6dVU_rbJ-T3LKc2Hk208n4" },
  { label: "source-2", sid: "1q33IhL1Uq47Oqr7uRmZ7NgSzgk1XdgDJZMtd5nTGMuk" },
  { label: "source-3", sid: "1Sod7B0jIVR1PmeVX7OMZz3nJhvPFpLNdXQwLO32bjfY" },
  { label: "source-4", sid: "1aBF4OcDsOTA1VWhAy50LmIFuMLlTmaA0BiJYy5QpS44" },
  { label: "source-5", sid: "1ss9ZzzojlM7mH2SE7uh4aRrTXph9h4J7X3r02JpD19o" },
  { label: "source-6", sid: "1vgKxxo2b_OC-9xSjh3lMEBNuaIiTrsauhhBWPIq2s30" },
  { label: "source-7", sid: "1C0H9fwwLpD8LxqndBeU6BW-TMaVZXybOJ_WtnzzaO0U" },
  { label: "source-8", sid: "1uoGeVON2DOimCp9R_C2Vmr05ObZMn2gCfX31VeAHuGE" },
];

// 템플릿 어휘(헤더/라벨) 화이트리스트 — 원문 출력 허용. 이 밖은 전부 타입 태그로만.
const SAFE_LABEL_RE =
  /^(계약일|수임비|계약조건|메모|비고|진행기관|진행률|현황|승인금액|수납액|수납일|업체명|장소|채널|날짜|일자|주차|매입|매입DB|직접생산|현수막|콜|지|기|소|콜지기소|콜·지·기·소|지인|기존고객|소개|구매일|개당단가|주문개수|부가세|합계|총계|생산|컨택|미팅|계약수|수강시작일|종강|기수|이름|번호|No\.?|일|월|화|수|목|금|토)$/;

function isDateLike(v) {
  if (typeof v === "number") return v > 30000 && v < 60000; // 시리얼 날짜 대략 범위
  if (typeof v !== "string") return false;
  return /^\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}/.test(v.trim());
}
function tag(v) {
  const s = v === null || v === undefined ? "" : v;
  if (s === "") return "<empty>";
  if (typeof s === "string" && SAFE_LABEL_RE.test(s.trim())) return `"${s.trim()}"`;
  if (isDateLike(s)) return "<date>";
  if (typeof s === "number" || /^-?\d+(\.\d+)?$/.test(String(s).trim())) return "<number>";
  const str = String(s).trim();
  return `<text:${str.length}자>`;
}
function rowSummary(r) {
  return "[" + (r ?? []).map(tag).join(", ") + "]";
}

async function grid(sid, range) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid, range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return res?.data.values ?? [];
  } catch (e) {
    const msg = String(e?.message ?? e);
    return { error: /Unable to parse range/.test(msg) ? "탭없음" : msg.slice(0, 80) };
  }
}

async function main() {
  console.log("=== BBE-67 5기 legacy census (구조만, PII 마스킹) ===\n");

  // Phase 1 — 전체 8개 소스, 3탭 sentinel(헤더+상단 15행)로 구조 균일성 확인.
  console.log("── Phase 1: 8/8 sentinel(A1:R15) ──\n");
  const TABS = ["영업관리", "계약관리", "DB관리"];
  const phase1 = {};
  for (const src of SOURCES) {
    phase1[src.label] = {};
    for (const tabName of TABS) {
      const rows = await grid(src.sid, `'${tabName}'!A1:R15`);
      phase1[src.label][tabName] = Array.isArray(rows) ? rows.length : rows;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  for (const src of SOURCES) {
    const line = TABS.map((t) => {
      const v = phase1[src.label][t];
      return `${t}=${typeof v === "object" && !Array.isArray(v) ? v.error : v + "행"}`;
    }).join(" · ");
    console.log(`${src.label}: ${line}`);
  }

  // Phase 2 — 대표 2개 소스(source-1·source-5, 서로 다른 최종행수 그룹) 심층 구조 매핑.
  const DEEP = [SOURCES[0], SOURCES[4]];
  for (const src of DEEP) {
    console.log(`\n\n══════ Phase 2 심층: ${src.label} ══════`);

    console.log("\n[영업관리 A1:R60]");
    const sales = await grid(src.sid, `'영업관리'!A1:R60`);
    if (Array.isArray(sales)) {
      sales.forEach((r, i) => console.log(`  r${i + 1}: ${rowSummary(r)}`));
    } else console.log(`  ERROR: ${sales.error}`);

    console.log("\n[계약관리 A1:AK25]");
    const contracts = await grid(src.sid, `'계약관리'!A1:AK25`);
    if (Array.isArray(contracts)) {
      contracts.forEach((r, i) => console.log(`  r${i + 1}: ${rowSummary(r)}`));
    } else console.log(`  ERROR: ${contracts.error}`);

    console.log("\n[DB관리 A1:AJ25]");
    const db = await grid(src.sid, `'DB관리'!A1:AJ25`);
    if (Array.isArray(db)) {
      db.forEach((r, i) => console.log(`  r${i + 1}: ${rowSummary(r)}`));
    } else console.log(`  ERROR: ${db.error}`);

    // sales 는 stride 를 확인하려면 더 넓게 봐야 함 — 끝까지 스캔해 데이터 마지막 행 탐색.
    console.log("\n[영업관리 전체 스캔 — 데이터 존재 마지막 행 탐색]");
    const salesFull = await grid(src.sid, `'영업관리'!A1:R400`);
    if (Array.isArray(salesFull)) {
      let lastData = -1;
      salesFull.forEach((r, i) => {
        if ((r ?? []).some((v) => String(v ?? "").trim() !== "")) lastData = i;
      });
      console.log(`  총 읽은 행 ${salesFull.length}, 마지막 비어있지 않은 행 = r${lastData + 1}`);
    } else console.log(`  ERROR: ${salesFull.error}`);
  }

  console.log("\n\n=== census 종료 — 쓰기 0건 ===");
}

main().catch((e) => {
  console.error("census 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * dashboard-parity.mjs 의 순수 로직 분리본 — I/O(Sheets·DB·env) 없음, import 시 부작용 없음.
 * CLI 진입점(dashboard-parity.mjs)과 테스트(tests/ops/dashboard-parity-lib.test.ts) 양쪽이 공유.
 * "dashboard-parity.mjs 는 모듈 로드 시점에 env 누락이면 process.exit(1) 을 던져 import 자체가
 * 안전하지 않다" 는 문제를 피하려고 분리했다(Hashimoto — 같은 함정을 또 만들지 않기).
 */

export const CHANNEL_ORDER = ["매입DB", "직접생산", "현수막", "콜·지·기·소"];

export const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0);

export const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));

export const coerce = (v) => {
  if (typeof v !== "string") return v;
  if (v === "true" || v === "TRUE") return true;
  if (v === "false" || v === "FALSE") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
};

export const serialToISO = (v) => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
};

export const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const diffDays = (a, b) => Math.round((a.getTime() - b.getTime()) / 86400000);
// WEEK-INDEX-SSOT-COPY: lib/util/week.ts weekIndexOf(시작일 앵커) 사본 — .mjs 는 TS import 불가. 수정 시 정본과 동기 (G8)
export const weekIndexOf = (date, cs) => { const d = diffDays(date, cs); return d < 0 ? 0 : Math.floor(d / 7) + 1; };

// MAX-SHEET-WEEK-SSOT-COPY: lib/config/cohort-dates.ts MAX_SHEET_WEEK(10) 사본 — .mjs 는 TS import
// 불가. 수정 시 정본과 동기(BBE-66, 2026-08-10 — 이 클램프 누락이 채널계약·sales 46건 오탐의 근인이었다).
const MAX_SHEET_WEEK = 10;

/** 시트가 물리적으로 담을 수 있는 주차 창(1~MAX_SHEET_WEEK) 안인가 — lib/service/dashboard-aggregates.ts
 * :inSheetWindow 사본. 날짜 없음/파싱 불가는 제외(fail-closed) — 창 판정을 못 하는 행이 지표를 부풀리지 않게. */
export function inSheetWindow(dateISO, courseStart) {
  if (!dateISO) return false;
  const w = weekIndexOf(parseISO(dateISO), courseStart);
  return Number.isFinite(w) && w >= 1 && w <= MAX_SHEET_WEEK;
}

/** DB payload → 값 (필드명 우선, 열문자 fallback). */
export function fieldOrCol(p, field, colIdx) {
  if (p[field] !== undefined && p[field] !== null && p[field] !== "") return p[field];
  return coerce(p[colName(colIdx)]);
}

/**
 * sales/meetings/contracts(정규화 완료) → 대시보드 4개 지표 + 필드별 **후보 행 풀**(contrib).
 * 소스 무관(DB row 든 시트 원본 row 든 이 정규화 형태로만 넘기면 동일하게 동작).
 *
 * contrib 는 "현재 식으로 실제 카운트된 행"이 아니라 그 필드의 **재계산 후보 전체**(대안식이
 * 다른 조건으로 다시 걸러볼 수 있게)를 담는다 — 예: R1:U6.{채널}.계약 의 contrib 는 그 채널의
 * 이월 아닌 미팅 전부(상태·계약여부 무관)다. 좁게 "이미 계약여부=true 였던 것"만 담으면
 * classifyDiff 의 대안식("상태=계약 기준")이 원래 후보군(상태=계약인데 계약여부=false 인 것)을
 * 못 보게 되어 로직차이를 못 잡는다 — 실제로 이 버그를 짜다가 발견해 고쳤다(단위테스트로 고정).
 */
export function computeAggregates(meetings, sales, contracts, courseStart, courseStartISO) {
  const alive = (s) => s === "예약" || s === "완료" || s === "계약";
  const done = (s) => s === "완료" || s === "계약";
  const cm = CHANNEL_ORDER.map((ch) => ({ 채널: ch, 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0, 미팅완료: 0, 계약: 0 }));
  const byCh = Object.fromEntries(cm.map((m) => [m.채널, m]));
  const contrib = new Map();
  const push = (key, row) => { if (!contrib.has(key)) contrib.set(key, []); contrib.get(key).push(row); };

  for (const r of sales) {
    const m = byCh[r.channel]; if (!m) continue;
    // 후보 풀은 창 여부와 무관하게 전부 담는다(대안식이 다시 걸러볼 수 있게) — 카운트만 창으로 클램프.
    push(`R1:U6.${r.channel}.생산`, r); push(`R1:U6.${r.channel}.유입`, r); push(`R1:U6.${r.channel}.컨택진행`, r);
    // BBE-66(2026-08-10): 정본(dashboard-aggregates.ts:97)은 시트 표현 가능 창(1~10주) 클램프를
    // 건다 — 이게 없으면 무제한 쓰기(11주+ DB-only) 행까지 합산돼 채널 매트릭스가 영구히 부푼다.
    if (!inSheetWindow(r.date, courseStart)) continue;
    m.생산 += r.production; m.유입 += r.inflow; m.컨택진행 += r.contactProgress;
  }
  for (const mt of meetings) {
    const m = byCh[mt.channel]; if (!m || mt.구분 === "이월") continue;
    // 후보 풀은 채널당 1번만 — 세 스테이지(예약/완료/계약) 가 같은 이월-아닌-미팅 집합을 공유한다.
    push(`R1:U6.${mt.channel}.미팅예약`, mt); push(`R1:U6.${mt.channel}.미팅완료`, mt); push(`R1:U6.${mt.channel}.계약`, mt);
    // 미팅예약(R4)·미팅완료(R5) = COUNTIFS 무필터(정본 실측) — 창 클램프 금지.
    if (alive(mt.상태)) m.미팅예약 += 1;
    if (done(mt.상태)) m.미팅완료 += 1;
    // 계약(R6) = N 주차블록 합(1~10주) — 정본과 동치화(BBE-66). 계약여부만 보고 창을 안 걸면 오탐.
    if (mt.계약여부 && inSheetWindow(mt.미팅날짜, courseStart)) m.계약 += 1;
  }
  const wc = new Array(8).fill(0);
  for (const mt of meetings) {
    // 후보 풀은 "이월 포함 전체"(대안식이 이월 제외를 걸어볼 수 있게) — 날짜·주차만으로 좁힌다.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mt.미팅날짜 || "")) continue;
    const w = weekIndexOf(parseISO(mt.미팅날짜), courseStart);
    if (w < 1 || w > 8) continue;
    push(`N.주${w}계약`, mt);
    if (mt.상태 === "계약") wc[w - 1] += 1;
  }
  const wa = new Array(8).fill(0);
  for (const r of sales) {
    if (!CHANNEL_ORDER.includes(r.channel) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const w = weekIndexOf(parseISO(r.date), courseStart);
    if (w < 1 || w > 8) continue;
    wa[w - 1] += r.production * 1 + r.contactProgress * 1.5;
    push(`H.주${w}활동`, r);
  }
  for (const mt of meetings) {
    if (mt.구분 === "이월" || !done(mt.상태) || !/^\d{4}-\d{2}-\d{2}$/.test(mt.미팅날짜 || "")) continue;
    const w = weekIndexOf(parseISO(mt.미팅날짜), courseStart);
    if (w >= 1 && w <= 8) { wa[w - 1] += 2; push(`H.주${w}활동`, mt); }
  }
  let fee = 0;
  for (const c of contracts) {
    // 후보 풀은 "전체 계약"(대안식이 이월/날짜 조건을 다르게 걸어볼 수 있게).
    push("B21.누적수임비", c);
    const carry = c.구분 === "이월" || (c.계약일 && c.계약일 < courseStartISO);
    if (!carry) fee += c.수임비;
  }
  return { channelMatrix: cm, weeklyContracts: wc, weeklyActivity: wa, 누적수임비: fee, contrib };
}

export function diff(sheet, db) {
  const out = [];
  const push = (f, s, d) => { if (num(s) !== num(d)) out.push({ f, s: num(s), d: num(d) }); };
  const STAGES = ["생산", "유입", "컨택진행", "미팅예약", "미팅완료", "계약"];
  for (const ch of CHANNEL_ORDER) { const s = sheet.channelMatrix.find((m) => m.채널 === ch); const d = db.channelMatrix.find((m) => m.채널 === ch); for (const st of STAGES) push(`R1:U6.${ch}.${st}`, s?.[st] ?? 0, d?.[st] ?? 0); }
  for (let i = 0; i < 8; i++) push(`N.주${i + 1}계약`, sheet.weeklyContracts[i] ?? 0, db.weeklyContracts[i] ?? 0);
  for (let i = 0; i < 8; i++) push(`H.주${i + 1}활동`, sheet.weeklyActivity[i] ?? 0, db.weeklyActivity[i] ?? 0);
  push("B21.누적수임비", sheet.누적수임비, db.누적수임비);
  return out;
}

// 시차(row-recount) 판정을 신뢰할 수 있는 필드만 — sales 미포함(미팅/계약 파생만). 나머지는 recount 안 넘김.
const MEETING_OR_CONTRACT_ONLY = /^R1:U6\.[^.]+\.(미팅예약|미팅완료|계약)$/;
export const isMeetingOrContractField = (f) => MEETING_OR_CONTRACT_ONLY.test(f) || /^N\.주\d+계약$/.test(f) || f === "B21.누적수임비";

/** 대안식 후보 — belie 실측으로 이미 확인된 "로직차이" 패턴들. */
export function buildAlternates(field) {
  const alts = [];
  if (/\.계약$/.test(field) && field.startsWith("R1:U6")) {
    // BBE-64 실측(2026-08-09): channelMatrix 의 계약 카운트가 계약여부(파생·동기화용 필드) 를
    // 쓰는데, 정본은 상태="계약" 이어야 한다(meeting.ts:79 주석 — 계약여부는 호환용).
    alts.push({ name: "상태=계약 기준(계약여부 대신)", recompute: (rows) => rows.filter((r) => r.상태 === "계약").length });
  }
  if (/^N\.주\d+계약$/.test(field)) {
    // lib/service/dashboard-aggregates.ts weeklyContractsFromDb 는 이월(AO) 배제가 없다(실측,
    // 2026-08-09 재확인 — 여전히 유효). 이월 제외를 걸었을 때 sheet 와 맞아떨어지면 이게 근인.
    // 후보 풀(N.주X계약)은 그 주차 미팅 전체(상태 무관) — 상태=계약 필터는 대안식이 직접 건다.
    alts.push({
      name: "이월(구분=이월) 제외 적용",
      recompute: (rows) => rows.filter((r) => r.상태 === "계약" && r.구분 !== "이월").length,
    });
  }
  if (field === "B21.누적수임비") {
    // 현재 식 = 구분≠이월 AND 계약일≥courseStart. 대안: 구분 조건만(날짜 조건 없이) — B21 정의가
    // 코드 주석상 한때 "미확정"이었던 이력이 있어(BBE-66) 후보로 남긴다.
    alts.push({
      name: "이월(구분)만 제외 — 계약일 조건 없이",
      recompute: (rows) => rows.filter((r) => r.구분 !== "이월").reduce((s, r) => s + r.수임비, 0),
    });
  }
  return alts;
}

/** 필드키(예: "R1:U6.매입DB.계약", "N.주3계약", "B21.누적수임비") → agg 객체에서 값 조회. */
export function lookupField(agg, field) {
  const rc = field.match(/^R1:U6\.([^.]+)\.(.+)$/);
  if (rc) { const m = agg.channelMatrix.find((x) => x.채널 === rc[1]); return m?.[rc[2]] ?? 0; }
  const nc = field.match(/^N\.주(\d+)계약$/);
  if (nc) return agg.weeklyContracts[Number(nc[1]) - 1] ?? 0;
  if (field === "B21.누적수임비") return agg.누적수임비;
  return undefined;
}

/** DB row(payload) → 정규화된 meetings row(_raw미팅날짜 로 렌더옵션 판정용 원값 보존). */
export function normalizeDbMeeting(p) {
  return {
    상태: String(fieldOrCol(p, "상태", 9) ?? ""),
    channel: String(fieldOrCol(p, "channel", 5) ?? ""),
    미팅날짜: (() => { const v = fieldOrCol(p, "미팅날짜", 3); return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
    계약여부: fieldOrCol(p, "계약여부", 10) === true || fieldOrCol(p, "계약여부", 10) === "TRUE",
    구분: String(fieldOrCol(p, "구분", 40) ?? "").trim(),
    _raw미팅날짜: fieldOrCol(p, "미팅날짜", 3),
  };
}

/** DB row(payload) → 정규화된 contracts row. */
export function normalizeDbContract(p) {
  return {
    수임비: num(fieldOrCol(p, "수임비", 4)),
    구분: String(fieldOrCol(p, "구분", 34) ?? "").trim(),
    계약일: (() => { const v = fieldOrCol(p, "계약일", 2); return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
    _raw계약일: fieldOrCol(p, "계약일", 2),
  };
}

/** DB row(payload) → 정규화된 sales row. */
export function normalizeDbSales(p) {
  return {
    date: String(p.date ?? "").slice(0, 10), channel: String(p.channel ?? ""),
    production: num(p.production), inflow: num(p.inflow), contactProgress: num(p.contactProgress),
    meetingReservation: num(p.meetingReservation),
  };
}

/** 시트 04(미팅) 원본 row(배열, A=idx0) → 정규화. */
export function normalizeSheetMeetingRow(r) {
  return {
    상태: String(r[9] ?? ""), channel: String(r[5] ?? ""),
    미팅날짜: (() => { const v = r[3]; return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
    계약여부: r[10] === true || r[10] === "TRUE",
    구분: String(r[40] ?? "").trim(),
  };
}

/** 시트 02(계약) 원본 row(배열, A=idx0) → 정규화. */
export function normalizeSheetContractRow(r) {
  return {
    수임비: num(r[4]), 구분: String(r[34] ?? "").trim(),
    계약일: (() => { const v = r[2]; return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
  };
}

// ── B21(누적수임비) 계약 지문 차집합 — BBE-66 550,000원 차이 근인 확정용 ─────────────
// belie 지시(2026-08-10): "DB가 정본"이라고 선언 금지 — sheet raw recount(6,600,000) < DB(7,150,000)
// 이므로 "DB 에 없는 행" 설명은 방향이 반대라 성립 불가. 개인정보(이름·이메일·회사명·행 인덱스)
// 없이 계약일·수임비·구분만으로 지문을 만들어 어느 쪽에 어떤 행이 몇 건 더/덜 있는지 확정한다.

/** 계약 row → B21 식별용 지문(계약일+수임비+구분). 이름·회사명 등 PII 는 애초에 normalize 단계에서 빠져 있음. */
export function contractFingerprint(c) {
  return `${c.계약일 || "(빈값)"}|${num(c.수임비)}|${c.구분 === "이월" ? "이월" : "일반"}`;
}
/** 계약일+수임비만(구분 무시) — "행은 양쪽에 있는데 구분(이월 판정)만 다르다" 드리프트 탐지용 보조키. */
export function contractFingerprintNoType(c) {
  return `${c.계약일 || "(빈값)"}|${num(c.수임비)}`;
}

function countByFingerprint(rows, fp) {
  const m = new Map();
  for (const r of rows) { const k = fp(r); m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
}

/**
 * B21 계약 집합(시트 원본 row vs DB row) 을 지문 멀티셋으로 차집합한다.
 * 반환은 4갈래 — sheet 에만 있음 / db 에만 있음 / 둘 다 있는데 건수(중복)가 다름 /
 * 계약일·수임비는 같은데 구분만 달라 한쪽만 카운트된 것으로 보이는 드리프트 후보.
 * 전부 익명(계약일·수임비·구분·건수만) — 이름·이메일·회사명 없음.
 */
export function diffContractFingerprints(sheetRows, dbRows) {
  const sheetMap = countByFingerprint(sheetRows, contractFingerprint);
  const dbMap = countByFingerprint(dbRows, contractFingerprint);
  const keys = new Set([...sheetMap.keys(), ...dbMap.keys()]);
  const onlyInSheet = [], onlyInDb = [], countMismatch = [];
  for (const k of keys) {
    const sc = sheetMap.get(k) ?? 0, dc = dbMap.get(k) ?? 0;
    if (sc === dc) continue;
    const [계약일, 수임비, 구분] = k.split("|");
    const entry = { 계약일, 수임비: Number(수임비), 구분, sheetCount: sc, dbCount: dc };
    if (sc > 0 && dc === 0) onlyInSheet.push(entry);
    else if (dc > 0 && sc === 0) onlyInDb.push(entry);
    else countMismatch.push(entry);
  }
  const sheetNoType = countByFingerprint(sheetRows, contractFingerprintNoType);
  const dbNoType = countByFingerprint(dbRows, contractFingerprintNoType);
  const seenNoTypeKeys = new Set();
  const typeDrift = [];
  for (const e of [...onlyInSheet, ...onlyInDb]) {
    const noTypeKey = `${e.계약일}|${e.수임비}`;
    if (seenNoTypeKeys.has(noTypeKey)) continue; // sheet-only/db-only 양쪽에서 같은 키가 중복 산출되는 것 방지
    if ((sheetNoType.get(noTypeKey) ?? 0) > 0 && (dbNoType.get(noTypeKey) ?? 0) > 0) {
      seenNoTypeKeys.add(noTypeKey);
      typeDrift.push({ 계약일: e.계약일, 수임비: e.수임비, detail: "계약일·수임비는 양쪽에 있으나 구분(이월 여부) 값이 다름 — 이월 판정 드리프트 후보" });
    }
  }
  return { onlyInSheet, onlyInDb, countMismatch, typeDrift };
}

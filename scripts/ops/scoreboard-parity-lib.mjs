/**
 * scoreboard-parity.mjs 의 순수 로직 분리본 — I/O 없음, import 시 부작용 없음.
 * num/serialToISO/parseISO/weekIndexOf 는 dashboard-parity-lib.mjs 재사용(중복 방지 — 이제
 * .mjs 간 상대 import 가 이 레포에서 확립된 패턴이라 WEEK-INDEX-SSOT-COPY 를 또 만들지 않는다).
 */
import { CHANNEL_ORDER, num, parseISO, serialToISO, weekIndexOf } from "./dashboard-parity-lib.mjs";

export { num, parseISO, serialToISO, weekIndexOf };

/**
 * sales/meetings(정규화 완료) → 전광판 주차별 5지표 + 필드별 후보 행 풀(contrib).
 * dashboard-parity-lib.mjs computeAggregates 와 같은 설계 원칙(contrib = 재계산 후보 전체,
 * 실제 카운트 조건으로 좁히지 않음).
 */
export function computeWeeklyPerf(meetings, sales, courseStart) {
  const done = (s) => s === "완료" || s === "계약";
  const weeks = Array.from({ length: 8 }, (_, w) => ({ week: w + 1, 생산: 0, 유입: 0, 컨택: 0, 미팅: 0, 계약: 0 }));
  const contrib = new Map();
  const push = (key, row) => { if (!contrib.has(key)) contrib.set(key, []); contrib.get(key).push(row); };

  for (const r of sales) {
    if (!CHANNEL_ORDER.includes(r.channel) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const w = weekIndexOf(parseISO(r.date), courseStart);
    if (w < 1 || w > 8) continue;
    const row = weeks[w - 1];
    row.생산 += r.production; row.유입 += r.inflow; row.컨택 += r.contactProgress;
    push(`주${w}.생산`, r); push(`주${w}.유입`, r); push(`주${w}.컨택`, r);
  }
  for (const m of meetings) {
    // 후보 풀은 "이월 포함 전체, 날짜만으로 좁힘" — 대안식이 이월 포함/제외를 직접 걸어볼 수 있게.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.미팅날짜 || "")) continue;
    const w = weekIndexOf(parseISO(m.미팅날짜), courseStart);
    if (w < 1 || w > 8) continue;
    push(`주${w}.미팅`, m); push(`주${w}.계약`, m);
    if (m.구분 === "이월") continue;
    const row = weeks[w - 1];
    if (done(m.상태)) row.미팅 += 1;
    if (m.상태 === "계약") row.계약 += 1;
  }
  return { weeks, contrib };
}

export function diffWeekly(sheetWeeks, dbWeeks) {
  const out = [];
  const push = (f, s, d) => { if (num(s) !== num(d)) out.push({ f, s: num(s), d: num(d) }); };
  const FIELDS = ["생산", "유입", "컨택", "미팅", "계약"];
  for (let i = 0; i < 8; i++) {
    for (const f of FIELDS) push(`주${i + 1}.${f}`, sheetWeeks[i]?.[f] ?? 0, dbWeeks[i]?.[f] ?? 0);
  }
  return out;
}

const MEETING_ONLY = /^주\d+\.(미팅|계약)$/;
export const isMeetingField = (f) => MEETING_ONLY.test(f);

/** 필드키(예: "주3.계약") → weeks 배열에서 값 조회. */
export function lookupWeekField(weeks, field) {
  const m = field.match(/^주(\d+)\.(.+)$/);
  if (!m) return undefined;
  return weeks[Number(m[1]) - 1]?.[m[2]] ?? 0;
}

/** 대안식 후보 — belie 실측으로 이미 확인된 "로직차이" 패턴. */
export function buildAlternates(field) {
  const alts = [];
  if (/\.계약$/.test(field)) {
    alts.push({
      name: "이월(구분=이월) 포함(제외 안 함)",
      recompute: (rows) => rows.filter((r) => r.상태 === "계약").length,
    });
  }
  if (/\.미팅$/.test(field)) {
    alts.push({
      name: "미팅완료(상태) 대신 미팅예약(sales.meetingReservation) 기준",
      // 이 대안은 sales row 가 아니라 meetings row 만 넘어오므로 원천적으로 0 — 후보로만 남기고
      // 실제 판별은 사람이 한다(시트·DB 양쪽 정의가 meetings 기반임을 이미 14개 단위테스트로
      // 고정했으므로 낮은 우선순위 — incident 문서 2026-08-10 참고).
      recompute: () => undefined,
    });
  }
  return alts;
}

/** DB row(payload) → 정규화된 meetings row. */
export function normalizeDbMeeting(p) {
  return {
    상태: String(p.상태 ?? ""),
    미팅날짜: String(p.미팅날짜 ?? "").slice(0, 10),
    구분: String(p.구분 ?? "").trim(),
    _raw미팅날짜: p.미팅날짜,
  };
}

/** 시트 04(미팅) 원본 row(배열, A=idx0) → 정규화 — dashboard-parity 와 같은 컬럼 위치(J/D/AO). */
export function normalizeSheetMeetingRow(r) {
  return {
    상태: String(r[9] ?? ""),
    channel: String(r[5] ?? ""),
    미팅날짜: (() => { const v = r[3]; return typeof v === "number" ? serialToISO(v) : String(v ?? "").slice(0, 10); })(),
    구분: String(r[40] ?? "").trim(),
  };
}

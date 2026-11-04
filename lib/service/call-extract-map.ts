/**
 * Layer: service — 통화 정리 AI 원답(질문별 「들은 말」) → 저장 형식 CallExtraction.
 * 0단계 convert.py(개인 드라이브 통화요약_0단계, 2026-10-31) 규칙을 그대로 옮겼다 — 고정 시험 tests/service/call-extract-map.test.ts.
 * AI 는 환산하지 않고 코드가 한다: 말 금액 → 백만원, 연도 → 매출 칸, 「다음 주 수요일 두 시」 → 날짜·15분 단위.
 * 근거 문장(evidence) 없는 답은 버린다(묻지도 않은 칸을 AI 가 채우는 것을 막는다). 집 주소·주민번호는 받는 칸이 없다.
 */
import { CallExtraction, type CallCompanyInfo } from "@/types/call";
import { meetingPlace } from "@/util/call-place";
import { wonToMillion } from "@/util/company-money";
import { salesSlotOf } from "@/util/company-sales";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

const NUM: Record<string, number> = {
  한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5, 여섯: 6,
  일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 스물: 20, 서른: 30, 마흔: 40, 쉰: 50,
};
const SINO: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const WEEK = "월화수목금토일";
const SALES_KEYS = ["금년도매출", "과년도매출", "과년도매출Y2", "과년도매출Y3"] as const;

/** 끝의 「~이에요·요·입니다」와 마침표를 뗀다. */
function stripEnd(s: string): string {
  return s.trim().replace(/\.+$/, "").replace(/\s*(이에요|예요|이요|입니다|이고요|이고|요)$/, "").trim();
}

/** '십이억' → '12억' (억·천·만 앞의 한자 수사만). */
function sinoToDigits(s: string): string {
  return s.replace(/(?<![가-힣])([일이삼사오육칠팔구]?십?[일이삼사오육칠팔구]?)(?=\s*(억|천|만))/g, (all, t: string) => {
    if (!t) return all;
    let n: number;
    if (t.includes("십")) {
      const [a, b] = t.split("십") as [string, string];
      n = (a ? SINO[a] ?? 1 : 1) * 10 + (b ? SINO[b] ?? 0 : 0);
    } else n = SINO[t] ?? 0;
    return n ? String(n) : all;
  });
}

/** 말로 한 금액 → 원. '4억 2천' = 4억 2천만, 단위 없는 100~99,999 는 만원(음성 인식이 「7천」을 「7000」으로 적는 경우). 못 읽으면 null. */
export function spokenWon(said: unknown): number | null {
  if (!said || typeof said !== "string") return null;
  const s = sinoToDigits(said.replace(/,/g, ""));
  let total = 0;
  let hit = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(억|천만|천|백만|만|년|월|일|명|층|번)?/g)) {
    const v = Number(m[1]);
    const unit = m[2];
    if (unit && "년월일명층번".includes(unit)) continue; // 날짜·사람 수는 금액이 아님
    if (unit === "억") total += v * 1e8;
    else if (unit === "천만" || unit === "천") total += v * 1e7;
    else if (unit === "백만") total += v * 1e6;
    else if (unit === "만") total += v * 1e4;
    else if (v >= 100 && v < 100000 && Number.isInteger(v)) total += v * 1e4;
    else continue;
    hit = true;
  }
  return hit ? Math.round(total) : null;
}

function koreanCount(said: string): number | null {
  let s = said.replace(/ /g, "");
  const d = s.match(/\d+/);
  if (d) return Number(d[0]);
  let n = 0;
  for (const w of ["스물", "서른", "마흔", "쉰", "열"]) {
    if (s.startsWith(w)) { n += NUM[w]!; s = s.slice(w.length); break; }
  }
  for (const w of ["하나", "다섯", "여섯", "일곱", "여덟", "아홉", "한", "두", "세", "네", "둘", "셋", "넷"]) {
    if (s.startsWith(w)) { n += NUM[w]!; break; }
  }
  return n || null;
}

function yearOf(when: string, callYear: number): string | null {
  if (!when) return null;
  const full = when.match(/(20\d{2})/);
  if (full) return full[1]!;
  const short = when.match(/(?<!\d)(\d{2})\s*년/); // "23년도" → 2023
  if (short) return `20${short[1]}`;
  if (when.includes("작년")) return String(callYear - 1);
  if (when.includes("올해") || when.includes("올 ")) return String(callYear);
  return null;
}

/** 통화 날짜(한국) 기준 날짜 계산 — 날짜만 다루므로 UTC 자정 Date 로 셈한다. */
type Day = Date;
const day = (y: number, m: number, d: number): Day => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Day, n: number): Day => new Date(d.getTime() + n * 86_400_000);
const mondayIndex = (d: Day) => (d.getUTCDay() + 6) % 7; // 월=0 … 일=6
const iso = (d: Day) => d.toISOString().slice(0, 10);

function resolveDate(said: string, call: Day): Day | null {
  const s = said.replace(/ /g, "");
  const wd = s.match(/([월화수목금토일])요일/);
  const md = s.match(/(\d{1,2})월(\d{1,2})일/);
  if (md) {
    let d = day(call.getUTCFullYear(), Number(md[1]), Number(md[2]));
    if (d < call) d = day(call.getUTCFullYear() + 1, Number(md[1]), Number(md[2]));
    if (wd && WEEK[mondayIndex(d)] !== wd[1]) return null; // 요일이 어긋나면 비우고 확인 요청
    return d;
  }
  if (wd) {
    const target = WEEK.indexOf(wd[1]!);
    const monday = addDays(call, -mondayIndex(call));
    if (s.includes("다음주") || s.includes("담주")) return addDays(monday, 7 + target);
    const d = addDays(monday, target);
    return d > call ? d : addDays(d, 7);
  }
  if (s.includes("모레")) return addDays(call, 2);
  if (s.includes("내일")) return addDays(call, 1);
  return null;
}

/** 「오후 두 시 반」 → "14:30". 오전·오후 말이 없으면 1~6시는 오후(영업시간). 15분 단위로 맞춘다. */
function resolveTime(said: string): string {
  const s = said.replace(/ /g, "");
  const hm = s.match(/(\d{1,2})시/);
  let h: number | null = hm ? Number(hm[1]) : null;
  if (h === null) {
    for (const w of ["열두", "열한", "열", "아홉", "여덟", "일곱", "여섯", "다섯", "네", "세", "두", "한"]) {
      if (s.includes(`${w}시`)) { h = w === "열두" ? 12 : w === "열한" ? 11 : NUM[w]!; break; }
    }
  }
  if (h === null) return "";
  const mm = s.match(/(\d{1,2})분/);
  const minute = mm ? Number(mm[1]) : s.includes("반") ? 30 : 0;
  if (s.includes("오후") || s.includes("저녁")) h = h < 12 ? h + 12 : h;
  else if (!s.includes("오전") && h >= 1 && h <= 6) h += 12;
  const total = Math.round((h * 60 + minute) / 15) * 15;
  if (total >= 24 * 60) return "";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * AI 원답 + 통화 시각(📞 누른 때, ISO) → CallExtraction. 결과는 확인 화면의 초안이고, 확정 전에는 아무 데도 쓰지 않는다.
 */
export function mapCallExtraction(rawIn: Obj, calledAt: string): CallExtraction {
  const k = new Date(Date.parse(calledAt) + 9 * 3_600_000); // 한국 시각
  const call = day(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate());
  const cy = call.getUTCFullYear();
  // 근거 문장이 비어 있는 답은 버린다
  const raw: Obj = Object.fromEntries(
    Object.entries(rawIn).map(([key, v]) => [key, isObj(v) && "evidence" in v && !v.evidence ? null : v]),
  );
  const g = (key: string): Obj | null => (isObj(raw[key]) && Object.keys(raw[key] as Obj).length ? (raw[key] as Obj) : null);
  const list = (key: string): Obj[] => (Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter(isObj) : []);

  const company: Record<string, string> = {};
  const custom: Record<string, string> = {};
  const lead: { company?: string; owner?: string } = {};
  const evidence: Record<string, string> = {};
  const answered = new Set<number>();
  const cite = (field: string, ...from: (Obj | null)[]) => {
    const lines = [...new Set(from.map((x) => str(x?.evidence)).filter(Boolean))];
    if (lines.length) evidence[field] = lines.join("\n").slice(0, 500);
  };

  // 1 대표 본인·법인/개인·상호
  const q1o = g("q1_is_owner"), q1k = g("q1_biz_kind"), q1c = g("q1_company"), q1n = g("q1_owner_name");
  if (q1o || q1k || q1c || q1n) answered.add(1);
  let owner = "", ownerFrom: Obj | null = null;
  if (q1o && q1o.value === "no" && str(q1o.real_owner)) { owner = stripEnd(str(q1o.real_owner)); ownerFrom = q1o; }
  else if (q1n && str(q1n.said)) { owner = stripEnd(str(q1n.said)); ownerFrom = q1n; }
  owner = owner.replace(/\s*(씨|대표|님)$/, "");
  if (owner) {
    company.대표자이름 = owner;
    lead.owner = owner;
    cite("대표자이름", ownerFrom);
    cite("lead.owner", ownerFrom);
  }
  if (q1c && str(q1c.said)) { lead.company = stripEnd(str(q1c.said)); cite("lead.company", q1c); }
  if (q1k && str(q1k.said)) {
    const kind = str(q1k.said);
    company.사업자구분 = kind.includes("법인") ? "법인" : kind.includes("개인") ? "개인" : "";
    if (company.사업자구분) cite("사업자구분", q1k);
    // 과세유형도 들었으면 같이 — 업체정보는 「개인 · 일반과세」처럼 한 칸에서 고른다(belie 2026-11-05).
    const tax = kind.includes("간이") ? "간이과세자" : kind.includes("면세") ? "면세사업자" : kind.includes("일반") ? "일반과세자" : "";
    if (tax) { company.과세유형 = tax; cite("과세유형", q1k); }
  }

  // 2 업종·생산품목
  const q2 = g("q2_industry");
  if (q2) {
    answered.add(2);
    if (str(q2.industry_said)) { company.업종주생산품목 = stripEnd(str(q2.industry_said)); cite("업종주생산품목", q2); }
    if (str(q2.product_said) && q2.product_said !== q2.industry_said) { company.주생산품목 = stripEnd(str(q2.product_said)); cite("주생산품목", q2); }
  }

  // 3 창업연월 — "22년도에 8월" · "6년쯤 전"
  const q3 = g("q3_founded");
  if (q3 && str(q3.said)) {
    answered.add(3);
    const said = str(q3.said);
    const m = said.match(/(20\d{2}|\d{2})\s*년\s*도?\s*에?(?:\s*(\d{1,2})\s*월)?/);
    const ago = said.match(/(\d{1,2})\s*년\s*(?:쯤|정도)?\s*전/);
    if (m) {
      const y = m[1]!.length === 4 ? m[1]! : `20${m[1]}`;
      company.개업일 = m[2] ? `${y}-${m[2].padStart(2, "0")}` : y;
    } else if (ago) company.개업일 = String(cy - Number(ago[1]));
    if (company.개업일) cite("개업일", q3);
  }

  // 4·5 매출 — 통화 연도가 기준 연도(Y)
  for (const s of list("q4_sales")) {
    const won = spokenWon(s.amount_said);
    const slot = typeof s.year === "number" ? salesSlotOf(s.year, cy) : null;
    if (won && slot !== null) {
      const key = SALES_KEYS[slot]!;
      company[key] = wonToMillion(won);
      cite(key, s);
      answered.add(4);
    }
  }
  const q5 = g("q5_sales_ytd");
  const ytd = q5 ? spokenWon(q5.amount_said) : null;
  if (q5 && ytd) { company.금년도매출 = wonToMillion(ytd); cite("금년도매출", q5); answered.add(5); }
  if (SALES_KEYS.some((key) => key in company)) company.매출기준연도 = String(cy);

  // 6·7 대출 — "기업은행 500백만 (2023)" 한 줄씩
  const loanLine = (name: string, x: Obj) => {
    const won = spokenWon(x.amount_said);
    if (!won) return null;
    const tail = [yearOf(str(x.when_said), cy), x.policy_fund === true ? "정책자금" : null].filter(Boolean);
    return `${name} ${wonToMillion(won)}백만${tail.length ? ` (${tail.join(", ")})` : ""}`;
  };
  const loans = (key: string, field: "기대출사업자" | "기대출개인", name: (x: Obj) => string, q: number) => {
    const used = list(key).map((x) => [x, loanLine(name(x), x)] as const).filter(([, l]) => l);
    if (!used.length) return;
    company[field] = used.map(([, l]) => l).join("\n");
    cite(field, ...used.map(([x]) => x));
    answered.add(q);
  };
  loans("q6_biz_loans", "기대출사업자", (x) => str(x.lender) || "기관", 6);
  loans("q7_personal_loans", "기대출개인", (x) => str(x.kind) || str(x.lender) || "대출", 7);

  // 8 직원 수
  const q8 = g("q8_employees");
  const staff = q8 ? koreanCount(str(q8.said)) : null;
  if (q8 && staff) { company.사대보험직원 = `${staff}명`; cite("사대보험직원", q8); answered.add(8); }

  // 9 수출 · 배달·키오스크 (사용자 추가 칸)
  for (const [key, label] of [["q9_export", "수출"], ["q9_delivery_kiosk", "배달·키오스크"]] as const) {
    const x = g(key);
    if (!x || !str(x.said)) continue;
    const said = stripEnd(str(x.said));
    custom[label] = label === "수출" && /(안\s*해|안\s*하|안\s*함|없)/.test(said) ? "없음" : said;
    cite(`custom.${label}`, x);
    answered.add(9);
  }

  // 10 특허·인증 · 11 신용점수 · 12 필요자금
  const q10 = g("q10_certs");
  if (q10 && str(q10.said)) {
    answered.add(10);
    if (!/(없|안\s*해)/.test(str(q10.said))) { company.특허및인증 = stripEnd(str(q10.said)); cite("특허및인증", q10); }
  }
  const q11 = g("q11_credit");
  const score = q11 ? str(q11.said).match(/\d{3}/) : null;
  if (score) { company.신용점수 = score[0]; cite("신용점수", q11); answered.add(11); }
  const q12 = g("q12_need");
  if (q12) {
    const need = spokenWon(q12.amount_said);
    if (need) { custom.필요자금 = `${wonToMillion(need)}백만`; cite("custom.필요자금", q12); answered.add(12); }
    if (str(q12.purpose_said)) { custom["자금 사용 목적"] = stripEnd(str(q12.purpose_said)); cite("custom.자금 사용 목적", q12); answered.add(12); }
  }

  // 사업장 주소 · 미팅
  const addr = g("address");
  const address = addr && str(addr.said)
    ? stripEnd(str(addr.said)).replace(/번지/g, "").trim().replace(/(\d+)\s*의\s*(\d+)/g, "$1-$2")
    : "";
  if (address) { company.소재지 = address; cite("소재지", addr); }

  let meeting: CallExtraction["meeting"] = null;
  const m = g("meeting");
  if (m && str(m.date_said)) {
    const d = resolveDate(`${str(m.date_said)} ${str(m.time_said)}`, call);
    // 「업장·사무실·가게」뿐이면 업체 주소로(belie 2026-11-05) — 실제 장소(역 출구·카페)는 그대로.
    const place = meetingPlace(stripEnd(str(m.place_said)), address);
    meeting = { meetingDate: d ? iso(d) : "", time: resolveTime(str(m.time_said) || str(m.date_said)), place, reservationNote: "" };
    cite("meeting", m);
  }

  const summary = Array.isArray(raw.summary) ? raw.summary.filter((x): x is string => typeof x === "string").slice(0, 3) : [];
  return CallExtraction.parse({
    summary: summary.map((x) => x.slice(0, 200)),
    memo: str(raw.memo).slice(0, 2000),
    answered: [...answered].sort((a, b) => a - b),
    lead,
    company: Object.fromEntries(Object.entries(company).filter(([, v]) => v)) as CallCompanyInfo,
    custom: Object.fromEntries(Object.entries(custom).map(([key, v]) => [key, v.slice(0, 500)])),
    meeting,
    evidence,
  });
}

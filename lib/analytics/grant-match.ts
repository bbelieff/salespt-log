/**
 * Layer: analytics(순수) — 업체 × 공고 맞음 판정(2026-10-26 맞춤공고 3단계, 핸드오프 §2·§7-3).
 *
 * 1차로 가르는 것 = 지역 · 소상공인 여부 · 제외 업종. 나머지(업종·업력·청년·여성 등)는 공고에 적혀 있을 때만 본다.
 * 모르면 떨어뜨리지 않고 「확인 필요」 — 놓치는 것보다 낫다. 판정 결과는 저장하지 않는다(읽을 때마다 계산).
 *   맞음(match)  : 적힌 조건을 다 확인했다.
 *   확인 필요(check): 안 맞는 조건은 없는데 모르는 게 있다 — 이유 한 줄씩.
 *   안 맞음(no)  : 적힌 조건과 분명히 다르다(다른 지역, 소상공인 아님, 마감 지남 등).
 */
import { grantProfile, type GrantProfile } from "@/lib/analytics/company-grant";
import { parseScopes, type PolicyAnnouncement } from "@/lib/analytics/policy-announcement";

export type Verdict = "match" | "check" | "no";

export interface GrantMatch {
  verdict: Verdict;
  /** 확인 필요·안 맞음의 이유(짧은 한 줄씩). 맞음이면 빈 배열. */
  reasons: string[];
  /** 마감 7일 이내 또는 예산 소진형 — 화면의 「소진 임박」. */
  urgent: boolean;
}

/** 판정에 쓰는 업체 글 — CompanyInfo 의 일부. */
export interface GrantMatchCompany {
  소재지?: string;
  업태?: string;
  업종주생산품목?: string;
  주생산품목?: string;
  특허및인증?: string;
  사대보험직원?: string;
  지역시도?: string;
  지역시군구?: string;
  대분류?: string;
  제외업종?: string;
  공고특성?: string;
  개업일?: string;
  대표자생년월일?: string;
  주민등록번호?: string;
}

const NONE = /^(해당\s*없음|제한\s*없음|없음|무관|전\s*업종)/;
const known = (t: string) => !!t && !NONE.test(t.trim());
/** 자금마다 다르거나 대상별로 갈리는 글(「자금별 상이」「청년창업은 3년 이내」) — 어긋나도 단정하지 않고 확인 필요. */
const varies = (t: string) => /상이|다름|별로|\/|,|은\s|는\s/.test(t);

/** "25.01.24" · "2025.01.24" · "2025-01-24" → {y,m,d}. 못 읽으면 null. */
export function parseYmd(text = ""): { y: number; m: number; d: number } | null {
  const m = String(text).trim().match(/^(\d{2}|\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!m) return null;
  const y = m[1]!.length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
  return { y, m: Number(m[2]), d: Number(m[3]) };
}

/** 대표자 출생 연도 — 생년월일 칸, 없으면 주민등록번호 앞자리(+성별자리). */
export function birthYear(c: GrantMatchCompany, todayYear: number): number | null {
  const b = String(c.대표자생년월일 ?? "").trim();
  const full = b.match(/^(19|20)(\d{2})/);
  if (full) return Number(`${full[1]}${full[2]}`);
  const digits = (b || String(c.주민등록번호 ?? "")).replace(/\D/g, "");
  if (digits.length < 6) return null;
  const yy = Number(digits.slice(0, 2));
  const g = digits[6];
  if (g) return (["3", "4", "7", "8"].includes(g) ? 2000 : 1900) + yy;
  return 2000 + yy > todayYear ? 1900 + yy : 2000 + yy;
}

/** 업력(년, 소수) — 개업일 기준. 모르면 null. */
export function yearsInBusiness(c: GrantMatchCompany, today: string): number | null {
  const o = parseYmd(c.개업일);
  if (!o) return null;
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return (ty - o.y) + (tm - o.m) / 12 + (td - o.d) / 365;
}

const 업종_낱말: ReadonlyArray<[string, RegExp]> = [
  ["제조업", /제조/],
  ["건설업", /건설/],
  ["운수업", /운수|운송|물류/],
  ["도소매업", /도소매|도매|소매|유통/],
  ["음식·숙박업", /음식|외식|숙박|관광/],
  ["정보통신", /정보통신|소프트웨어|\bICT\b|IT|콘텐츠|디지털/i],
];

function inScope(p: GrantProfile, a: PolicyAnnouncement, why: string[]): Verdict {
  if (a.regions.some((r) => r.kind === "nation")) return "match";
  if (a.regions.length === 0) { why.push("공고 지역 확인 필요"); return "check"; }
  if (!p.region.시도) { why.push("업체 지역이 비어 있어요"); return "check"; }
  let partial = false;
  for (const r of a.regions) {
    if (r.kind !== "area" || r.시도 !== p.region.시도) continue;
    if (!r.시군구 || r.시군구 === p.region.시군구) return "match";
    if (!p.region.시군구) partial = true;
  }
  if (partial) { why.push("업체 시·군·구가 비어 있어요"); return "check"; }
  why.push(`지역 다름(${a.regionText})`);
  return "no";
}

/** 업체 × 공고 판정. today = "YYYY-MM-DD"(KST). */
export function matchAnnouncement(company: GrantMatchCompany, a: PolicyAnnouncement, today: string): GrantMatch {
  const p = grantProfile(company);
  const no: string[] = [];
  const check: string[] = [];
  const add = (v: Verdict, why: string[]) => (v === "no" ? no.push(...why) : v === "check" ? check.push(...why) : 0);
  const urgent = a.deadline.kind === "budget" || (a.deadline.kind === "date" && (a.deadline.budget || daysBetween(today, a.deadline.date) <= 7));

  if (a.deadline.kind === "date" && a.deadline.date < today) no.push("마감 지남");

  // ① 지역 — 지역 칸, 그리고 지원대상·특정타겟에 지역 이름이 적힌 경우(예: 「산업위기지역(여수·울산 남구)」).
  const w1: string[] = [];
  add(inScope(p, a, w1), w1);
  const who = `${a.target} ${a.special}`;
  const extra = parseScopes(who).filter((s) => s.kind === "area");
  if (extra.length && a.regions.some((r) => r.kind === "nation")) {
    const w: string[] = [];
    const v = inScope(p, { ...a, regions: extra, regionText: "지원대상 지역" }, w);
    if (v !== "match") check.push(v === "no" ? "지원대상에 지역 조건(다른 지역)" : w[0] ?? "지원대상 지역 확인");
  }

  // ② 규모 — 「소상공인」이 대상이면.
  if (/소상공인/.test(who) && !/중소기업|중견/.test(who)) {
    if (p.smallBusiness === true) { /* 맞음 */ } else if (p.smallBusiness === false) no.push("소상공인 대상");
    else check.push("소상공인인지 확인 필요");
  }

  // ③ 제외 업종 — 업체가 제외 업종이면 공고가 따로 열어 두지 않는 한 안 맞음.
  if (p.excluded) no.push("제외 업종");

  // ④ 업종 — 공고가 업종을 좁힌 경우만.
  const lim = a.industryLimit;
  if (known(lim) && !/제외/.test(lim.replace(/\(.*?\)/g, ""))) {
    const named = 업종_낱말.filter(([, re]) => re.test(lim)).map(([n]) => n);
    if (named.length === 0) check.push("업종 조건 확인");
    else if (!p.industry) check.push("업체 대분류가 비어 있어요");
    else if (!named.includes(p.industry)) no.push(`업종 다름(${named.join("·")})`);
  }

  // ⑤ 업력 — 「N년 이내/미만」「N년 이상」.
  const age = a.ageLimit;
  if (known(age)) {
    const within = age.match(/(\d+)\s*년\s*(이내|미만|이하)/);
    const over = age.match(/(\d+)\s*년\s*(이상|초과)/);
    const yrs = yearsInBusiness(company, today);
    if (!within && !over) check.push("업력 조건 확인");
    else if (yrs === null) check.push("개업일이 비어 있어요");
    else {
      const miss = within && yrs > Number(within[1]) ? `업력 ${within[1]}년 넘음` : over && yrs < Number(over[1]) ? `업력 ${over[1]}년 안 됨` : "";
      if (miss) (varies(age) ? check : no).push(varies(age) ? "업력 조건 확인" : miss);
    }
  }

  // ⑥ 청년 — 만 39세 이하가 보통.
  if (/청년/.test(who)) {
    const by = birthYear(company, Number(today.slice(0, 4)));
    const limit = Number(who.match(/만?\s*(\d{2})\s*세\s*이하/)?.[1] ?? 39);
    // 청년은 여러 대상 중 하나로 적히는 일이 많다(「청년창업은 …」) — 나이가 넘어도 단정하지 않는다.
    if (by === null) check.push("대표자 나이 확인 필요");
    else if (Number(today.slice(0, 4)) - by - 1 > limit) check.push(`청년(만 ${limit}세 이하) 조건 확인`);
  }

  // ⑦ 특성 — 업체가 켜지 않았다고 아닌 것은 아니다(안 적었을 수 있음) → 확인 필요만.
  for (const [word, feature] of [[/여성기업|여성\s*대표/, "여성기업"], [/장애인기업/, "장애인기업"], [/수출/, "수출"], [/재창업|재도전/, "재창업"], [/사회적기업|협동조합/, "사회적기업·협동조합"]] as const) {
    if (!word.test(who)) continue;
    if (!p.features.some((f) => f.startsWith(feature))) check.push(`${feature} 대상 확인`);
  }

  const verdict: Verdict = no.length ? "no" : check.length ? "check" : "match";
  return { verdict, reasons: verdict === "no" ? no : verdict === "check" ? check : [], urgent };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** 한 업체에 맞는 공고(맞음·확인 필요)만, 소진 임박 → 맞음 → 확인 필요 → 최근 순. */
export function matchesFor(company: GrantMatchCompany, list: readonly PolicyAnnouncement[], today: string) {
  const rank = (m: GrantMatch) => (m.urgent ? 0 : m.verdict === "match" ? 1 : 2);
  return list
    .map((a) => ({ a, m: matchAnnouncement(company, a, today) }))
    .filter((x) => x.m.verdict !== "no")
    .sort((x, y) => rank(x.m) - rank(y.m) || y.a.lastSeen.localeCompare(x.a.lastSeen));
}

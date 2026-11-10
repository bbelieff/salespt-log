/**
 * Layer: service(순수). CODEF 응답(정형 JSON) → 사업자별 요약 줄(facts) + 업체정보 칸 후보(fields).
 * 필드 이름은 developer.codef.io 상품 페이지 출력부(2026-11-09) 기준. data 는 단건이면 객체, 다건이면 배열.
 * 금액 칸은 백만원(@/util/company-money), 매출은 기준 연도에서 몇 해 전인지로 칸을 고른다(@/util/company-sales).
 * 4대보험 가입자 개인정보(성명·주민번호)는 읽지 않는다 — 인원 수만.
 */
import { formatBizNo, formatCorpNo, digitsOnly } from "@/lib/document-ocr/bizno";
import { groupThousands } from "@/lib/document-ocr/amount";
import { wonToMillion } from "@/util/company-money";
import { SALES_YEAR_KEYS, salesSlotOf } from "@/util/company-sales";
import type { SimpleAuthDocKey, SimpleAuthField } from "@/types/simple-auth";

type Obj = Record<string, unknown>;
/** 사업자번호(000-00-00000) → 이 서류의 몫. 키 "" = 사업자에 묶이지 않은 몫(개인 서류) — 모든 사업자에 붙인다. */
export type DocParts = Map<string, { name: string; owner?: string; facts: string[]; fields: SimpleAuthField[]; issuedAt?: string }>;

export const asList = (data: unknown): Obj[] => (Array.isArray(data) ? data : data && typeof data === "object" ? [data] : []).filter((x): x is Obj => !!x && typeof x === "object");
const s = (o: Obj, k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
const won = (raw: string): number | null => { const t = raw.replace(/[,\s원]/g, ""); return /^-?\d+$/.test(t) ? Number(t) : null; };
const money = (n: number) => `${groupThousands(n)}원`;
const ymd = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v);
const yymmdd = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(2, 4)}.${v.slice(4, 6)}.${v.slice(6)}` : "");
const bizOf = (o: Obj) => (digitsOnly(s(o, "resCompanyIdentityNo")).length === 10 ? formatBizNo(s(o, "resCompanyIdentityNo")) : "");

/** 대소문자가 문서마다 다른 원문 필드(resOriGinalData1 · resOriginalData1 · reqOriginalData1)에서 PDF base64. */
export function originalPdf(o: Obj, key: "resOriGinalData1" | "resOriGinalData" = "resOriGinalData1"): string {
  const want = key.toLowerCase().replace(/^res/, "");
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && v.length > 100 && k.toLowerCase().replace(/^re[sq]/, "") === want) return v;
  }
  return "";
}

function part(parts: DocParts, biz: string, name: string) {
  let p = parts.get(biz);
  if (!p) { p = { name, facts: [], fields: [] }; parts.set(biz, p); }
  if (!p.name && name) p.name = name;
  return p;
}

/** 사업자등록증명 — 계속사업장마다 한 몫. 상호·대표·개업일·업태·종목·소재지·사업자구분·법인등록번호. */
export function parseBizCert(data: unknown): DocParts {
  const parts: DocParts = new Map();
  for (const o of asList(data)) {
    const biz = bizOf(o);
    if (!biz) continue;
    const p = part(parts, biz, s(o, "resCompanyNm") || s(o, "resUserNm"));
    p.owner = s(o, "resUserNm");
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const open = s(o, "resOpenDate"), types = s(o, "resBusinessTypes"), items = s(o, "resBusinessItems"), kind = s(o, "resBusinessmanType");
    p.facts.push([open && `개업일 ${ymd(open)}`, kind].filter(Boolean).join(" · "));
    if (types || items) p.facts.push([types && `업태 ${types}`, items && `종목 ${items}`].filter(Boolean).join(" · "));
    const push = (key: string, value: string, confidence = 0.95) => { if (value) p.fields.push({ key, value, confidence }); };
    push("사업자등록번호", biz, 0.99);
    push("대표자이름", s(o, "resUserNm"));
    push("개업일", yymmdd(open));
    push("업태", types.slice(0, 60));
    push("업종주생산품목", items.replace(/\|/g, ", ").slice(0, 60));
    push("소재지", s(o, "resUserAddr"), 0.9);
    // 법인: 사업자종류에 「법인」, 또는 13자리 번호가 주민번호(7번째 자리 1~4) 꼴이 아니면 법인등록번호.
    const idNo = digitsOnly(s(o, "resUserIdentiyNo"));
    const corp = /법인/.test(kind) || (idNo.length === 13 && !/^\d{6}[1-4]/.test(idNo));
    push("사업자구분", kind ? (/법인/.test(kind) ? "법인" : "개인") : "", 0.9);
    if (corp) push("법인등록번호", formatCorpNo(s(o, "resUserIdentiyNo")), 0.9);
  }
  return parts;
}

/** 부가세 과세표준증명 — 과세기간별 과세표준 계를 연도별로 더해 매출 칸(금년·과년도·Y2·Y3). */
export function parseVat(data: unknown, baseYear: number): DocParts {
  const parts: DocParts = new Map();
  const sums = new Map<string, Map<number, number>>();
  for (const o of asList(data)) {
    const biz = bizOf(o), year = Number(s(o, "commStartDate").slice(0, 4)), amt = won(s(o, "resIncomeTotalAmt"));
    const p = part(parts, biz, s(o, "resCompanyNm"));
    p.issuedAt = ymd(s(o, "resIssueDate"));
    if (!year || amt === null) continue;
    const m = sums.get(biz) ?? new Map<number, number>();
    m.set(year, (m.get(year) ?? 0) + amt);
    sums.set(biz, m);
  }
  for (const [biz, m] of sums) {
    const p = part(parts, biz, "");
    const years = [...m.keys()].sort((a, b) => b - a);
    p.facts.push(years.map((y) => `${y}년 ${money(m.get(y)!)}`).join(" · "));
    for (const y of years) {
      const slot = salesSlotOf(y, baseYear);
      if (slot !== null) p.fields.push({ key: SALES_YEAR_KEYS[slot]!, value: wonToMillion(m.get(y)!), confidence: 0.9, sourceWon: m.get(y)! });
    }
  }
  return parts;
}

const FS_ROWS: { key: string; labels: string[]; loss?: string[]; sheet: "is" | "bs" }[] = [
  { key: "매출액", labels: ["매출액", "수익(매출액)", "영업수익"], sheet: "is" },
  { key: "영업이익", labels: ["영업이익", "영업이익(손실)", "영업손익"], loss: ["영업손실"], sheet: "is" },
  { key: "당기순이익", labels: ["당기순이익", "당기순이익(손실)", "당기순손익"], loss: ["당기순손실"], sheet: "is" },
  { key: "이자비용", labels: ["이자비용", "금융비용", "금융원가"], sheet: "is" },
  { key: "자산총계", labels: ["자산총계"], sheet: "bs" },
  { key: "부채총계", labels: ["부채총계"], sheet: "bs" },
  { key: "자본총계", labels: ["자본총계"], sheet: "bs" },
];
const cleanTitle = (t: string) => t.replace(/^[\s\dⅠ-Ⅻ().·-]+/, "").replace(/\s/g, "");

/** 표준재무제표증명(한 해 한 번 호출) — 해마다 매출을 매출 칸에, 가장 최근 해의 손익·재무를 재무 칸에. */
export function parseFs(datas: unknown[], baseYear: number): DocParts {
  const parts: DocParts = new Map();
  const byBiz = new Map<string, { year: number; got: Map<string, number> }[]>();
  for (const o of datas.flatMap(asList)) {
    const biz = bizOf(o);
    const p = part(parts, biz, s(o, "resCompanyNm"));
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const year = Number(s(o, "resAttrYear") || s(o, "commEndDate").slice(0, 4));
    if (!year) continue;
    const got = new Map<string, number>();
    for (const row of FS_ROWS) {
      const lines = asList(o[row.sheet === "is" ? "resIncomeStatement" : "resBalanceSheet"]);
      for (const l of lines) {
        const t = cleanTitle(s(l, "_title")), v = won(s(l, "_amt"));
        if (v === null || got.has(row.key)) continue;
        if (row.labels.some((x) => t === x)) got.set(row.key, v);
        else if (row.loss?.some((x) => t === x)) got.set(row.key, -Math.abs(v));
      }
    }
    const list = byBiz.get(biz) ?? [];
    list.push({ year, got });
    byBiz.set(biz, list);
  }
  for (const [biz, list] of byBiz) {
    const p = part(parts, biz, "");
    list.sort((a, b) => b.year - a.year);
    for (const { year, got } of list) {
      const sales = got.get("매출액"), op = got.get("영업이익");
      p.facts.push(`${year}년 ${[sales !== undefined && `매출액 ${money(sales)}`, op !== undefined && `영업이익 ${money(op)}`].filter(Boolean).join(" · ") || "금액 없음"}`);
      const slot = sales !== undefined ? salesSlotOf(year, baseYear) : null;
      if (slot !== null) p.fields.push({ key: SALES_YEAR_KEYS[slot]!, value: wonToMillion(sales!), confidence: 0.85, sourceWon: sales! });
    }
    const latest = list[0];
    if (latest) {
      p.fields.push({ key: "결산연도", value: String(latest.year), confidence: 0.9 });
      for (const k of ["영업이익", "당기순이익", "이자비용", "자산총계", "부채총계", "자본총계"]) {
        const v = latest.got.get(k);
        if (v !== undefined) p.fields.push({ key: k, value: wonToMillion(v), confidence: 0.9, sourceWon: v });
      }
    }
  }
  return parts;
}

/** 국세 납세증명 — 납세상태·유효기간(체납·유예 명세가 있으면 건수). */
export function parseTax(data: unknown): DocParts {
  const parts: DocParts = new Map();
  for (const o of asList(data)) {
    const p = part(parts, bizOf(o), s(o, "resCompanyNm"));
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const arrears = asList(o.resArrearsList).filter((x) => s(x, "resTaxItemName")).length;
    const respite = asList(o.resRespiteList).filter((x) => s(x, "resTaxItemName")).length;
    p.facts.push([`납세상태 ${s(o, "resPaymentTaxStatus") || "확인 필요"}`, s(o, "resValidPeriod") && `유효기간 ${ymd(s(o, "resValidPeriod"))}까지`].filter(Boolean).join(" · "));
    if (arrears || respite) p.facts.push([arrears && `체납 ${arrears}건`, respite && `징수유예 ${respite}건`].filter(Boolean).join(" · "));
  }
  return parts;
}

/** 지방세 납세증명(정부24) — 발급되면 체납 없음. 유효기간·발급기관·유예 명세. */
export function parseLocalTax(data: unknown): DocParts {
  const parts: DocParts = new Map();
  for (const o of asList(data)) {
    const p = part(parts, bizOf(o), s(o, "resCompanyNm"));
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const respite = asList(o.resRespiteList).filter((x) => s(x, "resTaxItemName")).length;
    p.facts.push([`발급 ${s(o, "resIssueOgzNm")}`.trim(), s(o, "resValidPeriod") && `유효기간 ${ymd(s(o, "resValidPeriod"))}까지`, respite ? `징수유예 ${respite}건` : "체납 없음"].filter(Boolean).join(" · "));
  }
  return parts;
}

/** 4대보험 가입자명부 — 가입자 수만(개인정보는 버린다). 사대보험직원 칸. */
export function parseIns(data: unknown): DocParts {
  const parts: DocParts = new Map();
  for (const o of asList(data)) {
    const basic = asList(o.resBasicList)[0] ?? {};
    const p = part(parts, bizOf(basic), s(basic, "resCompanyNm"));
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const n = asList(o.resJoinList).filter((x) => s(x, "resUserNm")).length;
    p.facts.push(`가입자 ${n}명`);
    p.fields.push({ key: "사대보험직원", value: `${n}명`, confidence: 0.9 });
  }
  return parts;
}

/** 소득금액증명 — 귀속연도별 소득금액 합계(개인 서류라 모든 사업자에 붙는다). */
export function parseIncome(data: unknown): DocParts {
  const parts: DocParts = new Map();
  for (const o of asList(data)) {
    const p = part(parts, "", "");
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const rows = asList(o.resGeneralIncomeTaxList).map((x) => ({ y: s(x, "resAttrYear"), v: won(s(x, "resIncomeAmt")) })).filter((x) => x.y && x.v !== null);
    p.facts.push(rows.length ? rows.map((x) => `${x.y}년 소득 ${money(x.v!)}`).join(" · ") : "신고 내역 없음");
  }
  return parts;
}

/** 폐업사실증명 — 폐업한 사업장마다 개업일·폐업일(휴업기간)·업태. 업체정보 칸에는 넣지 않는다(폐업 사업장). */
export function parseClosed(data: unknown): DocParts {
  const parts: DocParts = new Map();
  for (const o of asList(data)) {
    const biz = bizOf(o);
    if (!biz) continue;
    const p = part(parts, biz, s(o, "resCompanyNm") || s(o, "resUserNm"));
    p.owner ||= s(o, "resUserNm");
    p.issuedAt = ymd(s(o, "resIssueDate"));
    const open = s(o, "resOpenDate"), closed = s(o, "resClosingDate"), rest = s(o, "resPeriod");
    p.facts.push([closed && `폐업일 ${ymd(closed)}`, open && `개업일 ${ymd(open)}`].filter(Boolean).join(" · "));
    if (rest) p.facts.push(`휴업기간 ${rest.split("~").map((x) => ymd(x.trim())).join(" ~ ")}`);
    const types = s(o, "resBusinessTypes"), items = s(o, "resBusinessItems");
    if (types || items) p.facts.push([types && `업태 ${types}`, items && `종목 ${items}`].filter(Boolean).join(" · "));
  }
  return parts;
}

export const PARSERS: Record<SimpleAuthDocKey, (datas: unknown[], baseYear: number) => DocParts> = {
  biz: (d) => parseBizCert(d.flatMap(asList)),
  vat: (d, y) => parseVat(d.flatMap(asList), y),
  fs: (d, y) => parseFs(d, y),
  tax: (d) => parseTax(d.flatMap(asList)),
  localTax: (d) => parseLocalTax(d.flatMap(asList)),
  ins: (d) => parseIns(d.flatMap(asList)),
  income: (d) => parseIncome(d.flatMap(asList)),
  closed: (d) => parseClosed(d.flatMap(asList)),
};

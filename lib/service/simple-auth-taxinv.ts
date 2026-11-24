/**
 * Layer: service. 간편인증 — 전년도 전자세금계산서(매출·매입, 품목 포함) 조회·요약·엑셀(belie 2026-11-24).
 * CODEF 「전자세금계산서 통합」(/v1/kr/public/nt/tax-invoice/integrated-check-list) — 공동인증서 로그인,
 * 3개월 단위라 1년 = 매출 4회 + 매입 4회. 장마다 거래항목 리스트(품목·규격·수량·단가)가 함께 온다
 * (developer.codef.io 상품 페이지·API 명세서 「전자세금계산서 통합」 탭, 2026-11-24 열람).
 * 사업계획서 도구의 「매출처·매입처 TOP3」 칸에 쓰려고 거래처 합계 시트를 함께 만든다.
 */
import * as XLSX from "xlsx";
import { digitsOnly, formatBizNo } from "@/lib/document-ocr/bizno";
import { groupThousands } from "@/lib/document-ocr/amount";

type Obj = Record<string, unknown>;
export type Transe = "매출" | "매입";
/** CODEF 응답 한 번(3개월·매출 또는 매입)에 붙이는 꼬리표 — 응답 행에는 매출/매입 구분이 없다. */
export type TaxInvPage = { transe: Transe; biz: string; rows: unknown; failed?: boolean };

export const TAXINV_PATH = "/v1/kr/public/nt/tax-invoice/integrated-check-list";
const QUARTERS = [["0101", "0331"], ["0401", "0630"], ["0701", "0930"], ["1001", "1231"]] as const;

/** 전년도 1년치 요청 입력(로그인 칸 제외) — 사업자번호를 주면 그 사업장으로(사업장이 여럿이면 필수). */
export function taxInvQueries(year: number, bizNos: readonly string[]): { transe: Transe; biz: string; params: Obj }[] {
  const out: { transe: Transe; biz: string; params: Obj }[] = [];
  for (const biz of bizNos.length ? bizNos : [""]) {
    for (const transe of ["매출", "매입"] as const) {
      for (const [from, to] of QUARTERS) {
        out.push({ transe, biz: biz ? formatBizNo(biz) : "", params: {
          organization: "0002", inquiryType: "01", searchType: "01", startDate: `${year}${from}`, endDate: `${year}${to}`,
          sortby: "1", orderBy: "1", transeType: transe === "매출" ? "01" : "02", type: "0",
          ...(biz ? { identity: digitsOnly(biz) } : {}),
        } });
      }
    }
  }
  return out;
}

const list = (v: unknown): Obj[] => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []).filter((x): x is Obj => !!x && typeof x === "object");
const str = (o: Obj, k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
const num = (o: Obj, k: string) => { const t = str(o, k).replace(/[,\s원]/g, ""); return /^-?\d+$/.test(t) ? Number(t) : 0; };
const ymd = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v);
const bizFmt = (v: string) => (digitsOnly(v).length === 10 ? formatBizNo(v) : v);

export type Invoice = {
  transe: Transe; date: string; approvalNo: string; partnerNo: string; partnerName: string; partnerOwner: string;
  supply: number; tax: number; total: number; kind: string; receipt: string; repItem: string; note: string;
  items: { name: string; spec: string; qty: string; unitPrice: number; supply: number; tax: number; note: string }[];
};

/** 응답 → 세금계산서 목록. 거래처 = 매출이면 공급받는자, 매입이면 공급자. 같은 승인번호는 한 번만. */
export function toInvoices(pages: readonly TaxInvPage[]): Invoice[] {
  const seen = new Set<string>();
  const out: Invoice[] = [];
  for (const p of pages) {
    for (const o of list(p.rows)) {
      const no = str(o, "resApprovalNo");
      if (no && seen.has(`${p.transe}|${no}`)) continue;
      if (no) seen.add(`${p.transe}|${no}`);
      const side = p.transe === "매출" ? "Contractor" : "Supplier";
      out.push({
        transe: p.transe, date: ymd(str(o, "resReportingDate")), approvalNo: no,
        partnerNo: bizFmt(str(o, `res${side}RegNumber`)), partnerName: str(o, `res${side}CompanyName`), partnerOwner: str(o, `res${side}Name`),
        supply: num(o, "resSupplyValue"), tax: num(o, "resTaxAmt"), total: num(o, "resTotalAmount"),
        kind: str(o, "resETaxInvoiceType"), receipt: str(o, "resReceiptOrCharge"), repItem: str(o, "resRepItems"), note: str(o, "resNote"),
        items: list(o.resTradeItemList).map((i) => ({
          name: str(i, "resTaxItemName"), spec: str(i, "resStandards"), qty: str(i, "resQuantity"),
          unitPrice: num(i, "resUnitPrice"), supply: num(i, "resSupplyValue"), tax: num(i, "resTaxAmt"), note: str(i, "resNote"),
        })),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type Partner = { no: string; name: string; count: number; supply: number; share: number };

/** 거래처별 공급가액 합계(큰 순). 사업자번호가 없으면 상호로 묶는다. */
export function partners(invoices: readonly Invoice[], transe: Transe): Partner[] {
  const map = new Map<string, Partner>();
  for (const v of invoices.filter((x) => x.transe === transe)) {
    const key = digitsOnly(v.partnerNo) || v.partnerName || "(거래처 없음)";
    const p = map.get(key) ?? { no: v.partnerNo, name: v.partnerName, count: 0, supply: 0, share: 0 };
    p.count += 1; p.supply += v.supply; if (!p.name) p.name = v.partnerName;
    map.set(key, p);
  }
  const all = [...map.values()].sort((a, b) => b.supply - a.supply);
  const sum = all.reduce((t, p) => t + p.supply, 0);
  for (const p of all) p.share = sum ? Math.round((p.supply / sum) * 1000) / 10 : 0;
  return all;
}

/** 화면 요약 줄 — 매출·매입 건수와 합계, TOP3 거래처. */
export function taxInvFacts(invoices: readonly Invoice[], year: number): string[] {
  const facts: string[] = [];
  for (const t of ["매출", "매입"] as const) {
    const rows = invoices.filter((v) => v.transe === t);
    const sum = rows.reduce((s, v) => s + v.supply, 0);
    facts.push(`${year}년 ${t} ${rows.length}건 · 공급가액 ${groupThousands(sum)}원`);
    const top = partners(invoices, t).slice(0, 3);
    if (top.length) facts.push(`${t}처 TOP3 — ${top.map((p) => `${p.name || p.no} ${p.share}%`).join(" · ")}`);
  }
  return facts;
}

const INVOICE_HEAD = ["작성일자", "승인번호", "거래처 사업자번호", "거래처 상호", "거래처 대표자", "공급가액", "세액", "합계금액", "종류", "영수/청구", "대표품목", "품목", "규격", "수량", "단가", "품목 공급가액", "품목 세액", "품목 비고", "비고"];

/** 품목마다 한 줄(홈택스 「품목 포함」 엑셀처럼) — 품목이 없으면 세금계산서 한 줄. */
function invoiceRows(invoices: readonly Invoice[], transe: Transe): (string | number)[][] {
  const rows: (string | number)[][] = [INVOICE_HEAD];
  for (const v of invoices.filter((x) => x.transe === transe)) {
    const head = [v.date, v.approvalNo, v.partnerNo, v.partnerName, v.partnerOwner, v.supply, v.tax, v.total, v.kind, v.receipt, v.repItem];
    const items = v.items.length ? v.items : [null];
    for (const i of items) rows.push([...head, i?.name ?? "", i?.spec ?? "", i?.qty ?? "", i ? i.unitPrice : "", i ? i.supply : "", i ? i.tax : "", i?.note ?? "", v.note]);
  }
  return rows;
}

function partnerRows(invoices: readonly Invoice[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const t of ["매출", "매입"] as const) {
    rows.push([`${t}처 (공급가액 큰 순 — 1~3위가 TOP3)`], ["순위", "사업자번호", "상호", "건수", "공급가액", "비중(%)"]);
    const all = partners(invoices, t);
    all.forEach((p, i) => rows.push([i + 1, p.no, p.name, p.count, p.supply, p.share]));
    if (!all.length) rows.push(["", "", "세금계산서 없음"]);
    rows.push([]);
  }
  return rows;
}

/** 엑셀(.xlsx) base64 — 시트: 거래처 합계(TOP3) · 매출 · 매입. */
export function taxInvWorkbook(invoices: readonly Invoice[]): string {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: (string | number)[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("거래처 합계(TOP3)", partnerRows(invoices), [6, 14, 28, 6, 16, 8]);
  const w = [11, 26, 14, 24, 10, 14, 12, 14, 8, 8, 20, 24, 10, 8, 12, 14, 12, 14, 16];
  add("매출", invoiceRows(invoices, "매출"), w);
  add("매입", invoiceRows(invoices, "매입"), w);
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
}

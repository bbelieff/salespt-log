/**
 * document-ocr/taxinv-top3 — 간편인증 「전자세금계산서 목록」 엑셀 → 사업계획서 팩트시트 매출처·매입처 TOP3
 * (belie 2026-11-25 「세금계산서 엑셀을 TOP3 칸에 연결해줘」).
 *
 * 엑셀 모양은 lib/service/simple-auth-taxinv.ts 가 만든다(시트 「매출」·「매입」, 품목마다 한 줄, 같은 승인번호는 같은 장).
 * 거래처 = 공급가액 합계 큰 순 상위 3곳, 품목 = 그 거래처와의 품목 중 공급가액이 가장 큰 것(품목 줄이 없으면 대표품목),
 * 연 거래액 = 백만원. 엑셀 읽기(xlsx)는 부르는 쪽이 하고, 여기는 시트 행(배열)만 받는다.
 */
import { wonToMillion } from "@/util/company-money";
import type { BizplanPartner } from "@/util/bizplan-pack";

export type SheetRows = readonly (readonly unknown[])[];
export type TaxInvTop3 = { sales: BizplanPartner[]; purchases: BizplanPartner[]; year: string };

const text = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const won = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(text(v).replace(/[,\s원]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const repName = (v: string) => v.replace(/\s+외\s*\d+\s*건\s*$/, "").replace(/\s+/g, " ").trim();

/** 시트 한 장(매출 또는 매입) → TOP3. 머리줄에 「승인번호」「거래처 상호」가 없으면 null(다른 엑셀). */
export function top3FromSheet(rows: SheetRows): BizplanPartner[] | null {
  const head = (rows[0] ?? []).map(text);
  const col = (name: string) => head.indexOf(name);
  const c = {
    no: col("승인번호"), bizNo: col("거래처 사업자번호"), name: col("거래처 상호"), supply: col("공급가액"),
    rep: col("대표품목"), item: col("품목"), itemSupply: col("품목 공급가액"),
  };
  if (c.no < 0 || c.name < 0 || c.supply < 0) return null;
  type Acc = { name: string; supply: number; items: Map<string, number>; seen: Set<string> };
  const map = new Map<string, Acc>();
  for (const r of rows.slice(1)) {
    const name = text(r[c.name]);
    const key = text(r[c.bizNo]).replace(/\D/g, "") || name;
    if (!key) continue;
    const a = map.get(key) ?? { name, supply: 0, items: new Map(), seen: new Set() };
    if (!a.name) a.name = name;
    const no = text(r[c.no]);
    const first = !no || !a.seen.has(no);
    if (no) a.seen.add(no);
    if (first) a.supply += won(r[c.supply]);
    const item = c.item >= 0 ? text(r[c.item]) : "";
    if (item) a.items.set(item, (a.items.get(item) ?? 0) + won(r[c.itemSupply]));
    else if (first && c.rep >= 0) {
      const rep = repName(text(r[c.rep]));
      if (rep) a.items.set(rep, (a.items.get(rep) ?? 0) + won(r[c.supply]));
    }
    map.set(key, a);
  }
  return [...map.values()]
    .sort((x, y) => y.supply - x.supply)
    .slice(0, 3)
    .map((a) => ({
      name: a.name,
      item: [...a.items.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "",
      amount: wonToMillion(a.supply),
    }));
}

/** 엑셀 시트들(이름 → 행) → 매출처·매입처 TOP3. 「매출」·「매입」 시트가 둘 다 없으면 null. */
export function top3FromTaxInvSheets(sheets: Record<string, SheetRows>): TaxInvTop3 | null {
  const sales = sheets["매출"] ? top3FromSheet(sheets["매출"]) : null;
  const purchases = sheets["매입"] ? top3FromSheet(sheets["매입"]) : null;
  if (!sales && !purchases) return null;
  const firstDate = [...(sheets["매출"] ?? []), ...(sheets["매입"] ?? [])].map((r) => text(r[0])).find((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
  return { sales: sales ?? [], purchases: purchases ?? [], year: firstDate?.slice(0, 4) ?? "" };
}

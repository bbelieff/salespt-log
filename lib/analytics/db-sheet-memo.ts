/**
 * Layer: analytics(순수) — 가져온 DB의 메모 글 정리(2026-10-26 belie).
 *
 * ① 원본 메모에서 상담메모로 옮길 줄 찾기: 가져오기가 남긴 「메모: …」「비고: …」 줄(머리글 이름이 메모 계열인 칸).
 *    #1258 전에 들어온 DB는 이 줄이 원본 메모에만 있고 상담메모가 비어 있다 → 읽을 때 상담메모로 보여 준다.
 * ② 통화 메모 읽기(parseCallMemo): 수강생이 공급처 시트에 적어 온 한 줄 메모를 칸으로 나눈다.
 *    실제 사례(디비스트 시트, 2026-10-26 분석 53건)에서 본 꼴:
 *      「서울송파구(소미아) / 본문」 「수원시(보엠 플라워)/ 부재중1/본문」 「화성시(화성커튼 차밍 블라인드(병점))/…」(괄호 안 괄호)
 *      「고양시/// 본문」(상호 없음) 「인천(루엘)/부재중1 아예거절1015」 「직접확인필요/ 부재중2」 「/ 잘못남겼다」(앞이 빔)
 *      「서울광진구(조아)_품질업DB : …」(구분자 _) · 구분자는 / // /// 가 섞임 · 끝의 4자리 숫자 = 그날(월일) 통화
 *      「부재중1014」= 10/14 부재, 「부재중21015」= 2번째 부재 10/15, 「부재중1」= 1번째 부재(날짜 없음)
 *    앞머리 지역은 시·도를 알아볼 때만 주소로(아니면 그대로 글). 상호는 지역 바로 뒤 괄호 안.
 */
import { parseRegion } from "@/util/admin-regions";

export const CONSULT_NOTE_HEADERS = ["메모", "한줄메모", "비고", "상담메모", "상담내용", "특이사항", "요청사항", "문의내용", "메모사항"] as const;
const HEADER_LINE = new RegExp(String.raw`^\s*(${CONSULT_NOTE_HEADERS.join("|")})\s*[:：]\s*(.*)$`);
const SHORT_SIDO = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?!특별|광역|도|시)/;

/** 원본 메모(가져온 원문 표시 앞부분)에서 메모 계열 줄의 값. 여러 줄이면 「머리글: 값」으로 잇는다. 없으면 "". */
export function consultNoteFromRawMemo(memo: string): string {
  const head = String(memo ?? "").split("[가져온 원문]")[0] ?? "";
  const hits = head.split(/\r?\n/).map((line) => line.match(HEADER_LINE)).filter((m): m is RegExpMatchArray => !!m && !!m[2]!.trim());
  if (hits.length === 0) return "";
  return hits.length === 1 ? hits[0]![2]!.trim() : hits.map((m) => `${m[1]}: ${m[2]!.trim()}`).join("\n");
}

/** 지역 글 → 「서울 송파구」·「경기 수원시」. 시·도를 못 읽으면 "". 붙여 쓴 「서울송파구」·「수원시영통구」도 읽는다. */
export function memoRegion(text: string): string {
  const raw = String(text ?? "").replace(/\s+/g, "").replace(SHORT_SIDO, "$1 ");
  if (!raw) return "";
  const r = parseRegion(raw);
  if (!r.시도) return "";
  return r.시군구 ? `${r.시도} ${r.시군구}` : r.시도;
}

/** 여는 괄호 위치에서 짝이 맞는 닫는 괄호 위치(괄호 안 괄호 허용). 없으면 -1. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "（") depth++;
    else if (c === ")" || c === "）") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** 「지역(상호) 나머지」 · 「지역/ 나머지」 앞머리 나누기. 지역을 못 읽으면 null. */
export function splitRegionCompanyMemo(text: string): { address: string; company: string; note: string } | null {
  const t = String(text ?? "").trim();
  const head = t.match(/^([가-힣][가-힣\s]{0,24}?)\s*(?=[(（/／_|]|$)/);
  if (!head) return null;
  const address = memoRegion(head[1]!);
  if (!address) return null;
  let rest = t.slice(head[0].length).trimStart();
  let company = "";
  if (rest.startsWith("(") || rest.startsWith("（")) {
    const end = closingParen(rest, 0);
    if (end < 0) return null;
    company = rest.slice(1, end).trim();
    rest = rest.slice(end + 1);
  }
  return { address, company, note: rest.replace(/^[\s/／_|·-]+/, "").trim() };
}

export interface CallMemo {
  address: string;
  company: string;
  /** 구분자로 나눈 조각(빈 조각·구분자 뺌). */
  parts: string[];
  /** 「부재」 조각의 날짜(끝 4자리 월일). 날짜 없는 「부재중1」은 count 만. */
  absenceDates: string[];
  absenceCount: number;
  /** 부재가 아닌 조각에 붙은 통화 날짜(끝 4자리 월일) — 상담한 날 후보. */
  contactDates: string[];
  /** 상담메모로 쓸 글 — 조각을 「 / 」로 잇는다. */
  note: string;
}

/** 끝 4자리 월일 → base 연도(월이 base 보다 이르면 다음 해). 날짜가 아니면 "". */
function mmdd(digits: string, base: string): string {
  const m = Number(digits.slice(0, 2)), d = Number(digits.slice(2, 4));
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  const by = Number(base.slice(0, 4)) || new Date().getFullYear(), bm = Number(base.slice(5, 7)) || 1;
  const y = m < bm ? by + 1 : by;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 통화 메모 한 줄 → 주소·상호·부재·통화 날짜·정리된 메모. base = 유입일(YYYY-MM-DD, 연도 추정용). */
export function parseCallMemo(text: string, base = ""): CallMemo {
  const split = splitRegionCompanyMemo(text);
  const body = split ? split.note : String(text ?? "").trim().replace(/^[\s/／_|·-]+/, "");
  const parts = body.split(/\s*(?:[/／]+|_|\s-{2,})\s*/).map((p) => p.trim()).filter(Boolean);
  const absenceDates: string[] = [], contactDates: string[] = [];
  let absenceCount = 0;
  for (const p of parts) {
    const absent = p.match(/부재중?\s*(\d*)$/);
    if (absent && /부재/.test(p)) {
      const d = absent[1]!;
      // 「부재중1」(횟수) · 「부재중1014」(월일) · 「부재중21015」(횟수+월일)
      if (d.length === 1 || d.length === 2) absenceCount = Math.max(absenceCount, Number(d));
      else if (d.length === 4) { const day = mmdd(d, base); if (day) absenceDates.push(day); absenceCount = Math.max(absenceCount, 1); }
      else if (d.length === 5) { const day = mmdd(d.slice(1), base); if (day) absenceDates.push(day); absenceCount = Math.max(absenceCount, Number(d[0])); }
      else absenceCount = Math.max(absenceCount, 1);
      continue;
    }
    // 끝 4자리 월일 — 바로 앞 말이 「부재」면 부재한 날(「계속 부재1015」), 아니면 통화한 날(「아예거절1015」).
    const tail = p.match(/^(.*[^\d])(\d{4})$/);
    if (tail) { const day = mmdd(tail[2]!, base); if (day) (/부재중?\s*$/.test(tail[1]!) ? absenceDates : contactDates).push(day); }
  }
  return {
    address: split?.address ?? "",
    company: split?.company ?? "",
    parts,
    absenceDates: [...new Set(absenceDates)].sort(),
    absenceCount,
    contactDates: [...new Set(contactDates)].sort(),
    note: parts.join(" / "),
  };
}

/**
 * 상담메모 글을 정리 — 「지역(상호)」 머리는 비어 있는 주소·사업자명으로, 본문은 조각을 「 / 」로 잇는다.
 * 여러 줄(「비고: 연습용」「메모: 서울서대문구(가상상회)/ 부재중…」)이면 줄마다 살펴, 처음 나뉘는 줄의 본문을
 * 맨 앞에(머리글 없이) 두고 나머지 줄은 그대로 잇는다.
 */
export function applyRegionCompanyMemo<T extends { address: string; company: string }>(row: T, note: string, base = ""): { row: T; note: string } {
  const lines = String(note ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const body = lines[i]!.match(HEADER_LINE)?.[2] ?? lines[i]!;
    if (!splitRegionCompanyMemo(body)) continue;
    const memo = parseCallMemo(body, base);
    const rest = lines.filter((_, k) => k !== i).filter((l) => l.trim());
    return {
      row: { ...row, address: row.address.trim() || memo.address, company: row.company.trim() || memo.company },
      note: [memo.note, ...rest].filter(Boolean).join("\n"),
    };
  }
  return { row, note };
}

/** 읽을 때만(저장 안 함): 상담메모가 비었고 원본 메모에 메모 계열 줄이 있으면 상담메모로 보여 준다(지역(상호) 머리는 주소·사업자명으로). */
export function withImportedConsultNote<T extends { address: string; company: string; memo: string; date?: string; contact: { note: string } }>(lead: T): T {
  if (lead.contact.note.trim()) return lead;
  const found = consultNoteFromRawMemo(lead.memo);
  if (!found) return lead;
  const { row, note } = applyRegionCompanyMemo(lead, found, lead.date ?? "");
  return { ...row, contact: { ...row.contact, note } };
}

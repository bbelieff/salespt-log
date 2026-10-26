/**
 * Layer: analytics(순수) — 가져온 DB의 메모 글 정리(2026-10-26 belie).
 *
 * ① 원본 메모에서 상담메모로 옮길 줄 찾기: 가져오기가 남긴 「메모: …」「비고: …」 줄(머리글 이름이 메모 계열인 칸).
 *    #1258 전에 들어온 DB는 이 줄이 원본 메모에만 있고 상담메모가 비어 있다 → 읽을 때 상담메모로 보여 준다.
 * ② 「서울송파구(소미아) / 잘나가다가…」처럼 앞머리가 「지역(상호)」이면 주소·사업자명·메모로 나눈다.
 *    지역은 시·도를 알아볼 때만(parseRegion) — 아니면 나누지 않고 글 그대로 둔다.
 */
import { parseRegion } from "@/util/admin-regions";

export const CONSULT_NOTE_HEADERS = ["메모", "한줄메모", "비고", "상담메모", "상담내용", "특이사항", "요청사항", "문의내용", "메모사항"] as const;
const HEADER_LINE = new RegExp(`^\s*(${CONSULT_NOTE_HEADERS.join("|")})\s*[:：]\s*(.*)$`);

/** 원본 메모(가져온 원문 표시 앞부분)에서 메모 계열 줄의 값. 여러 줄이면 「머리글: 값」으로 잇는다. 없으면 "". */
export function consultNoteFromRawMemo(memo: string): string {
  const head = String(memo ?? "").split("[가져온 원문]")[0] ?? "";
  const hits = head.split(/\r?\n/).map((line) => line.match(HEADER_LINE)).filter((m): m is RegExpMatchArray => !!m && !!m[2]!.trim());
  if (hits.length === 0) return "";
  return hits.length === 1 ? hits[0]![2]!.trim() : hits.map((m) => `${m[1]}: ${m[2]!.trim()}`).join("\n");
}

/** 「서울송파구(소미아) / 메모」 → 주소 「서울 송파구」·사업자명 「소미아」·메모. 앞머리가 지역이 아니면 null. */
export function splitRegionCompanyMemo(text: string): { address: string; company: string; note: string } | null {
  const m = String(text ?? "").match(/^\s*([가-힣][가-힣\s]{1,24}?)\s*[(（]\s*([^()（）]{1,40}?)\s*[)）]\s*(?:[/／·|]\s*)?([\s\S]*)$/);
  if (!m) return null;
  // 「서울송파구」처럼 붙여 쓴 짧은 시·도 이름은 띄어서 읽는다.
  const raw = m[1]!.replace(/\s+/g, "").replace(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?!특별|광역|도|시)/, "$1 ");
  const region = parseRegion(raw);
  if (!region.시도) return null;
  const address = region.시군구 ? `${region.시도} ${region.시군구}` : region.시도;
  return { address, company: m[2]!.trim(), note: m[3]!.trim() };
}

/** 상담메모 글에 「지역(상호)」 머리가 있으면 비어 있는 주소·사업자명만 채우고 메모 본문만 남긴다. */
export function applyRegionCompanyMemo<T extends { address: string; company: string }>(row: T, note: string): { row: T; note: string } {
  const split = splitRegionCompanyMemo(note);
  if (!split) return { row, note };
  return {
    row: { ...row, address: row.address.trim() || split.address, company: row.company.trim() || split.company },
    note: split.note || note,
  };
}

/** 읽을 때만(저장 안 함): 상담메모가 비었고 원본 메모에 메모 계열 줄이 있으면 상담메모로 보여 준다(지역(상호) 머리는 주소·사업자명으로). */
export function withImportedConsultNote<T extends { address: string; company: string; memo: string; contact: { note: string } }>(lead: T): T {
  if (lead.contact.note.trim()) return lead;
  const found = consultNoteFromRawMemo(lead.memo);
  if (!found) return lead;
  const { row, note } = applyRegionCompanyMemo(lead, found);
  return { ...row, contact: { ...row.contact, note } };
}

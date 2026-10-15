/**
 * 엑셀(.xlsx) → 탭으로 나눈 글(TSV) — DB 가져오기가 CSV·붙여넣기와 같은 길로 읽게 한다(belie 2026-10-15).
 *
 * 새 라이브러리 없이: .xlsx 는 zip 안의 XML 이다. 브라우저 기본 DecompressionStream("deflate-raw")로 풀고
 * DOMParser 로 첫 번째 시트만 읽는다. 셀 값은 표시 글 그대로(공유 문자열·인라인 글·숫자·참거짓).
 * 날짜 서식 숫자(엑셀 일련번호)는 머리글이 날짜·일시면 YYYY-MM-DD 로 바꾼다.
 * 칸 안에 탭·줄바꿈·따옴표가 있으면 따옴표로 감싸 delimited() 가 한 칸으로 읽게 한다.
 */
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data.slice()).body!.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** zip 목록(이름 → 압축 풀린 내용). 필요한 파일만 푼다. */
async function readZip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, string>> {
  const b = new Uint8Array(buf);
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("엑셀 파일을 읽지 못했습니다. .xlsx 파일인지 확인해 주세요.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder("utf-8");
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = b.subarray(start, start + size);
    const data = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
    if (data) out.set(name, dec.decode(data));
  }
  return out;
}

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const textOf = (el: Element) => Array.from(el.getElementsByTagNameNS(MAIN, "t")).map((t) => t.textContent ?? "").join("");
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
const quote = (s: string) => (/[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** 엑셀 날짜 일련번호 → YYYY-MM-DD (1900 체계). */
function serialDate(n: number, date1904: boolean): string {
  const ms = Math.round((n + (date1904 ? 1462 : 0) - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

export async function xlsxToText(buf: ArrayBuffer): Promise<string> {
  const files = await readZip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(n));
  // 첫 번째 시트 경로 — workbook 의 첫 <sheet r:id> → rels Target. 못 찾으면 sheet1.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = files.get("xl/workbook.xml");
  const rels = files.get("xl/_rels/workbook.xml.rels");
  const date1904 = !!wb && ["1", "true"].includes(xml(wb).getElementsByTagNameNS(MAIN, "workbookPr")[0]?.getAttribute("date1904") ?? "");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagNameNS(MAIN, "sheet")[0];
    const rid = first?.getAttributeNS(REL, "id");
    const rel = Array.from(xml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  }
  const sheet = files.get(sheetPath);
  if (!sheet) throw new Error("엑셀 첫 번째 시트를 찾지 못했습니다.");
  const shared = files.has("xl/sharedStrings.xml")
    ? Array.from(xml(files.get("xl/sharedStrings.xml")!).getElementsByTagNameNS(MAIN, "si")).map(textOf)
    : [];
  const styles = files.get("xl/styles.xml");
  const styleXml = styles ? xml(styles) : null;
  const formats = new Map(Array.from(styleXml?.getElementsByTagNameNS(MAIN, "numFmt") ?? []).map(el => [el.getAttribute("numFmtId"), el.getAttribute("formatCode") ?? ""]));
  const cellFormats = Array.from(styleXml?.getElementsByTagNameNS(MAIN, "cellXfs")[0]?.children ?? []).map(el => formats.get(el.getAttribute("numFmtId")) ?? "");
  const { SSF } = await import('xlsx');
  const numberFormats: string[][] = [];
  const grid: string[][] = [];
  const numeric: boolean[][] = [];
  for (const row of Array.from(xml(sheet).getElementsByTagNameNS(MAIN, "row"))) {
    const cells: string[] = [];
    const nums: boolean[] = [];
    const rowFormats: string[] = [];
    for (const c of Array.from(row.getElementsByTagNameNS(MAIN, "c"))) {
      const i = colIndex(c.getAttribute("r") ?? "A1");
      const t = c.getAttribute("t");
      const v = c.getElementsByTagNameNS(MAIN, "v")[0]?.textContent ?? "";
      const val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? textOf(c) : t === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
      cells[i] = val;
      nums[i] = !t || t === "n";
      rowFormats[i] = cellFormats[Number(c.getAttribute("s"))] ?? "";
    }
    grid.push(Array.from(cells, (x) => x ?? ""));
    numeric.push(nums);
    numberFormats.push(rowFormats);
  }
  while (grid.length && grid[grid.length - 1]!.every((x) => !x.trim())) grid.pop();
  const width = Math.max(0, ...grid.map((r) => r.length));
  const header = grid[0] ?? [];
  const dateCol = header.map((h) => /일시|날짜|일자|유입일|신청일|date|time/i.test(h));
  return grid
    .map((r, ri) =>
      Array.from({ length: width }, (_, ci) => {
        const s = r[ci] ?? "";
        const n = Number(s);
        const asDate = ri > 0 && dateCol[ci] && numeric[ri]?.[ci] && s !== "" && Number.isFinite(n) && n > 20_000 && n < 80_000;
        const format = numberFormats[ri]?.[ci];
        const formatted = !dateCol[ci] && numeric[ri]?.[ci] && s !== "" && format && Number.isFinite(n) ? SSF.format(format, n) : s;
        return quote(asDate ? serialDate(n, date1904) : formatted);
      }).join("\t"),
    )
    .join("\n");
}

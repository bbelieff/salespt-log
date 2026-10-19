/**
 * 엑셀(.xlsx) → 탭으로 나눈 글(TSV) — DB 가져오기가 CSV·붙여넣기와 같은 길로 읽게 한다(belie 2026-10-15).
 *
 * 새 라이브러리 없이: .xlsx 는 zip 안의 XML 이다. 브라우저 기본 DecompressionStream("deflate-raw")로 풀고
 * DOMParser 로 첫 번째 시트만 읽는다. 셀 값은 표시 글 그대로(공유 문자열·인라인 글·숫자·참거짓).
 * 날짜 서식 숫자(엑셀 일련번호)는 머리글이 날짜·일시면 YYYY-MM-DD 로 바꾼다.
 * 칸 안에 탭·줄바꿈·따옴표가 있으면 따옴표로 감싸 delimited() 가 한 칸으로 읽게 한다.
 */
import { xlsxZipReader, XlsxImportLimitError } from './xlsx-zip';
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function xml(s: string) {
  const doc = new DOMParser().parseFromString(s, "application/xml");
  if (doc.getElementsByTagName('parsererror').length) throw new Error('엑셀 XML이 손상되었습니다. .xlsx로 다시 저장해 주세요.');
  return doc;
}
const textOf = (el: Element) => Array.from(el.getElementsByTagNameNS(MAIN, "t")).map((t) => t.textContent ?? "").join("");
const colIndex = (ref: string) => {
  if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(ref)) throw new Error('엑셀 셀 주소를 확인해 주세요.');
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  if (n > 200) throw new XlsxImportLimitError('한 번에 10,000행·200열까지 가져올 수 있습니다. 필요한 범위만 새 파일에 저장해 주세요.');
  return n - 1;
};
const quote = (s: string) => (/[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** 엑셀 날짜 일련번호 → YYYY-MM-DD (1900 체계). */
function serialDate(n: number, date1904: boolean): string {
  const ms = Math.round((n + (date1904 ? 1462 : 0) - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

export async function xlsxToText(buf: ArrayBuffer): Promise<string> {
  const read = xlsxZipReader(buf);
  // 첫 번째 시트 경로 — workbook 의 첫 <sheet r:id> → rels Target. 못 찾으면 sheet1.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const date1904 = !!wb && ["1", "true"].includes(xml(wb).getElementsByTagNameNS(MAIN, "workbookPr")[0]?.getAttribute("date1904") ?? "");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagNameNS(MAIN, "sheet")[0];
    const rid = first?.getAttributeNS(REL, "id");
    const rel = Array.from(xml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  }
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(sheetPath)) throw new Error('엑셀 첫 번째 시트 경로를 확인해 주세요.');
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("엑셀 첫 번째 시트를 찾지 못했습니다.");
  const sharedText = await read("xl/sharedStrings.xml");
  const shared = sharedText
    ? Array.from(xml(sharedText).getElementsByTagNameNS(MAIN, "si")).map(textOf)
    : [];
  const styles = await read("xl/styles.xml");
  const styleXml = styles ? xml(styles) : null;
  const formats = new Map(Array.from(styleXml?.getElementsByTagNameNS(MAIN, "numFmt") ?? []).map(el => [el.getAttribute("numFmtId"), el.getAttribute("formatCode") ?? ""]));
  const cellFormats = Array.from(styleXml?.getElementsByTagNameNS(MAIN, "cellXfs")[0]?.children ?? []).map(el => formats.get(el.getAttribute("numFmtId")) ?? "");
  const { SSF } = await import('xlsx');
  const numberFormats: string[][] = [];
  const grid: string[][] = [];
  const numeric: boolean[][] = [];
  const rows = xml(sheet).getElementsByTagNameNS(MAIN, "row");
  if (rows.length > 10001) throw new XlsxImportLimitError('한 번에 10,000행·200열까지 가져올 수 있습니다. 필요한 범위만 새 파일에 저장해 주세요.');
  for (const row of Array.from(rows)) {
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
  const encoder = new TextEncoder(); let outputBytes = 0;
  return grid
    .map((r, ri) =>
      Array.from({ length: width }, (_, ci) => {
        const s = r[ci] ?? "";
        const n = Number(s);
        const asDate = ri > 0 && dateCol[ci] && numeric[ri]?.[ci] && s !== "" && Number.isFinite(n) && n > 20_000 && n < 80_000;
        const format = numberFormats[ri]?.[ci];
        if (format && format.length > 1024) throw new XlsxImportLimitError('엑셀 표시 형식이 너무 깁니다. 필요한 범위를 일반 형식으로 다시 저장해 주세요.');
        const formatted = !dateCol[ci] && numeric[ri]?.[ci] && s !== "" && format && Number.isFinite(n) ? SSF.format(format, n) : s;
        const value = quote(asDate ? serialDate(n, date1904) : formatted);
        // Shared strings may reference the same large value thousands of times.
        // Budget the rendered cells, including separators, before joining them.
        outputBytes += encoder.encode(value).byteLength + (ci > 0 ? 1 : ri > 0 ? 1 : 0);
        if (outputBytes > 5 * 1024 * 1024) throw new XlsxImportLimitError('변환한 엑셀 내용이 5MB를 넘습니다. 필요한 범위만 새 파일에 저장해 주세요.');
        return value;
      }).join("\t"),
    )
    .join("\n");
}

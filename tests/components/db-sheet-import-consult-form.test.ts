// @vitest-environment jsdom
/**
 * 상담 신청 엑셀·구글시트 가져오기(belie 2026-10-24). 값은 모두 가상.
 *  ① 엑셀 붙여넣기(접수시간·신용700·국세체납·연매출액·사업자번호·이름·전화번호·비고·메모) — 제목행 인식, 메모 포함
 *  ② 구글시트 붙여넣기 — 전화번호 두 칸·#REF! 반복 제목행·p:+82·「오후」 날짜
 *  ③ .xlsx — 날짜 형식 「yyyy. m. d am/pm h:mm:ss」로 파일 전체가 실패하지 않고, 지수 표기 사업자번호를 숫자로
 *  ④ 구글시트 공유 주소 — 주소 판별·CSV 내려받기(비공개·다른 도메인 리다이렉트 거부)
 */
import { describe, expect, it } from "vitest";
import { analyzeImport } from "@/app/(app)/db-sheet/_components/adaptive-import";
import { parse, headerKey, normalizeImportDate, isJunkImportRow } from "@/app/(app)/db-sheet/_components/model";
import { xlsxToText } from "@/app/(app)/db-sheet/_components/xlsx";
import { parseGoogleSheetUrl, googleSheetCsvUrl } from "@/util/google-sheet-url";
import { fetchGoogleSheetCsv, GoogleSheetImportError } from "@/repo/google-sheet-export";

const HEAD = ["접수시간", "신용700", "국세체납", "연매출액", "사업자번호", "이름", "전화번호", "비고", "메모"];
const excelPaste = [
  HEAD.join("\t"),
  ["2026. 9. 8 pm 4:55:43", "예", "아니오", "5천미만", "1000000001", "가상일", "01000000001", "연습용", "서울가구(가상 스튜디오)/ 부재중1 /부재중3"].join("\t"),
  ["2026. 9. 8 pm 7:56:41", "아니오", "예", "5천미만", "2000000002", "가상이 / Ga Sang (Paul)", "01000000002", "연습용", "서울나구(가상사진) / 안하기로함X                        "].join("\t"),
].join("\n");
const gsheetPaste = [
  ["접수시간", "신용700", "국세체납", "연매출액", "사업자번호", "이름", "전화번호", "전화번호", "비고", "메모"].join("\t"),
  ["접수시간", "#REF!", "", "", "", "", "", "전화번호", "", ""].join("\t"),
  ["2026. 9. 8 오후 4:55:43", "예", "아니오", "5천미만", "1000000001", "가상일", "p:+821000000001", "01000000001", "연습용", "서울가구(가상 스튜디오)/ 부재중1 /부재중3"].join("\t"),
  ["2026. 9. 8 오후 7:56:41", "예", "아니오", "5천미만", "2000000002", "가상이 / Ga Sang (Paul)", "p:+821000000002", "01000000002", "연습용", "서울나구(가상사진) / 안하기로함X"].join("\t"),
].join("\n");

describe("상담 신청 머리글", () => {
  it("모든 머리글을 알아본다", () => {
    expect(HEAD.map(headerKey)).toEqual(["date", "credit", "arrears", "sales", "biz", "owner", "phone", "memo", "memo"]);
  });
  it("날짜 앞부분만 YYYY-MM-DD — 점·공백·오전/오후·pm", () => {
    expect(normalizeImportDate("2026. 9. 8 pm 4:55:43")).toBe("2026-09-08");
    expect(normalizeImportDate("2026. 9. 8 오후 4:55:43")).toBe("2026-09-08");
    expect(normalizeImportDate("2026-10-14T09:00:00+09:00")).toBe("2026-10-14");
  });
});

describe("① 엑셀 붙여넣기", () => {
  it("제목행을 인식하고 확인 필요 없이 칸을 채운다", () => {
    const a = analyzeImport(excelPaste);
    expect(a.header).toBe(true);
    expect(a.items).toHaveLength(2);
    expect(a.items.flatMap(i => i.questions)).toEqual([]);
    const [one, two] = a.items.map(i => i.lead);
    expect(one).toMatchObject({ owner: "가상일", phone: "010-0000-0001", biz: "1000000001", date: "2026-09-08", sales: "5천미만", credit: "700점 이상", arrears: "없음" });
    expect(two).toMatchObject({ credit: "700점 미만", arrears: "있음", owner: "가상이 / Ga Sang (Paul)" });
    expect(one!.memo).toContain("비고: 연습용");
    expect(one!.memo).toContain("메모: 서울가구(가상 스튜디오)/ 부재중1 /부재중3");
  });
});

describe("② 구글시트 붙여넣기", () => {
  it("반복 제목행·#REF! 줄은 건너뛰고, 전화번호 두 칸은 하나로", () => {
    const a = analyzeImport(gsheetPaste);
    expect(a.header).toBe(true);
    expect(a.items).toHaveLength(2);
    expect(a.items.flatMap(i => i.questions)).toEqual([]);
    const one = a.items[0]!.lead;
    expect(one).toMatchObject({ phone: "010-0000-0001", biz: "1000000001", date: "2026-09-08", credit: "700점 이상", arrears: "없음" });
    // 같은 번호의 두 번째 칸은 메모에 겹쳐 쓰지 않는다.
    expect(one.memo).not.toMatch(/^전화번호:/m);
    expect(one.memo).toContain("메모: 서울가구(가상 스튜디오)/ 부재중1 /부재중3");
  });
  it("두 전화번호 칸이 서로 다르면 처음 값을 쓰고 다른 값은 메모에 남긴다", () => {
    const rows = parse([["이름", "전화번호", "전화번호"].join("\t"), ["가상삼", "01000000003", "01000000009"].join("\t")].join("\n"));
    expect(rows[0]!.phone).toBe("010-0000-0003");
    expect(rows[0]!.memo).toContain("전화번호: 01000000009");
  });
  it("반복 제목행·오류 줄 판별", () => {
    expect(isJunkImportRow(["접수시간", "#REF!", "", "전화번호"], ["접수시간", "신용700"])).toBe(true);
    expect(isJunkImportRow(["2026. 9. 8", "예"], ["접수시간", "신용700"])).toBe(false);
  });
});

// 가상 .xlsx 를 압축 없이(stored) 만든다.
function zipStored(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const [name, body] of Object.entries(files)) {
    const n = enc.encode(name), d = enc.encode(body);
    const local = new Uint8Array(30 + n.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint32(18, d.length, true); lv.setUint32(22, d.length, true); lv.setUint16(26, n.length, true); local.set(n, 30);
    const c = new Uint8Array(46 + n.length); const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint32(20, d.length, true); cv.setUint32(24, d.length, true); cv.setUint16(28, n.length, true); cv.setUint32(42, offset, true); c.set(n, 46);
    parts.push(local, d); central.push(c); offset += local.length + d.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0); const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end]; const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out.buffer;
}
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

describe("③ .xlsx", () => {
  it("SSF 가 못 읽는 날짜 형식에도 실패하지 않고, 지수 표기 사업자번호를 숫자로", async () => {
    const strings = ["접수시간", "사업자번호", "이름", "전화번호", "가상일", "01000000001"];
    const buf = zipStored({
      "xl/sharedStrings.xml": `<sst ${NS}>${strings.map(s => `<si><t>${s}</t></si>`).join("")}</sst>`,
      "xl/styles.xml": `<styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy. m. d am/pm h:mm:ss"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>`,
      "xl/worksheets/sheet1.xml": `<worksheet ${NS}><sheetData>`
        + `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>`
        + `<row r="2"><c r="A2" s="1"><v>46273.7054745</v></c><c r="B2"><v>1.000000001E9</v></c><c r="C2" t="s"><v>4</v></c><c r="D2" t="s"><v>5</v></c></row>`
        + `</sheetData></worksheet>`,
    });
    const text = await xlsxToText(buf);
    const a = analyzeImport(text);
    expect(a.header).toBe(true);
    expect(a.items.flatMap(i => i.questions)).toEqual([]);
    expect(a.items[0]!.lead).toMatchObject({ date: "2026-09-08", biz: "1000000001", owner: "가상일", phone: "010-0000-0001" });
  });
});

describe("④ 구글시트 공유 주소", () => {
  const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  it("공유 주소만 받는다", () => {
    expect(parseGoogleSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`)).toEqual({ id: ID, gid: null });
    expect(parseGoogleSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=123`)).toEqual({ id: ID, gid: "123" });
    expect(parseGoogleSheetUrl(`http://docs.google.com/spreadsheets/d/${ID}/edit`)).toBeNull();
    expect(parseGoogleSheetUrl(`https://evil.example/spreadsheets/d/${ID}/edit`)).toBeNull();
    expect(parseGoogleSheetUrl("접수시간\t이름")).toBeNull();
    expect(googleSheetCsvUrl({ id: ID, gid: "123" })).toBe(`https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=123`);
  });
  const res = (status: number, body: string, headers: Record<string, string> = {}) => new Response(status >= 300 && status < 400 ? null : body, { status, headers });
  it("CSV 를 내려받고, 구글 도메인 리다이렉트만 따라간다", async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      return calls.length === 1 ? res(307, "", { location: "https://doc-0s-sheets.googleusercontent.com/export/abc" }) : res(200, "이름,전화번호\n가상일,01000000001", { "content-type": "text/csv" });
    }) as unknown as typeof fetch;
    await expect(fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${ID}/edit`, fetcher)).resolves.toContain("가상일");
    expect(calls[1]).toContain("googleusercontent.com");
  });
  it("비공개(로그인 화면)·다른 도메인·주소 아님은 안내 오류", async () => {
    const html = (async () => res(200, "<!doctype html><html>login</html>", { "content-type": "text/html" })) as unknown as typeof fetch;
    await expect(fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${ID}/edit`, html)).rejects.toThrow(/공유 설정/);
    const evil = (async () => res(302, "", { location: "https://evil.example/x" })) as unknown as typeof fetch;
    await expect(fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${ID}/edit`, evil)).rejects.toBeInstanceOf(GoogleSheetImportError);
    await expect(fetchGoogleSheetCsv("https://example.com/x")).rejects.toThrow(/구글시트 공유 주소/);
  });
});

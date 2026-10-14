// @vitest-environment jsdom
/**
 * DB관리시트 가져오기 — 공급업체 엑셀(belie 2026-10-15).
 * 머리글(대표자명·DB배정 일시·연 매출·연체/체납·지역·신용점수 700)을 알아보고, 칸 안 따옴표(["정책자금"])에도
 * 표가 깨지지 않으며, .xlsx 파일을 직접 읽는다. 값은 모두 가상.
 */
import { describe, expect, it } from "vitest";
import { cleanCell, delimited, parse } from "@/app/(app)/db-sheet/_components/model";
import { xlsxToText } from "@/app/(app)/db-sheet/_components/xlsx";

const HEAD = ["DB배정 일시", "연락처", "사업자등록번호", "사업자명", "대표자명", "업종", "지역", "희망 서비스 선택", "연 매출", "기존 대출", "필요 자금", "연체/체납", "신용점수 700", "동의 여부", "메모"];
const ROW = ["2026-10-14 15:02:07", "01000001234", "1234567890", "가상상사", "김가상", "통신판매업", "광주", '["정책자금"]', "1억원 미만", "3-9천만원", "3-6천만원", "X", "이상", "Y", ""];
const tsv = [HEAD, ROW].map((r) => r.join("\t")).join("\n");

describe("공급업체 엑셀 머리글", () => {
  it("핵심 칸을 제자리에 넣고, 나머지는 메모로", () => {
    const [r] = parse(tsv);
    expect(r!.date).toBe("2026-10-14");
    expect(r!.phone).toBe("010-0000-1234");
    expect(r!.biz).toBe("1234567890");
    expect(r!.company).toBe("가상상사");
    expect(r!.owner).toBe("김가상");
    expect(r!.industry).toBe("통신판매업");
    expect(r!.address).toBe("광주");
    expect(r!.sales).toBe("1억원 미만");
    expect(r!.funds).toBe("3-6천만원");
    expect(r!.arrears).toBe("없음"); // 공급업체 표기 X → 없음
    expect(r!.credit).toBe("700점 이상");
    expect(r!.memo).toContain("희망 서비스 선택: 정책자금");
    expect(r!.memo).toContain("기존 대출: 3-9천만원");
  });

  it("칸 안 따옴표가 있어도 표가 깨지지 않는다(엑셀 붙여넣기)", () => {
    expect(delimited(tsv)[1]![7]).toBe('["정책자금"]');
    // 엑셀이 따옴표 칸을 감싸 복사한 경우도 같은 값.
    const quoted = tsv.replace('["정책자금"]', '"[""정책자금""]"');
    expect(delimited(quoted)[1]![7]).toBe('["정책자금"]');
  });

  it("끝의 빈 칸이 잘려 열이 모자라도 읽는다", () => {
    const short = tsv.replace(/\t$/, "");
    expect(parse(short)).toHaveLength(1);
  });

  it("날짜 2026.10.14 / 2026/10/4 도 유입일로", () => {
    const t = (d: string) => parse(`유입일\t사업자명\n${d}\t가상`)[0]!.date;
    expect(t("2026.10.14")).toBe("2026-10-14");
    expect(t("2026/10/4")).toBe("2026-10-04");
  });

  it("cleanCell", () => {
    expect(cleanCell('["정책자금","보증"]')).toBe("정책자금, 보증");
    expect(cleanCell("[메모]")).toBe("메모");
    expect(cleanCell(" 그대로 ")).toBe("그대로");
  });
});

// 가상 .xlsx 를 압축 없이(stored) 만든다 — 읽는 쪽은 deflate·stored 둘 다 받는다.
function zipStored(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, body] of Object.entries(files)) {
    const n = enc.encode(name);
    const d = enc.encode(body);
    const local = new Uint8Array(30 + n.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, d.length, true);
    lv.setUint32(22, d.length, true);
    lv.setUint16(26, n.length, true);
    local.set(n, 30);
    const c = new Uint8Array(46 + n.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, d.length, true);
    cv.setUint32(24, d.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    c.set(n, 46);
    parts.push(local, d);
    central.push(c);
    offset += local.length + d.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out.buffer;
}
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

describe(".xlsx 파일 읽기", () => {
  it("첫 시트를 탭 글로 — 공유 문자열·숫자·날짜 일련번호·따옴표 칸", async () => {
    const buf = zipStored({
      "xl/sharedStrings.xml": `<sst ${NS}><si><t>DB배정 일시</t></si><si><t>사업자명</t></si><si><t>대표자명</t></si><si><t>가상상사</t></si><si><t>["정책자금"]</t></si><si><t>희망 서비스</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>5</v></c></row><row r="2"><c r="A2"><v>46309</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="inlineStr"><is><t>김가상</t></is></c><c r="D2" t="s"><v>4</v></c></row></sheetData></worksheet>`,
    });
    const text = await xlsxToText(buf);
    const [r] = parse(text);
    expect(r!.date).toBe("2026-10-14");
    expect(r!.company).toBe("가상상사");
    expect(r!.owner).toBe("김가상");
    expect(r!.memo).toContain("희망 서비스: 정책자금");
  });

  it("zip 이 아니면 알기 쉬운 오류", async () => {
    await expect(xlsxToText(new TextEncoder().encode("hello").buffer)).rejects.toThrow(".xlsx");
  });
});

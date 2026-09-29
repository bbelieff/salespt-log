/**
 * 홈택스 발급 PDF(텍스트층) 형식 회귀 — 합성 데이터만(예시상사·가짜 번호·가짜 금액). 네트워크 없음.
 *
 * 2026-09-29 belie 제보: 실제 부가세 과세표준증명·표준재무제표 PDF 가 "채울 칸을 못 찾았어요" 로 끝났다.
 * 원인 4가지를 각각 고정한다.
 *  ① 텍스트층 조각을 조각마다 줄바꿈 → 표 한 줄이 흩어짐(pdfPiecesToLines 가 같은 높이끼리 모은다)
 *  ② 홈택스 과세기간은 "2023/01/01 2023/06/30" — 물결(~) 없음
 *  ③ 표준재무제표는 1쪽이 표지, 숫자는 2쪽 이후(여러 쪽을 읽는다)
 *  ④ 표준재무제표는 한 줄에 두 열 + 과목 코드("Ⅰ.매출액 01 285,000,000 9.가스.수도비 30 800,000")
 */
import { describe, expect, it } from "vitest";
import { pdfPagesToText, pdfPiecesToLines, type PdfTextPiece } from "@/lib/document-ocr/pdf-lines";
import { parseVatCertificate } from "@/lib/document-ocr/parse-vat";
import { parseFinancialStatement, splitItemColumns } from "@/lib/document-ocr/parse-fs";
import type { ParsedField } from "@/lib/document-ocr/types";

const byKey = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f.value]));
/** 한 줄을 x 순서대로 조각낸다(pdfjs 처럼). */
const row = (y: number, ...parts: string[]): PdfTextPiece[] => parts.map((str, i) => ({ str, x: 50 + i * 60, y }));

describe("pdfPiecesToLines — 같은 높이 조각을 한 줄로", () => {
  it("순서가 뒤섞인 조각을 위→아래, 왼→오른 줄로 모은다", () => {
    const pieces = [
      ...row(100, "* 바닥 안내문"),
      ...row(480, "2023/01/01", "2023/06/30", "100,000,000"),
      ...row(700, "부가가치세과세표준증명"),
      { str: " ", x: 0, y: 480 },
    ];
    expect(pdfPiecesToLines(pieces)).toEqual([
      "부가가치세과세표준증명",
      "2023/01/01 2023/06/30 100,000,000",
      "* 바닥 안내문",
    ]);
  });

  it("y 가 1~2pt 흔들려도 같은 줄", () => {
    expect(pdfPiecesToLines([{ str: "b", x: 90, y: 401 }, { str: "a", x: 10, y: 400 }])).toEqual(["a b"]);
  });

  it("쪽 사이는 빈 줄, 빈 쪽은 버린다", () => {
    expect(pdfPagesToText([row(700, "표지"), [], row(700, "본문")])).toBe("표지\n\n본문");
  });
});

describe("부가세 과세표준증명 — 홈택스 PDF 형식", () => {
  const pages = [[
    ...row(708, "부가가치세과세표준증명"),
    ...row(629, "상", "호(법인명)", "예시상사", "사업자등록번호", "123-45-67891"),
    ...row(550, "(단위:원)"),
    ...row(504, "부터", "까지", "계", "과세분", "면세분"),
    ...row(97, "* 본 증명의 위·변조 여부는 발급일로부터 90일 이내 확인"),
    ...row(481, "2024/01/01", "2024/06/30", "120,000,000", "120,000,000", "0", "9,000,000"),
    ...row(458, "2024/07/01", "2024/12/31", "130,500,000", "128,000,000", "2,500,000", "9,500,000"),
    ...row(436, "2025/01/01", "2025/06/30", "150,000,000", "150,000,000", "0", "11,000,000"),
    ...row(413, "2025/07/01", "2025/12/31", "160,000,000", "159,000,000", "1,000,000", "12,000,000"),
  ]];

  it("물결 없는 과세기간 줄에서 반기·연도 매출(과세표준 계)을 채운다", () => {
    const r = parseVatCertificate(pdfPagesToText(pages), { today: new Date(2026, 8, 29), baseYear: 2026 });
    expect(byKey(r.fields)).toMatchObject({
      매출Y1상: "150", 매출Y1하: "160", 과년도매출: "310",
      매출Y2상: "120", 매출Y2하: "130.5", 과년도매출Y2: "250.5",
    });
  });

  it("「면세분」 열에서 가장 최근 연도의 면세 수입금액을 합한다", () => {
    const r = parseVatCertificate(pdfPagesToText(pages), { today: new Date(2026, 8, 29), baseYear: 2026 });
    expect(byKey(r.fields).면세수입금액).toBe("1");
    expect(r.info).toContainEqual({ label: "면세 수입금액 연도", value: "2025년" });
  });

  it("조각마다 줄을 바꾸던 옛 방식이면 못 읽었다(회귀 방지 근거)", () => {
    const old = pages[0]!.map((p) => p.str).join("\n");
    expect(parseVatCertificate(old, { today: new Date(2026, 8, 29), baseYear: 2026 }).fields).toHaveLength(0);
  });
});

describe("표준재무제표 — 표지 + 두 열 + 과목 코드", () => {
  const cover = [
    ...row(700, "표", "준", "재무", "제표", "증", "명"),
    ...row(560, "사 업 연 도", "2024년 귀속분", "첨 부 서 류", "표준손익계산서"),
    ...row(520, "2025년 11월 10일"),
  ];
  const balance = [
    ...row(760, "표준재무상태표"),
    ...row(740, "(단위: 원)"),
    ...row(600, "(1)장기금융상품", "31", "0", "자산총계(Ⅰ+Ⅱ)", "62", "40,000,000"),
    ...row(500, "부채총계(Ⅰ+Ⅱ)", "87", "15,000,000"),
    ...row(480, "자본총계(Ⅲ+Ⅳ)", "90", "25,000,000"),
  ];
  const income = [
    ...row(760, "표준손익계산서"),
    ...row(740, "(단위: 원)"),
    ...row(700, "Ⅰ.매출액", "01", "300,000,000", "9.가스.수도비", "30", "800,000"),
    ...row(500, "Ⅴ.영업손익(Ⅲ-Ⅳ)", "62", "30,000,000", "10.재해손실", "91", "0"),
    ...row(480, "7.유.무형자산 처분이익", "70", "0", "Ⅷ.당기순손익(Ⅴ+Ⅵ-Ⅶ)", "99", "28,000,000"),
    ...row(300, "1.이자비용", "82", "1,500,000"),
  ];

  it("2쪽 이후의 오른쪽 열 과목까지 읽고, 옆 과목 금액을 전기 매출로 붙이지 않는다", () => {
    const r = parseFinancialStatement(pdfPagesToText([cover, balance, income]), new Date(2026, 8, 29), { baseYear: 2026 });
    expect(byKey(r.fields)).toEqual({
      결산연도: "2024", 과년도매출Y2: "300", 영업이익: "30", 당기순이익: "28",
      이자비용: "1.5", 자산총계: "40", 부채총계: "15", 자본총계: "25",
    });
    expect(r.info?.find((i) => i.label === "매출액(전기)")).toBeUndefined();
    expect(r.documentWarnings).toEqual([]);
  });

  it("splitItemColumns — 숫자 뒤 과목명에서 끊는다", () => {
    expect(splitItemColumns("Ⅰ.매출액 01 300,000,000 9.가스.수도비 30 800,000")).toEqual([
      "Ⅰ.매출액 01 300,000,000",
      "9.가스.수도비 30 800,000",
    ]);
    expect(splitItemColumns("매출액 1,000 900")).toEqual(["매출액 1,000 900"]);
  });
});

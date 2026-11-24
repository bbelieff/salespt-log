import { describe, expect, it } from "vitest";
import {
  bizplanMissing,
  buildFactsheet,
  buildStartPrompt,
  isBlankDraft,
  emptyBizplanDraft,
  growthLabel,
  normalizeBizplanDraft,
  packFileStem,
  toAmount,
  type BizplanFileRef,
} from "@/util/bizplan-pack";

const allFiles: BizplanFileRef[] = [
  { slot: "biz", name: "등록증.pdf" },
  { slot: "fs", name: "재무.pdf" },
  { slot: "vat", name: "부가세.pdf" },
  { slot: "photos", name: "공정1.jpg" },
  { slot: "interview", name: "인터뷰.docx" },
  { slot: "partners", name: "세금계산서.xlsx" },
];

function filled() {
  const d = emptyBizplanDraft(2026);
  d.company = "(주)한빛정밀";
  d.employees = "18명";
  d.fundAmount = "6억";
  d.fundUse = "CNC 2대";
  d.focus = "수출 실적 강조";
  d.years = d.years.map((y, i) => ({ ...y, 매출액: ["2,260", "2,700", "3,200"][i]!, 과세표준: ["2,100", "2,650", "3,100"][i]! }));
  d.sales[0]!.name = "현대모비스";
  d.purchases[0]!.name = "포스코";
  return d;
}

describe("bizplan-pack", () => {
  it("기준 연도 앞 3년을 연도로 둔다", () => {
    expect(emptyBizplanDraft(2026).years.map((y) => y.year)).toEqual(["2023", "2024", "2025"]);
  });

  it("금액을 읽고 증감률을 ▲▼ 로 쓴다", () => {
    expect(toAmount("1,234.5")).toBe(1234.5);
    expect(toAmount("(120)")).toBe(-120);
    expect(toAmount("3,200백만원")).toBe(3200);
    expect(toAmount("모름")).toBeNull();
    expect(growthLabel("2,700", "3,200")).toBe("▲ 18.5%");
    expect(growthLabel("100", "97")).toBe("▼ 3.0%");
    expect(growthLabel("0", "10")).toBe("-");
    expect(growthLabel("", "10")).toBe("-");
  });

  it("다 채우면 빠진 것이 없고, 비면 필수·권장으로 나눈다", () => {
    expect(bizplanMissing(filled(), allFiles, true)).toEqual([]);
    const m = bizplanMissing(emptyBizplanDraft(2026), [], false);
    const must = m.filter((x) => x.level === "필수").map((x) => x.text);
    expect(must).toContain("공식 빌더가 아직 준비되지 않았어요 — 내 빌더 파일을 직접 함께 올려 주세요.");
    expect(m.some((x) => x.text.includes("파일이 없어요"))).toBe(false); // 서류는 대화창에 직접 넣어도 된다
    expect(must).toContain("2025년 매출액이 비어 있어요.");
    expect(m.some((x) => x.text.startsWith("추가 자료"))).toBe(false);
  });

  it("팩트시트에 숫자·증감·빠진 것이 들어가고 표가 깨지지 않는다", () => {
    const d = filled();
    d.sales[0]!.item = "브레이크 | 부품";
    const md = buildFactsheet(d, allFiles, [{ level: "권장", text: "대표 경력" }], "2026-11-23 10:00");
    expect(md).toContain("# 팩트시트 — (주)한빛정밀");
    expect(md).toContain("| 2025 | 3,200 |");
    expect(md).toContain("▲ 18.5%");
    expect(md).toContain("- 사업자등록증: 등록증.pdf");
    expect(md).toContain("- 추가 자료: 없음");
    expect(md).toContain("- [권장] 대표 경력");
    expect(md).toContain("| 1 | 현대모비스 | 브레이크 ／ 부품 | (빈칸) |");
  });

  it("시작 프롬프트는 빌더·양식 이름과 멈춤 규칙을 담는다", () => {
    const p = buildStartPrompt(filled(), { builder: "01_빌더_v4.8.md", clinic: "현장클리닉_양식.docx", interview: null });
    expect(p).toContain("「01_빌더_v4.8.md」 대로 (주)한빛정밀 사업계획서");
    expect(p).toContain("「현장클리닉_양식.docx」 양식");
    expect(p).toContain("먼저 묻고 멈춰");
    expect(p).toContain("「실행」이라고만 보내도");
    expect(p).toContain("사업자등록증·표준재무제표 (3개년)");
    expect(p).toContain("이번 주안점: 수출 실적 강조");
    const none = buildStartPrompt(emptyBizplanDraft(2026), { builder: null, clinic: null, interview: null });
    expect(none).toContain("함께 올린 빌더 md 대로 이 회사");
    expect(none).toContain("올린 서류에서 직접 읽어");
    expect(none).not.toContain("02_팩트시트");
    expect(p).toContain("02_팩트시트.md");
  });

  it("팩트시트를 하나도 안 채웠는지 안다(연도 숫자는 빼고 본다)", () => {
    expect(isBlankDraft(emptyBizplanDraft(2026))).toBe(true);
    expect(isBlankDraft({ ...emptyBizplanDraft(2026), company: "가" })).toBe(false);
    expect(isBlankDraft(filled())).toBe(false);
  });

  it("옛 저장본·이상한 값은 빈칸으로 맞춘다", () => {
    const d = normalizeBizplanDraft({ company: "가", story: "엉뚱", years: [{ year: "2020", 매출액: 5 }], sales: "x" }, 2026);
    expect(d.company).toBe("가");
    expect(d.story).toBe("");
    expect(d.years[0]!.year).toBe("2020");
    expect(d.years[0]!.매출액).toBe("");
    expect(d.years).toHaveLength(3);
    expect(d.sales).toHaveLength(3);
    expect(normalizeBizplanDraft(null, 2026).years[2]!.year).toBe("2025");
  });

  it("파일 이름용 업체명", () => {
    expect(packFileStem("(주) 한빛/정밀")).toBe("(주)한빛정밀");
    expect(packFileStem("  ")).toBe("업체");
  });
});

/** 「항목 줄 → 값 줄」 공급처 글(belie 2026-11-09 새 DB 업체): 콜론 없이 항목 이름과 값이 한 줄씩 번갈아 온다. 값은 모두 가상. */
import { describe, expect, it } from "vitest";
import { analyzeImport, joinLabelValueLines } from "@/app/(app)/db-sheet/_components/adaptive-import";

const lead = (name: string, phone: string, company: string) => `지역
강원권
이름
${name}
전화번호
${phone}
사업자 종류
법인사업자
신용점수
700점_미만
체납 여부
아니오
싱호명
${company}
매출
5억_이상
광고 내용
2%대 금리 시설자금 사옥 컨설팅 광고로 수집된 DB입니다.
첫 인콜 "안녕하세요 대표님, 사옥 마련 문의 주셔서 연락드렸습니다." 라고 접근하시면 됩니다.`;

describe("항목 줄 → 값 줄 붙여넣기", () => {
  it("고객 한 명으로 읽고 항목을 제자리에 넣는다", () => {
    const { items, format } = analyzeImport(lead("홍가상", "01000001111", "가상상사"));
    expect(format).toBe("항목별 텍스트");
    expect(items).toHaveLength(1);
    const l = items[0]!.lead;
    expect(l).toMatchObject({ owner: "홍가상", phone: "010-0000-1111", company: "가상상사", address: "강원권", credit: "700점_미만", arrears: "없음", sales: "5억_이상" });
    expect(l.note).toContain("사옥 컨설팅");
    expect(l.note).toContain("첫 인콜");
    expect(items[0]!.questions).toEqual([]);
    expect(l.memo).toContain("사업자 종류: 법인사업자");
  });

  it("같은 항목이 다시 나오면 다음 고객으로 나눈다", () => {
    const { items } = analyzeImport(`${lead("홍가상", "01000001111", "가상상사")}\n${lead("김가상", "01000002222", "나다식품")}`);
    expect(items.map((i) => [i.lead.owner, i.lead.phone, i.lead.company])).toEqual([
      ["홍가상", "010-0000-1111", "가상상사"],
      ["김가상", "010-0000-2222", "나다식품"],
    ]);
  });

  it("인사말이 앞에 있어도 고객은 한 명", () => {
    const { items } = analyzeImport(`새 DB 전달드립니다.\n\n${lead("홍가상", "01000001111", "가상상사")}`);
    expect(items).toHaveLength(1);
    expect(items[0]!.lead.owner).toBe("홍가상");
  });

  it("콜론 항목·표 형식·줄별 텍스트는 그대로 둔다", () => {
    for (const text of ["이름: 홍가상\n전화번호: 01000001111", "이름\t전화번호\n홍가상\t01000001111", "가상상사 홍가상 010-0000-1111\n나다식품 김가상 010-0000-2222"]) {
      expect(joinLabelValueLines(text)).toBe(text);
    }
  });
});

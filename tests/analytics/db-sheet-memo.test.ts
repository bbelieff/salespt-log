/** 가져온 DB 메모 정리(2026-10-26 belie) — 원본 메모 → 상담메모, 「지역(상호)」 머리 → 주소·사업자명. 합성 값만. */
import { describe, expect, it } from "vitest";
import { applyRegionCompanyMemo, consultNoteFromRawMemo, splitRegionCompanyMemo, withImportedConsultNote } from "@/lib/analytics/db-sheet-memo";
import { parse } from "@/app/(app)/db-sheet/_components/model";

const RAW = "메모: 서울송파구(가상상회) / 대출이면 괜찮다고 마무리\n[가져온 원문]\n | 2026. 9. 13 | 예 | 서울송파구(가상상회) / 대출이면 괜찮다고 마무리";

describe("원본 메모 → 상담메모", () => {
  it("가져온 원문 앞의 메모 계열 줄만", () => {
    expect(consultNoteFromRawMemo(RAW)).toBe("서울송파구(가상상회) / 대출이면 괜찮다고 마무리");
    expect(consultNoteFromRawMemo("비고: 가\n메모: 나\n[가져온 원문]\n메모: 무시")).toBe("비고: 가\n메모: 나");
    expect(consultNoteFromRawMemo("기타칸: 참고\n[가져온 원문]\nx")).toBe("");
    expect(consultNoteFromRawMemo("")).toBe("");
  });
  it("★상담메모가 비었을 때만 채우고, 지역(상호)는 비어 있는 주소·사업자명으로", () => {
    const lead = { address: "", company: "", memo: RAW, contact: { note: "" } };
    expect(withImportedConsultNote(lead)).toMatchObject({ address: "서울 송파구", company: "가상상회", contact: { note: "대출이면 괜찮다고 마무리" } });
    const typed = { ...lead, contact: { note: "직접 적은 메모" } };
    expect(withImportedConsultNote(typed)).toBe(typed);
    expect(withImportedConsultNote({ ...lead, company: "원래상호" })).toMatchObject({ company: "원래상호", address: "서울 송파구" });
  });
});

describe("「지역(상호)」 나누기", () => {
  it.each([
    ["서울송파구(가상상회) / 메모", { address: "서울 송파구", company: "가상상회", note: "메모" }],
    ["경기 화성시 (예시공방) 상담 희망", { address: "경기 화성시", company: "예시공방", note: "상담 희망" }],
    ["부산(가상식품)", { address: "부산", company: "가상식품", note: "" }],
  ])("%s", (text, out) => expect(splitRegionCompanyMemo(text)).toEqual(out));
  it("앞머리가 지역이 아니면 나누지 않는다", () => {
    expect(splitRegionCompanyMemo("오전에 통화(부재) 다시")).toBeNull();
    expect(splitRegionCompanyMemo("자금 3천 문의")).toBeNull();
    expect(applyRegionCompanyMemo({ address: "", company: "" }, "자금 3천 문의")).toEqual({ row: { address: "", company: "" }, note: "자금 3천 문의" });
  });
  it("가져오기에서도 같은 규칙", () => {
    const [row] = parse("접수시간\t전화번호\t메모\n2026-09-13\t010-0000-1111\t서울송파구(가상상회) / 대출이면 괜찮다고 마무리");
    expect(row).toMatchObject({ address: "서울 송파구", company: "가상상회", note: "대출이면 괜찮다고 마무리" });
  });
});

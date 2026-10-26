/**
 * 가져온 DB 메모 정리(2026-10-26 belie) — 원본 메모 → 상담메모, 「지역(상호)」 → 주소·사업자명, 부재·통화 날짜.
 * 꼴은 실제 공급처 시트(디비스트) 메모에서 본 것을 흉내 냈고, 상호·내용은 모두 가상.
 */
import { describe, expect, it } from "vitest";
import { applyRegionCompanyMemo, consultNoteFromRawMemo, memoRegion, parseCallMemo, splitRegionCompanyMemo, withImportedConsultNote } from "@/lib/analytics/db-sheet-memo";
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
    const lead = { address: "", company: "", memo: RAW, date: "2026-09-13", contact: { note: "" } };
    expect(withImportedConsultNote(lead)).toMatchObject({ address: "서울 송파구", company: "가상상회", contact: { note: "대출이면 괜찮다고 마무리" } });
    const typed = { ...lead, contact: { note: "직접 적은 메모" } };
    expect(withImportedConsultNote(typed)).toBe(typed);
    expect(withImportedConsultNote({ ...lead, company: "원래상호" })).toMatchObject({ company: "원래상호", address: "서울 송파구" });
  });
  it("★메모 줄이 여럿이어도 나뉘는 줄을 찾는다(비고 + 메모)", () => {
    const raw = "비고: 연습용\n메모: 서울서대문구(가상상회)/ 부재중1/16일 금요일 다시 연락\n[가져온 원문]\n | x";
    const lead = { address: "", company: "", memo: raw, date: "2026-09-10", contact: { note: "" } };
    expect(withImportedConsultNote(lead)).toMatchObject({ address: "서울 서대문구", company: "가상상회", contact: { note: "부재중1 / 16일 금요일 다시 연락\n비고: 연습용" } });
    const [row] = parse("비고\t메모\t전화번호\n연습용\t서울서대문구(가상상회)/ 부재중1\t010-0000-2222");
    expect(row).toMatchObject({ address: "서울 서대문구", company: "가상상회", note: "부재중1\n비고: 연습용" });
  });
});

describe("지역 읽기", () => {
  it.each([
    ["서울송파구", "서울 송파구"], ["수원시", "경기 수원시"], ["수원시영통구", "경기 수원시"], ["화성시동탄구", "경기 화성시"],
    ["인천", "인천"], ["인천남동구", "인천 남동구"], ["고양시", "경기 고양시"], ["직접확인필요", ""], ["중구", ""],
  ])("%s → %s", (t, out) => expect(memoRegion(t)).toBe(out));
});

describe("「지역(상호)」 나누기", () => {
  it.each([
    ["서울송파구(가상상회) / 메모", { address: "서울 송파구", company: "가상상회", note: "메모" }],
    ["경기 화성시 (예시공방) 상담 희망", { address: "경기 화성시", company: "예시공방", note: "상담 희망" }],
    ["부산(가상식품)", { address: "부산", company: "가상식품", note: "" }],
    ["화성시(가상 커튼(병점))/재통화", { address: "경기 화성시", company: "가상 커튼(병점)", note: "재통화" }],
    ["고양시/// 사설업체냐고 물음", { address: "경기 고양시", company: "", note: "사설업체냐고 물음" }],
    ["서울광진구(가상상점)_품질업DB : 피드백", { address: "서울 광진구", company: "가상상점", note: "품질업DB : 피드백" }],
    ["서울양천구(가상학원)추석 전 불가", { address: "서울 양천구", company: "가상학원", note: "추석 전 불가" }],
  ])("%s", (text, out) => expect(splitRegionCompanyMemo(text)).toEqual(out));
  it("앞머리가 지역이 아니면 나누지 않는다", () => {
    expect(splitRegionCompanyMemo("오전에 통화(부재) 다시")).toBeNull();
    expect(splitRegionCompanyMemo("직접확인필요/ 부재중2")).toBeNull();
    expect(splitRegionCompanyMemo("자금 3천 문의")).toBeNull();
    expect(applyRegionCompanyMemo({ address: "", company: "" }, "자금 3천 문의")).toEqual({ row: { address: "", company: "" }, note: "자금 3천 문의" });
  });
});

describe("통화 메모 — 부재·통화 날짜", () => {
  it("부재중N(횟수) · 부재중MMDD(날짜) · 부재중N+MMDD", () => {
    expect(parseCallMemo("수원시(가상꽃집)/ 부재중1 /부재중1014", "2026-09-09")).toMatchObject({ absenceCount: 1, absenceDates: ["2026-10-14"], contactDates: [] });
    expect(parseCallMemo("서울종로구(가상공방)/부재중1/부재중21015", "2026-09-22")).toMatchObject({ absenceCount: 2, absenceDates: ["2026-10-15"] });
    expect(parseCallMemo("인천남동구(가상펍)/부재중1 /계속 부재1015/현재 괜찮다 끊으심/", "2026-09-22")).toMatchObject({ absenceDates: ["2026-10-15"], note: "부재중1 / 계속 부재1015 / 현재 괜찮다 끊으심" });
  });
  it("부재가 아닌 말 뒤 MMDD 는 통화한 날", () => {
    expect(parseCallMemo("인천(가상식당)/부재중1 아예거절1015", "2026-09-22")).toMatchObject({ absenceDates: [], contactDates: ["2026-10-15"], absenceCount: 0 });
    expect(parseCallMemo("직접확인필요/ 부재중1/소재지 확인하더니 괜찮다 거절..1015", "2026-09-22")).toMatchObject({ address: "", absenceCount: 1, contactDates: ["2026-10-15"] });
  });
  it("앞이 빈 메모·구분자 여러 개도 깔끔하게", () => {
    expect(parseCallMemo("/ 잘못남겼다 툭 전화 종료.").note).toBe("잘못남겼다 툭 전화 종료.");
    expect(parseCallMemo("서울중랑구(가상향수)///부재중1/이미 신청해서 괜찮다").note).toBe("부재중1 / 이미 신청해서 괜찮다");
    expect(parseCallMemo("1월에 연락", "2026-11-03").contactDates).toEqual([]);
  });
});

describe("가져오기에서도 같은 규칙", () => {
  it("메모 열 하나", () => {
    const [row] = parse("접수시간\t전화번호\t메모\n2026-09-13\t010-0000-1111\t서울송파구(가상상회) / 대출이면 괜찮다고 마무리");
    expect(row).toMatchObject({ address: "서울 송파구", company: "가상상회", note: "대출이면 괜찮다고 마무리" });
  });
});

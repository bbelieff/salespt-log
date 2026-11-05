/** 공급처 알림 글 통째 붙여넣기(belie 2026-11-05): 인사말·안내문은 고객이 아니다. 값은 모두 가상. */
import { describe, expect, it } from "vitest";
import { analyzeImport } from "@/app/(app)/db-sheet/_components/adaptive-import";

const message = (company: string, phone: string) => `가상컨설팅 홍가상과장 대표님

방금 정책자금 신청하신 대표님 정보를 전달 드립니다.
CRM 전산에도 동일하게 접수 되었습니다.


★ B타입 DB 제공 되었습니다.

연락처 : ${phone}
사업자등록번호 : 0000000000
사업자명 : ${company}
대표자명 : 김가상
업종 : 음식점업
지역 : 충청남도
희망 서비스 선택 : ["정책자금"]
연 매출 : 1억 미만
기존 대출 : 3천만원 미만
필요 자금 : 3-6천만원
연체/체납 : X
신용점수 700 : 이상
동의 여부 : Y


빠른 컨택 시 계약율은 높아집니다. 감사합니다.

*위 접수된 정보는 오로지 상담을 위한 목적으로만 이용될 수 있습니다.`;

describe("공급처 알림 글", () => {
  it("인사말·안내문을 빈 고객으로 만들지 않고 한 건으로 읽는다", () => {
    const a = analyzeImport(message("샘플식탁", "01000001234"));
    expect(a.items).toHaveLength(1);
    const l = a.items[0]!.lead;
    expect(l).toMatchObject({ company: "샘플식탁", owner: "김가상", phone: "010-0000-1234", biz: "0000000000", industry: "음식점업", address: "충청남도", sales: "1억 미만", funds: "3-6천만원", arrears: "없음", credit: "700점 이상" });
    expect(a.items[0]!.questions).toEqual([]);
    // 모르는 항목은 원본 메모, 인사말·안내문도 원문에 남는다.
    expect(l.memo).toContain("기존 대출 : 3천만원 미만");
    expect(l.memo).toContain("★ B타입 DB 제공 되었습니다.");
    expect(l.memo).toContain("오로지 상담을 위한 목적");
  });
  it("알림 두 개를 이어 붙이면 두 건", () => {
    const a = analyzeImport(message("샘플식탁", "01000001234") + "\n\n" + message("샘플국밥", "01000005678"));
    expect(a.items.map((i) => i.lead.company)).toEqual(["샘플식탁", "샘플국밥"]);
    expect(a.items[1]!.lead.memo).toContain("가상컨설팅 홍가상과장 대표님");
  });
});

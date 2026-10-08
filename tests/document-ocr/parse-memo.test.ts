import { describe, it, expect } from "vitest";
import { parseMeetingMemo } from "@/lib/document-ocr/parse-memo";

// 합성 메모 — 실제 미팅 메모와 같은 모양(탭으로 라벨·값 구분, 들여쓴 매출 줄, ===== 아래 자유 메모).
const MEMO = `가나다식품 / 홍길동
● 창업일자\t\t\t2023.09(매출발생은 24년 1월)
● 업종\t\t\t음식 / 한식
● 매출 24년 얼마로 마감?\t\t24년 1억2천
\t\t\t\t\t25년 8~9천
\t\t\t\t\t26년 1억 3천(~6월)
>>매출 하락 이유?? \t\t시장이 안좋다.
● 주민등록번호\t\t\t800101-1234567
● 휴대폰번호(통신사)\t\t010 1234 5678 KT
● 사업자등록번호\t\t123-45-67890
● 사업장 소재지\t\t경기도 가상시 테스트로 12 101호
● 자택주소\t\t\t(자가) 경기도 가상시 예시길 3
● 이메일주소\t\tsample@example.com
● 신용점수\t\t\tK820/N948
● 기존 기업신용 대출, 정책자금 \t정책자금없고, 개인명의로는 보험약관대출 (3천만원정도)
● 4대보험 직원수  \t\t2명(1 마케팅, 1 실장)
● 그외 인증(벤처,이노,메인)\t\t상표권 (가나다막걸리)
● 매출 아이템?\t\t수제 막걸리
● 필요한 자금(현실적으로)\t\t3천
● 공동인증서\t\t\tabcd1234//
● 소진공\t\t\tgana77 / Pw1234!
● 공동인증서 비번\t\tQwer!234
=====================================
*10/26
재단 2~3천, 재도전 3천
주거래 농협
301-0000-0000-11
아이디 
GANA0218
기업 000-000000-00000
ZxCv!9876`;

const field = (res: ReturnType<typeof parseMeetingMemo>, key: string) => res.fields.find((f) => f.key === key);

describe("미팅 메모 읽기", () => {
  it("메모를 업체정보 칸·계정 보관함·나머지 메모로 나눈다", () => {
    const res = parseMeetingMemo(MEMO, { baseYear: 2026 });

    expect(res.info).toContainEqual({ label: "상호", value: "가나다식품" });
    expect(field(res, "대표자이름")?.value).toBe("홍길동");
    expect(field(res, "개업일")?.value).toBe("2023-09");
    expect(field(res, "업종주생산품목")?.value).toContain("한식");
    expect(field(res, "주생산품목")?.value).toBe("수제 막걸리");
    expect(field(res, "사업자등록번호")?.value).toBe("123-45-67890");
    expect(field(res, "자택주소지")?.value).toBe("경기도 가상시 예시길 3");
    expect(field(res, "과년도매출Y2")?.value).toBe("120");
    expect(field(res, "매출Y상")?.value).toBe("130");
    expect(res.fields.some((f) => f.key === "과년도매출")).toBe(false);
    expect(res.documentWarnings.some((w) => w.includes("25년") && w.includes("범위"))).toBe(true);

    expect(field(res, "주민등록번호")?.value).toBe("800101-");
    expect(res.vault).toContainEqual(expect.objectContaining({ kind: "rrn", id: "홍길동", secret: "800101-1234567" }));
    expect(field(res, "신용점수")?.value).toBe("K820/N948");

    expect(res.vault.find((v) => v.label === "공동인증서")?.secret).toBe("abcd1234");
    expect(res.vault.find((v) => v.label === "공동인증서 비번")?.secret).toBe("Qwer!234");
    expect(res.vault.find((v) => v.label === "소진공")).toMatchObject({ id: "gana77", secret: "Pw1234!" });
    expect(res.vault.find((v) => v.secret === "301-0000-0000-11")?.label).toContain("농협");
    expect(res.vault).toContainEqual(expect.objectContaining({ label: "아이디(메모)", id: "GANA0218" }));
    expect(res.vault.some((v) => v.secret === "000-000000-00000")).toBe(true);
    expect(res.vault).toContainEqual(expect.objectContaining({ label: "비밀번호(어느 계정인지 확인)", secret: "ZxCv!9876" }));

    expect(res.leftover).toContain("시장이 안좋다");
    expect(res.leftover).toContain("필요한 자금");
    for (const secret of ["Pw1234!", "ZxCv!9876", "1234567", "301-0000", "GANA0218", "Qwer"]) {
      expect(res.leftover).not.toContain(secret);
    }
  });

  it("비밀번호·계좌·주민번호 뒷자리는 칸·참고정보·경고 어디에도 나오지 않는다", () => {
    const res = parseMeetingMemo(MEMO, { baseYear: 2026 });
    const open = JSON.stringify([res.fields, res.info, res.documentWarnings]);
    for (const secret of ["Pw1234!", "1234567", "Qwer", "ZxCv", "abcd1234", "301-0000"]) {
      expect(open).not.toContain(secret);
    }
  });

  it("단위 없는 숫자는 만원으로 읽고 확인을 요청한다", () => {
    const res = parseMeetingMemo("[스페이스 테스트]\n● 매출 25년 얼마로 마감?   2000", { baseYear: 2026 });
    expect(res.info).toContainEqual({ label: "상호", value: "스페이스 테스트" });
    const f = field(res, "과년도매출");
    expect(f?.value).toBe("20");
    expect(f?.confidence).toBe(0.4);
    expect(f?.warnings.some((w) => w.includes("만원"))).toBe(true);
  });

  it("「26년 상반기」처럼 라벨에 연도·반기가 있으면 그 반기 칸에 넣는다", () => {
    const memo = "가상주조\n● 매출 25년 얼마로 마감?\t\t100,479,160원 (실제매출의 40%)\n● 26년 상반기\t\t52,642,337원\n● 매출\n\t\t\t24년도 1억1천";
    const res = parseMeetingMemo(memo, { baseYear: 2026 });
    expect(field(res, "과년도매출")).toMatchObject({ value: "100.5", warnings: ["메모: 실제매출의 40%"] });
    expect(field(res, "매출Y상")?.value).toBe("52.6");
    expect(field(res, "과년도매출Y2")?.value).toBe("110");
  });
});

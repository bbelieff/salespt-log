/**
 * 업체정보 [재무] 자동 계산 (company-finance-won-grid, belie 2026-09-28) — 순수 함수, 합성 값만.
 *  ① 연도별 매출 줄: 반기 합(십만원 정수) · 한쪽만 · 읽을 수 없는 반기 · 둘 다 비면 직접 적은 합계 · 이전에 적은 합계
 *  ② 매출증가율 = 줄 합계(옛 글·단위 없는 숫자 = 백만원)
 *  ③ 부분 연도 안내(Y 상반기만 / 옛 "6월")
 *  ④ 비율: 부채비율·이자보상배율·당기순이익률(결산연도 → 기준 연도로 찾은 줄 합계)
 *  ⑤ apply 경로(deriveCompanyInfo): 합계 저장 · 덮이는 사용자 합계는 기타메모로 · 기준 연도 첫 저장 ·
 *     주민등록번호 앞자리 채움 · 비율 옛 글 보존
 *  ⑥ 「백만원으로 바꾸기」 패치
 */
import { describe, expect, it } from "vitest";
import { CompanyInfo } from "@/types";
import {
  companyInfoForExport,
  computeRatios,
  computeSalesGrowth,
  computeSalesTotals,
  deriveCompanyInfo,
  legacyMoneyConvertPatch,
  partialYearNote,
  salesRowView,
  sameRatioText,
  withSalesGrowth,
} from "@/service/company-finance";

const TODAY = new Date(2026, 8, 28);
const ci = (v: Partial<CompanyInfo> = {}) => CompanyInfo.parse(v);

describe("① 연도별 매출 줄", () => {
  it("상·하반기 합 — 소수 오차 없이(십만원 정수)", () => {
    const r = salesRowView({ 매출Y1상: "0.1", 매출Y1하: "0.2" }, 1);
    expect(r.auto).toBe(true);
    expect(r.total).toBe(3);
    expect(computeSalesTotals({ 매출Y1상: "0.1", 매출Y1하: "0.2" })).toEqual({ 과년도매출: "0.3" });
    expect(computeSalesTotals({ 매출Y상: "120.5", 매출Y하: "1,130" })).toEqual({ 금년도매출: "1,250.5" });
  });

  it("한쪽만 있으면 그 반기만 더하고 어느 쪽인지 알려 준다", () => {
    const r = salesRowView({ 매출Y2상: "80" }, 2);
    expect(r).toMatchObject({ auto: true, only: "상반기", total: 800 });
    expect(salesRowView({ 매출Y2하: "90" }, 2).only).toBe("하반기");
  });

  it("옛 글 반기도 읽어 더한다(1.2억 + 1.3억 = 250)", () => {
    expect(computeSalesTotals({ 매출Y1상: "1.2억", 매출Y1하: "1.3억" })).toEqual({ 과년도매출: "250" });
  });

  it("반기에 읽을 수 없는 글이 있으면 합계를 덮지 않는다", () => {
    const r = salesRowView({ 매출Y1상: "120", 매출Y1하: "모름", 과년도매출: "300" }, 1);
    expect(r).toMatchObject({ auto: false, blocked: true, total: 3000 });
    expect(computeSalesTotals({ 매출Y1상: "120", 매출Y1하: "모름", 과년도매출: "300" })).toEqual({});
  });

  it("반기 둘 다 비면 합계 칸 값(옛 연도 합계 포함)을 그대로 쓴다", () => {
    expect(salesRowView({ 과년도매출: "25' 250백만" }, 1)).toMatchObject({ auto: false, total: 2500 });
    expect(computeSalesTotals({ 과년도매출: "25' 250백만" })).toEqual({});
  });

  it("자동인데 저장된 합계 금액이 다르면 '이전에 적은 합계'", () => {
    expect(salesRowView({ 매출Y1상: "1.2억", 매출Y1하: "1.3억", 과년도매출: "25' 260백만" }, 1).staleTotal).toBe(
      "25' 260백만",
    );
    // 같은 금액이면 모양만 다른 것 — 알리지 않는다.
    expect(salesRowView({ 매출Y1상: "1.2억", 매출Y1하: "1.3억", 과년도매출: "25' 250백만" }, 1).staleTotal).toBe("");
  });
});

describe("② 매출증가율", () => {
  it("줄 합계로 — 반기 합과 직접 적은 합계가 섞여도", () => {
    const g = computeSalesGrowth({
      과년도매출Y3: "100",
      매출Y2상: "60",
      매출Y2하: "65",
      과년도매출: "25' 12,500만",
      금년도매출: "100",
    });
    expect(g).toEqual({ 매출증가율Y3Y2: "+25.0%", 매출증가율Y2Y1: "0.0%", 매출증가율Y1Y: "-20.0%" });
  });

  it("단위 없는 숫자는 이제 백만원(25' 250 = 250백만원)", () => {
    const g = computeSalesGrowth({
      과년도매출Y3: "23' 2억",
      과년도매출Y2: "24' 2억5천",
      과년도매출: "25' 250",
      금년도매출: "26' 3억",
    });
    expect(g).toEqual({ 매출증가율Y3Y2: "+25.0%", 매출증가율Y2Y1: "0.0%", 매출증가율Y1Y: "+20.0%" });
  });

  it("한쪽이 비었거나 못 읽으면 그 칸만 빈값", () => {
    const g = computeSalesGrowth({ 과년도매출Y3: "", 과년도매출Y2: "100", 과년도매출: "모름", 금년도매출: "100" });
    expect(g).toEqual({ 매출증가율Y3Y2: "", 매출증가율Y2Y1: "", 매출증가율Y1Y: "" });
  });

  it("withSalesGrowth — 계산값을 채운 사본, 이미 같으면 같은 객체, 매출을 지우면 비운다", () => {
    const base = { 과년도매출: "200", 금년도매출: "250", 매출증가율Y1Y: "" };
    const next = withSalesGrowth(base);
    expect(next.매출증가율Y1Y).toBe("+25.0%");
    expect(withSalesGrowth(next)).toBe(next);
    expect(withSalesGrowth({ ...next, 금년도매출: "" }).매출증가율Y1Y).toBe("");
  });
});

describe("③ 부분 연도 안내", () => {
  it("Y 상반기만 있으면 안내 — 기준 연도로 부른다('올해' 아님)", () => {
    expect(partialYearNote({ 매출Y상: "100" }, 2026)).toBe("Y(2026)는 상반기 매출만 있어 낮게 보일 수 있어요");
    expect(partialYearNote({ 매출Y상: "100" }, 2025)).toBe("Y(2025)는 상반기 매출만 있어 낮게 보일 수 있어요");
    expect(partialYearNote({ 매출Y상: "100", 매출Y하: "120" }, 2026)).toBe("");
  });
  it("옛 합계 글에 '6월' 이 있으면 안내, 12월·월 없음은 없음", () => {
    expect(partialYearNote({ 금년도매출: "26' 6월 100백만" }, 2026)).toBe("Y(2026)는 6월까지 매출이라 낮게 보일 수 있어요");
    expect(partialYearNote({ 금년도매출: "26' 12월 300백만" }, 2026)).toBe("");
    expect(partialYearNote({ 금년도매출: "300" }, 2026)).toBe("");
    expect(partialYearNote({}, 2026)).toBe("");
  });
});

describe("④ 재무 비율", () => {
  it("부채비율·이자보상배율 — 소수 한 자리", () => {
    const r = computeRatios({ 부채총계: "1,375", 자본총계: "1,125", 영업이익: "240", 이자비용: "100" }, 2026);
    expect(r.부채비율).toBe("122.2%");
    expect(r.이자보상배율).toBe("2.4배");
    expect(computeRatios({ 부채총계: "120", 자본총계: "100" }, 2026).부채비율).toBe("120.0%");
  });

  it("자본총계 0 이하 → 자본잠식, 이자비용 빈칸 → 빈값, 이자비용 0 → 「이자비용 없음」(0 으로 못 나눔)", () => {
    expect(computeRatios({ 부채총계: "180", 자본총계: "-30" }, 2026).부채비율).toBe("자본잠식");
    expect(computeRatios({ 자본총계: "0" }, 2026).부채비율).toBe("자본잠식");
    expect(computeRatios({ 영업이익: "240" }, 2026).이자보상배율).toBe("");
    expect(computeRatios({ 영업이익: "240", 이자비용: "0" }, 2026).이자보상배율).toBe("이자비용 없음");
    expect(computeRatios({ 영업이익: "-12.3", 이자비용: "10" }, 2026).이자보상배율).toBe("-1.2배");
  });

  it("당기순이익률 = 결산연도 줄 합계(기준 연도로 칸을 찾음)", () => {
    const v = { 당기순이익: "96", 결산연도: "2025", 매출Y1상: "1,500", 매출Y1하: "1,700" };
    expect(computeRatios(v, 2026).당기순이익률).toBe("3.0%");
    // 기준 연도가 2025 면 2025 = Y 줄(비어 있음) → 빈값.
    expect(computeRatios(v, 2025).당기순이익률).toBe("");
    expect(computeRatios({ 당기순이익: "96", 결산연도: "2019", 과년도매출: "3,200" }, 2026).당기순이익률).toBe("");
    expect(computeRatios({ 당기순이익: "-20", 결산연도: "2023", 과년도매출Y3: "400" }, 2026).당기순이익률).toBe("-5.0%");
  });

  it("옛 손익 글(-3,200만 · 괄호 음수 (3,200만))도 읽는다", () => {
    expect(computeRatios({ 영업이익: "-3,200만", 이자비용: "32" }, 2026).이자보상배율).toBe("-1.0배");
    expect(computeRatios({ 영업이익: "(3,200만)", 이자비용: "32" }, 2026).이자보상배율).toBe("-1.0배");
    expect(computeRatios({ 부채총계: "100", 자본총계: "(1,234)" }, 2026).부채비율).toBe("자본잠식");
  });

  it("반올림은 0 에서 먼 쪽 — 음수도 양수와 같은 크기로(2.45 → 2.5, -2.45 → -2.5)", () => {
    expect(computeRatios({ 영업이익: "24.5", 이자비용: "10" }, 2026).이자보상배율).toBe("2.5배");
    expect(computeRatios({ 영업이익: "-24.5", 이자비용: "10" }, 2026).이자보상배율).toBe("-2.5배");
    expect(computeRatios({ 영업이익: "-0.1", 이자비용: "1,000" }, 2026).이자보상배율).toBe("0.0배");
  });

  it("비율 글 비교 — 모양이 달라도 소수 한 자리 숫자가 같으면 같은 값", () => {
    expect(sameRatioText("120%", "120.0%")).toBe(true);
    expect(sameRatioText("2.4배", "2.4배")).toBe(true);
    expect(sameRatioText("122.2%", "120.0%")).toBe(false);
    expect(sameRatioText("자본잠식", "120.0%")).toBe(false);
    expect(sameRatioText("모름", "")).toBe(false);
  });
});

describe("⑤ apply 경로 — deriveCompanyInfo", () => {
  it("반기를 적으면 합계·증가율·비율이 같이 저장된다", () => {
    const prev = ci({ 과년도매출Y2: "200", 부채총계: "100", 자본총계: "50" });
    const next = deriveCompanyInfo(prev, { ...prev, 매출Y1상: "120", 매출Y1하: "130" }, TODAY);
    expect(next.과년도매출).toBe("250");
    expect(next.매출증가율Y2Y1).toBe("+25.0%");
    expect(next.부채비율).toBe("200.0%");
    expect(next.업체기타메모).toBe("");
  });

  it("사용자가 적은 다른 합계를 반기 합이 덮으면 기타메모로 옮긴다(한 번만)", () => {
    const prev = ci({ 과년도매출: "250", 업체기타메모: "기존 메모" });
    const a = deriveCompanyInfo(prev, { ...prev, 매출Y1상: "1" }, TODAY);
    expect(a.과년도매출).toBe("1");
    expect(a.업체기타메모).toBe("기존 메모\n매출 Y-1(2025) 이전 합계: 250");
    // 이어 치는 글자 — 자동 합계가 저장한 값이라 더 옮기지 않는다.
    const b = deriveCompanyInfo(a, { ...a, 매출Y1상: "12" }, TODAY);
    expect(b.과년도매출).toBe("12");
    expect(b.업체기타메모).toBe(a.업체기타메모);
  });

  it("열 때부터 금액이 다른 옛 합계는 첫 저장 때 기타메모로, 같은 금액이면 모양만 바꾼다", () => {
    const stale = ci({ 매출Y1상: "1.2억", 매출Y1하: "1.3억", 과년도매출: "25' 260백만" });
    const a = deriveCompanyInfo(stale, { ...stale, 대표자이름: "홍길동" }, TODAY);
    expect(a.과년도매출).toBe("250");
    expect(a.업체기타메모).toBe("매출 Y-1(2025) 이전 합계: 25' 260백만");
    const same = ci({ 매출Y1상: "1.2억", 매출Y1하: "1.3억", 과년도매출: "25' 250백만" });
    const b = deriveCompanyInfo(same, { ...same, 대표자이름: "홍길동" }, TODAY);
    expect(b.과년도매출).toBe("250");
    expect(b.업체기타메모).toBe("");
  });

  it("같은 금액이어도 반기로 안 드러나는 '3월' 표시가 있던 옛 합계는 기타메모로 옮긴다(정보 보존)", () => {
    const prev = ci({ 매출Y상: "1억", 금년도매출: "26' 3월 100백만" });
    expect(salesRowView(prev, 0).staleTotal).toBe("26' 3월 100백만");
    const next = deriveCompanyInfo(prev, { ...prev, 대표자이름: "a" }, TODAY);
    expect(next.금년도매출).toBe("100");
    expect(next.업체기타메모).toBe("매출 Y(2026) 이전 합계: 26' 3월 100백만");
    // 그다음 편집 — 이미 자동 합계 값이라 더 옮기지 않는다.
    expect(deriveCompanyInfo(next, { ...next, 대표자이름: "b" }, TODAY).업체기타메모).toBe(next.업체기타메모);
  });

  it("#1068 문서 자동입력 모양의 합계(백만 반올림 · 반기로 드러나는 6월/12월)는 같은 값 — 다른 칸을 고쳐도 기타메모 그대로", () => {
    // 옛 부가세 파서: 반기 = 만원 단위 글, 합계 = 백만 단위 반올림(Y 는 "N월" 붙음).
    const prev = ci({
      매출Y상: "1억 2,340만",
      금년도매출: "26' 6월 123백만",
      매출Y1상: "1억 2,340만",
      매출Y1하: "1억 2,340만",
      과년도매출: "25' 247백만",
      매출Y2상: "1억",
      매출Y2하: "1억 5,000만",
      과년도매출Y2: "24' 12월 250백만",
      업체기타메모: "메모",
    });
    for (const i of [0, 1, 2]) expect(salesRowView(prev, i).staleTotal).toBe("");
    const next = deriveCompanyInfo(prev, { ...prev, 대표자이름: "홍길동" }, TODAY);
    expect(next.업체기타메모).toBe("메모");
    expect([next.금년도매출, next.과년도매출, next.과년도매출Y2]).toEqual(["123.4", "246.8", "250"]);
    // 반올림 폭(±0.5백만)을 넘는 차이, 사용자가 적은 정밀한 글("3,200만")은 여전히 옮긴다.
    expect(salesRowView(ci({ 매출Y1상: "1억 2,340만", 매출Y1하: "1억 2,340만", 과년도매출: "25' 248백만" }), 1).staleTotal).toBe(
      "25' 248백만",
    );
    expect(salesRowView(ci({ 매출Y3상: "32.3", 과년도매출Y3: "3,200만" }), 3).staleTotal).toBe("3,200만");
  });

  it("문서 자동입력이 합계 칸을 직접 바꾸면(명시적 덮어쓰기) 옮기지 않는다", () => {
    const prev = ci({ 과년도매출: "25' 260백만" });
    const next = deriveCompanyInfo(prev, { ...prev, 매출Y1상: "120", 매출Y1하: "130", 과년도매출: "250" }, TODAY);
    expect(next.업체기타메모).toBe("");
  });

  it("반기가 있는 줄에 문서 합계가 반기 합과 다르면 — 합계는 반기 합, 고른 문서 값은 기타메모로(버리지 않음)", () => {
    const prev = ci({ 매출Y1상: "1.2억", 매출Y1하: "1.3억", 과년도매출: "25' 250백만" });
    const next = deriveCompanyInfo(prev, { ...prev, 과년도매출: "3,200" }, TODAY);
    expect(next.과년도매출).toBe("250");
    expect(next.업체기타메모).toBe("매출 Y-1(2025) 합계(반기 합과 달라 옮김): 3,200");
  });

  it("반기를 치다 모두 지우면 자동 합계를 지우고, 기타메모로 옮겼던 그 줄의 옛 합계를 되돌린다", () => {
    const prev = ci({ 과년도매출: "25' 250백만", 업체기타메모: "기존" });
    const a = deriveCompanyInfo(prev, { ...prev, 매출Y1상: "1" }, TODAY);
    expect(a.업체기타메모).toBe("기존\n매출 Y-1(2025) 이전 합계: 25' 250백만");
    const b = deriveCompanyInfo(a, { ...a, 매출Y1상: "" }, TODAY);
    expect(b.과년도매출).toBe("25' 250백만");
    expect(b.업체기타메모).toBe("기존");
    // 옛 합계가 없던 줄 — 친 글자("5")가 합계로 남지 않는다.
    const c0 = ci({});
    const c1 = deriveCompanyInfo(c0, { ...c0, 매출Y상: "5" }, TODAY);
    expect(c1.금년도매출).toBe("5");
    expect(deriveCompanyInfo(c1, { ...c1, 매출Y상: "" }, TODAY).금년도매출).toBe("");
  });

  it("반기를 지워도 반기 합과 다른(직접 적은) 합계는 그대로 둔다", () => {
    const prev = ci({ 매출Y1상: "120", 과년도매출: "25' 300백만" });
    const next = deriveCompanyInfo(prev, { ...prev, 매출Y1상: "" }, TODAY);
    expect(next.과년도매출).toBe("25' 300백만");
  });

  it("반기에 읽을 수 없는 글이면 합계를 덮지 않는다", () => {
    const prev = ci({ 과년도매출: "300" });
    const next = deriveCompanyInfo(prev, { ...prev, 매출Y1상: "모름" }, TODAY);
    expect(next.과년도매출).toBe("300");
  });

  it("기준 연도 — 재무 칸을 처음 고칠 때 오늘 연도로 저장, 재무 값이 없는 업체의 다른 칸만 고치면 그대로 비움", () => {
    const prev = ci({});
    expect(deriveCompanyInfo(prev, { ...prev, 대표자이름: "홍길동" }, TODAY).매출기준연도).toBe("");
    expect(deriveCompanyInfo(prev, { ...prev, 영업이익: "32" }, TODAY).매출기준연도).toBe("2026");
    const kept = ci({ 매출기준연도: "2025" });
    expect(deriveCompanyInfo(kept, { ...kept, 영업이익: "32" }, TODAY).매출기준연도).toBe("2025");
  });

  it("기준 연도 — 재무 값이 있는 옛 업체는 다른 칸만 고쳐도 함께 저장(합계·증가율과 같이 — 해가 바뀌어도 칸이 안 밀림)", () => {
    const prev = ci({ 매출Y1상: "120", 매출Y1하: "130", 과년도매출Y2: "200" });
    const next = deriveCompanyInfo(prev, { ...prev, 대표자이름: "홍길동" }, TODAY);
    expect(next.매출기준연도).toBe("2026");
    expect(next.매출증가율Y2Y1).toBe("+25.0%");
  });

  it("주민등록번호가 비었고 생년월일을 읽을 수 있으면 앞자리를 함께 저장", () => {
    for (const 대표자생년월일 of ["88.01.24", "1988-01-24", "880124"]) {
      const prev = ci({ 대표자생년월일 });
      expect(deriveCompanyInfo(prev, { ...prev, 대표자이름: "홍길동" }, TODAY).주민등록번호).toBe("880124-");
    }
    const has = ci({ 대표자생년월일: "88.01.24", 주민등록번호: "900101-" });
    expect(deriveCompanyInfo(has, { ...has, 대표자이름: "홍길동" }, TODAY).주민등록번호).toBe("900101-");
    const bad = ci({ 대표자생년월일: "모름" });
    expect(deriveCompanyInfo(bad, { ...bad, 대표자이름: "홍길동" }, TODAY).주민등록번호).toBe("");
  });

  it("주민등록번호를 지우면 생년월일도 함께 지워 비운 채로 남는다(다시 채워지지 않음)", () => {
    const prev = ci({ 대표자생년월일: "88.01.24", 주민등록번호: "880124-" });
    const cleared = deriveCompanyInfo(prev, { ...prev, 주민등록번호: "" }, TODAY);
    expect(cleared.주민등록번호).toBe("");
    expect(cleared.대표자생년월일).toBe("");
    expect(deriveCompanyInfo(cleared, { ...cleared, 대표자이름: "홍길동" }, TODAY).주민등록번호).toBe("");
    // 다른 칸만 고치면 생년월일은 그대로.
    expect(deriveCompanyInfo(prev, { ...prev, 대표자이름: "홍길동" }, TODAY).대표자생년월일).toBe("88.01.24");
  });

  it("비율 — 계산값이 있으면 옛 글을 바꾸고, 계산할 금액이 없으면 옛 글은 그대로, 자동 값은 비운다", () => {
    const legacy = ci({ 부채비율: "120%", 부채총계: "100", 자본총계: "50" });
    expect(deriveCompanyInfo(legacy, { ...legacy, 대표자이름: "a" }, TODAY).부채비율).toBe("200.0%");
    const onlyText = ci({ 부채비율: "120%" });
    expect(deriveCompanyInfo(onlyText, { ...onlyText, 대표자이름: "a" }, TODAY).부채비율).toBe("120%");
    const auto = ci({ 부채비율: "200.0%", 부채총계: "100", 자본총계: "50" });
    expect(deriveCompanyInfo(auto, { ...auto, 부채총계: "" }, TODAY).부채비율).toBe("");
    // #1068 재무제표 파서 모양("200%")도 계산값과 같은 숫자면 자동 값으로 본다.
    const old = ci({ 부채비율: "200%", 부채총계: "100", 자본총계: "50" });
    expect(deriveCompanyInfo(old, { ...old, 부채총계: "" }, TODAY).부채비율).toBe("");
  });

  it("TXT 내보내기용 — 저장 전이어도 기준 연도·계산값을 채운다", () => {
    const out = companyInfoForExport(ci({ 매출Y상: "100" }), TODAY);
    expect(out.매출기준연도).toBe("2026");
    expect(out.금년도매출).toBe("100");
  });
});

describe("⑥ 「백만원으로 바꾸기」", () => {
  it("읽히는 옛 글 → 정본 백만원, 몇 월 표시가 있으면 원문을 기타메모로", () => {
    expect(legacyMoneyConvertPatch({ 과년도매출: "25' 250백만" }, "과년도매출", "매출 Y-1(2025)")).toEqual({
      과년도매출: "250",
    });
    expect(
      legacyMoneyConvertPatch({ 금년도매출: "26' 6월 100백만", 업체기타메모: "메모" }, "금년도매출", "매출 Y(2026)"),
    ).toEqual({ 금년도매출: "100", 업체기타메모: "메모\n매출 Y(2026) 원래 적은 값: 26' 6월 100백만" });
    expect(legacyMoneyConvertPatch({ 영업이익: "-3,200만" }, "영업이익", "영업이익")).toEqual({ 영업이익: "-32" });
    expect(legacyMoneyConvertPatch({ 과년도매출: "25' 250" }, "과년도매출", "x")).toEqual({ 과년도매출: "250" });
  });
  it("괄호 음수는 손익 칸에서 음수로, 원 단위 큰 숫자는 원 → 백만원으로 바꾼다", () => {
    expect(legacyMoneyConvertPatch({ 영업이익: "(1,234)" }, "영업이익", "영업이익")).toEqual({ 영업이익: "-1,234" });
    expect(legacyMoneyConvertPatch({ 영업이익: "(3,200만)" }, "영업이익", "영업이익")).toEqual({ 영업이익: "-32" });
    expect(legacyMoneyConvertPatch({ 이자비용: "(1,234)" }, "이자비용", "이자비용")).toBeNull();
    expect(legacyMoneyConvertPatch({ 과년도매출: "250,000,000" }, "과년도매출", "x")).toEqual({ 과년도매출: "250" });
  });
  it("못 읽는 글·이미 숫자·빈칸이면 null", () => {
    expect(legacyMoneyConvertPatch({ 과년도매출: "모름" }, "과년도매출", "x")).toBeNull();
    expect(legacyMoneyConvertPatch({ 과년도매출: "250" }, "과년도매출", "x")).toBeNull();
    expect(legacyMoneyConvertPatch({}, "과년도매출", "x")).toBeNull();
  });
});

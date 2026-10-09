import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import { buildCompanyActivities, buildInstitutionWorkItems, companyActivityKey, groupInstitutionWorkItems } from "@/app/(app)/payment/_lib/institution-view";

const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0,
  수납일: "", 메모: "", ...over,
});
const contract = (row: number, company: string, slots: PaymentSlot[]): ContractPayment => ({
  row, 계약일: "2026-09-04", 업체명: company, 수임비: 0,
  공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false,
  사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slots[0] ?? slot(), 수납2: slots[1] ?? slot(), 수납3: slots[2] ?? slot(),
  로드맵메모: "", 계약비고: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false,
});
const todo = (company: string, institution: string, date: string, over: Partial<Todo> = {}): Todo => ({
  id: `${company}-${institution}-${date}`, contractRef: `2026-09-04|${company}`,
  institutionRef: institution, 업체명: company, type: "기타", 제목: "연락",
  예정일자: date, 예정시각: "09:00", 장소: "", 상세: "", showOnCalendar: true,
  완료여부: false, 생성시각: "", 분류: "", 기록종류: "todo", ...over,
});

describe("진행기관 보기의 계약→진행건 투영", () => {
  it("같은 업체가 두 기관에 진행하면 서로 다른 건으로 표시하고 정확한 슬롯을 보존한다", () => {
    const rows = [contract(3, "한빛태권도장", [
      slot({ 진행기관: " 소진공 ", 진행상품: "혁신성장촉진자금", 진행률: "60%" }),
      slot({ 진행기관: "신보", 진행상품: "보증상품", 진행률: "20%" }),
    ])];
    const items = buildInstitutionWorkItems(rows);
    expect(items.map(({ row, slot, institution, product }) => ({ row, slot, institution, product }))).toEqual([
      { row: 3, slot: 1, institution: "소진공", product: "혁신성장촉진자금" },
      { row: 3, slot: 2, institution: "신보", product: "보증상품" },
    ]);
    expect(items.map((item) => item.progress)).toEqual([60, 20]);
    expect(rows[0]?.수납1.진행기관).toBe(" 소진공 ");
  });

  it("진행이 없는 계약과 상품 미입력 진행도 누락하지 않고 마지막에 모은다", () => {
    const items = buildInstitutionWorkItems([
      contract(3, "미입력업체", []),
      contract(4, "상품없는업체", [slot({ 진행기관: "소진공" })]),
      contract(5, "상품있는업체", [slot({ 진행기관: "소진공", 진행상품: "혁신성장" })]),
    ]);
    const groups = groupInstitutionWorkItems(items);
    expect(groups.map((group) => [group.institution, group.count])).toEqual([["소진공", 2], ["", 1]]);
    expect(groups[0]?.items.map((item) => item.product)).toEqual(["혁신성장", ""]);
  });

  it("검색은 기관·상품·업체를 대상으로 하고 건수는 진행건 기준으로 센다", () => {
    const items = buildInstitutionWorkItems([
      contract(3, "한빛태권도장", [slot({ 진행기관: "소진공", 진행상품: "혁신성장" })]),
      contract(4, "두리상사", [slot({ 진행기관: "소진공", 진행상품: "일반형" })]),
    ]);
    expect(groupInstitutionWorkItems(items, "혁신 성장")[0]?.count).toBe(1);
    expect(groupInstitutionWorkItems(items, "한빛")[0]?.items[0]?.row).toBe(3);
    expect(groupInstitutionWorkItems(items, "소진공")[0]?.count).toBe(2);
  });

  it("예전 소진공 기관 칸에 적힌 상품을 보기에서만 분리해 한 기관으로 묶는다", () => {
    const rows = [
      contract(3, "가업체", [slot({ 진행기관: "소진공 신취" })]),
      contract(4, "나업체", [slot({ 진행기관: "소진공 재도전" })]),
      contract(5, "다업체", [slot({ 진행기관: "소진공", 진행상품: "혁신" })]),
      contract(6, "라업체", [slot({ 진행기관: "전북재단 부안지점" })]),
    ];
    const groups = groupInstitutionWorkItems(buildInstitutionWorkItems(rows));
    expect(groups.find((g) => g.institution === "소진공")?.items.map((i) => i.product)).toEqual(["신취", "재도전", "혁신"]);
    expect(groups.find((g) => g.institution === "전북재단 부안지점")?.count).toBe(1);
    expect(rows[0]?.수납1.진행기관).toBe("소진공 신취");
  });

  it("D-?? → 최근 History → 임박 Todo 순으로 같은 기관의 진행건을 정렬한다", () => {
    const rows = [
      contract(3, "기록없음", [slot({ 진행기관: "신보" })]),
      contract(4, "최근한일", [slot({ 진행기관: "신보" })]),
      contract(5, "오래된한일", [slot({ 진행기관: "신보" })]),
      contract(6, "오늘할일", [slot({ 진행기관: "신보" })]),
      contract(7, "내일할일", [slot({ 진행기관: "신보" })]),
      contract(8, "완료한일", [slot({ 진행기관: "신보" })]),
      contract(9, "지난할일", [slot({ 진행기관: "신보" })]),
    ];
    const records = [
      todo("최근한일", "신보", "2026-09-28", { 기록종류: "history" }),
      todo("오래된한일", "신보", "2026-09-26", { 기록종류: "history" }),
      todo("오늘할일", "신보", "2026-09-28"),
      todo("내일할일", "신보", "2026-09-29"),
      todo("완료한일", "신보", "2026-09-25", { 완료여부: true }),
      todo("지난할일", "신보", "2026-09-27"),
    ];
    const items = groupInstitutionWorkItems(buildInstitutionWorkItems(rows, "", records, "2026-09-28"), "", "activity", "2026-09-28")[0]!.items;
    expect(items.slice(0, 2).map((item) => item.activityLabel)).toEqual(["D?", "D?"]);
    expect(items.slice(2).map((item) => item.company)).toEqual(["지난할일", "오늘할일", "오래된한일", "최근한일", "내일할일"]);
    expect(items.slice(2).map((item) => item.activityLabel)).toEqual(["D+01", "D0", "H+02", "H+00", "D-01"]);
  });

  it("Todo 연결에는 화면상 그룹명이 아니라 저장된 슬롯 기관명을 사용한다", () => {
    const rows = [contract(3, "예시", [slot({ 진행기관: "소진공 신취 ", 진행상품: "" }), slot({ 진행기관: "신보" })])];
    const records = [todo("예시", "소진공 신취", "2026-09-29"), todo("예시", "신보", "2026-09-28", { 기록종류: "history" })];
    const items = buildInstitutionWorkItems(rows, "", records, "2026-09-28");
    expect(items.map((item) => [item.slot, item.institution, item.activityLabel])).toEqual([
      [1, "소진공", "D-01"], [2, "신보", "H+00"],
    ]);
  });

  it("업체 카드는 여러 진행의 가장 이른 미완료 Todo, 없으면 최근 History를 대표로 삼는다", () => {
    const rows = [
      contract(3, "기록없음", []),
      contract(4, "한일만", [slot({ 진행기관: "신보" })]),
      contract(5, "여러진행", [slot({ 진행기관: "신보" }), slot({ 진행기관: "소진공" })]),
    ];
    const records = [
      todo("한일만", "신보", "2026-09-26", { 기록종류: "history" }),
      todo("한일만", "신보", "2026-09-28", { 기록종류: "history" }),
      todo("여러진행", "신보", "2026-09-28", { 기록종류: "history" }),
      todo("여러진행", "신보", "2026-10-01"),
      todo("여러진행", "소진공", "2026-09-29"),
      todo("여러진행", "소진공", "2026-09-25", { 완료여부: true }),
    ];
    const activities = buildCompanyActivities(buildInstitutionWorkItems(rows, "", records, "2026-09-28"), "2026-09-28");
    expect(rows.map((row) => activities.get(companyActivityKey(row))?.activityLabel)).toEqual(["D?", "H+00", "D-01"]);
    expect(activities.get(companyActivityKey(rows[2]!))?.activityKind).toBe("todo");
  });
});

  it("blank date cannot erase valid Todo; completed Todo never outranks History", () => {
    const rows = [contract(3, "합성", [slot({ 진행기관: "신보" })])];
    const records = [todo("합성", "신보", "2026-10-12"), todo("합성", "신보", ""), todo("합성", "신보", "2026-10-01", { 완료여부: true }), todo("합성", "신보", "2026-10-08", { 기록종류: "history" })];
    expect(buildInstitutionWorkItems(rows, "", records, "2026-10-10")[0]?.activityLabel).toBe("D-02");
    expect(buildInstitutionWorkItems(rows, "", records.slice(1), "2026-10-10")[0]?.activityLabel).toBe("H+02");
  });
  it("company representative shares priority and institution ties preserve stored order", () => {
    const rows = [contract(3, "합성", [slot({ 진행기관: "신보" }), slot({ 진행기관: "소진공" })])];
    const records = [todo("합성", "신보", "2026-10-11"), todo("합성", "소진공", "2026-10-08", { 기록종류: "history" })];
    const items = buildInstitutionWorkItems(rows, "", records, "2026-10-10");
    expect(buildCompanyActivities(items, "2026-10-10").get(companyActivityKey(rows[0]!))?.activityKind).toBe("history");
    const tied = [ {...items[0]!, company: "Z", product: "Z"}, {...items[0]!, company: "A", product: "A"} ];
    expect(groupInstitutionWorkItems(tied, "", "activity", "2026-10-10")[0]?.items.map(x => x.company)).toEqual(["Z", "A"]);
  });

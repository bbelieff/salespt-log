import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import { buildCompanyWorkItems, sortCompanyWorkItems } from "@/app/(app)/payment/_lib/company-work-view";
import { buildInstitutionWorkItems } from "@/app/(app)/payment/_lib/institution-view";

const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0,
  수납액: 0, 수납일: "", 메모: "", ...over,
});
const contract = (row: number, name: string, date: string, slots: PaymentSlot[]): ContractPayment => ({
  row, 계약일: date, 업체명: name, 수임비: 0, 계약비고: "", 공동인증서: false,
  임대차계약서: false, 신분증: false, 드라이브업로드: false,
  사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slots[0] ?? slot(), 수납2: slots[1] ?? slot(), 수납3: slots[2] ?? slot(),
  로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false,
});
const todo = (name: string, date: string, kind: "todo" | "history"): Todo => ({
  id: `${name}-${date}`, contractRef: `2026-09-04|${name}`, institutionRef: "신보",
  업체명: name, type: "기타", 제목: "연락", 예정일자: date, 예정시각: "09:00",
  장소: "", 상세: "", showOnCalendar: true, 완료여부: false,
  생성시각: "", 분류: "", 기록종류: kind,
});

describe("업체 보기 진행건 목록", () => {
  it("계약(업체)마다 한 항목 — 진행이 여럿이면 works 에 모두, 진행 없는 업체도 한 항목 (belie 2026-09-29)", () => {
    const rows = [
      contract(3, "진행둘", "2026-09-04", [slot({ 진행기관: "신보" }), slot({ 진행기관: "소진공" })]),
      contract(4, "진행없음", "2026-09-05", []),
    ];
    const items = buildCompanyWorkItems(rows, buildInstitutionWorkItems(rows));
    expect(items.map(({ cp, hasProgress, works }) => [cp.업체명, hasProgress, works.map((w) => w.slot)])).toEqual([
      ["진행둘", true, [1, 2]], ["진행없음", false, []],
    ]);
  });

  it("D-day순: 진행 없음 → D-?? → 최근 History → 임박 Todo", () => {
    const rows = [
      contract(3, "오늘할일", "2026-09-04", [slot({ 진행기관: "신보" })]),
      contract(4, "진행없음", "2026-09-04", []),
      contract(5, "날짜없음", "2026-09-04", [slot({ 진행기관: "신보" })]),
      contract(6, "최근한일", "2026-09-04", [slot({ 진행기관: "신보" })]),
      contract(7, "오래된한일", "2026-09-04", [slot({ 진행기관: "신보" })]),
      contract(8, "내일할일", "2026-09-04", [slot({ 진행기관: "신보" })]),
    ];
    const records = [todo("오늘할일", "2026-09-28", "todo"), todo("내일할일", "2026-09-29", "todo"),
      todo("최근한일", "2026-09-28", "history"), todo("오래된한일", "2026-09-26", "history")];
    const items = buildCompanyWorkItems(rows, buildInstitutionWorkItems(rows, "", records, "2026-09-28"));
    expect(sortCompanyWorkItems(items, "dday").map(({ cp, work }) => [cp.업체명, work.activityLabel])).toEqual([
      ["진행없음", "D-??"], ["날짜없음", "D-??"], ["최근한일", "D+00"],
      ["오래된한일", "D+02"], ["오늘할일", "D-00"], ["내일할일", "D-01"],
    ]);
  });

  it("등록 빠른순·늦은순은 계약일로 정렬(업체당 한 항목)", () => {
    const rows = [
      contract(3, "늦게등록", "2026-09-10", [slot({ 진행기관: "신보" }), slot({ 진행기관: "소진공" })]),
      contract(4, "먼저등록", "2026-09-04", [slot({ 진행기관: "신보" })]),
    ];
    const items = buildCompanyWorkItems(rows, buildInstitutionWorkItems(rows));
    expect(sortCompanyWorkItems(items, "date-asc").map((item) => item.cp.업체명)).toEqual(["먼저등록", "늦게등록"]);
    expect(sortCompanyWorkItems(items, "date-desc").map((item) => item.cp.업체명)).toEqual(["늦게등록", "먼저등록"]);
  });
});

// @vitest-environment jsdom
/** SupplierSummary 화면(합성 리드) + page.tsx 연결부 소스 검사. 계산 자체는 db-sheet-supplier-summary.test.ts. */
import { readFileSync } from "node:fs";
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DbSheetLeadInput, type DbSheetFunnelStep, type DbSheetLead } from "@/types/db-sheet";
import { SupplierSummary } from "@/app/(app)/db-sheet/_components/SupplierSummary";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root, host: HTMLDivElement, seq = 0;
function lead(supplier: string, funnel: DbSheetFunnelStep, date = "2026-10-05", channel: "매입DB" | "직접생산" = "매입DB"): DbSheetLead {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return { ...DbSheetLeadInput.parse({ id, supplier, date, channel, company: `가상식품 ${seq}` }), revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null, funnel };
}
const many = (n: number, supplier: string, funnel: DbSheetFunnelStep, channel?: "매입DB" | "직접생산") => Array.from({ length: n }, () => lead(supplier, funnel, undefined, channel));
const leads = [...many(38, "샘플디비A", "유입"), ...many(2, "샘플디비A", "계약"), ...many(28, "메타 광고", "연락", "직접생산"), ...many(2, "메타 광고", "계약", "직접생산"), ...many(3, "", "유입")];
const handlers = { onSelect: vi.fn(), onImport: vi.fn(), onResetRange: vi.fn(), onClose: vi.fn() };
type Props = Parameters<typeof SupplierSummary>[0];
async function render(overrides: Partial<Props> = {}) {
  await act(async () => { root.render(createElement(SupplierSummary, { leads, from: "", to: "", selected: "", loading: false, error: "", ...handlers, ...overrides })); });
}
const table = () => host.querySelector("table")!;
const rowButton = (scope: ParentNode, name: string) => [...scope.querySelectorAll("button")].find(b => b.textContent?.includes(name))!;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("SupplierSummary", () => {
  it("renders the PC table (pc only) and the mobile cards (mobile only) from the same rows", async () => {
    await render();
    expect(host.querySelector("section#db-supplier-summary")?.getAttribute("aria-label")).toBe("공급처별 성과");
    expect(table().parentElement!.className).toMatch(/(^| )hidden( |$)/); expect(table().parentElement!.className).toContain("pc:block");
    expect(host.querySelector("ul")!.className).toContain("pc:hidden");
    const bodyRows = [...table().tBodies[0]!.rows].map(row => row.cells[0]!.textContent);
    expect(bodyRows).toEqual(["매입DB샘플디비A", "직접생산메타 광고", "매입DB공급처 미입력"]);
    expect(table().tFoot!.textContent).toContain("합계");
    expect(host.textContent).toContain("전체 기간 계약률 1위 공급처 ‘메타 광고’ · DB 30건 중 계약 2건");
    expect(host.textContent).toContain("유입일 전체");
  });

  it("selects a supplier through the existing filter, clears it on a second click or on 합계; blank row is not clickable", async () => {
    await render();
    act(() => rowButton(table(), "샘플디비A").click());
    expect(handlers.onSelect).toHaveBeenLastCalledWith("샘플디비A");
    await render({ selected: "샘플디비A" });
    const selectedRow = [...table().tBodies[0]!.rows].find(row => row.dataset.selected)!;
    expect(selectedRow.textContent).toContain("샘플디비A");
    expect(rowButton(table(), "샘플디비A").getAttribute("aria-pressed")).toBe("true");
    act(() => selectedRow.cells[3]!.click()); // 줄 어디를 눌러도 같은 토글
    expect(handlers.onSelect).toHaveBeenLastCalledWith("");
    act(() => rowButton(host.querySelector("ul")!, "메타 광고").click());
    expect(handlers.onSelect).toHaveBeenLastCalledWith("메타 광고");
    act(() => rowButton(table().tFoot!, "합계").click());
    expect(handlers.onSelect).toHaveBeenLastCalledWith("");
    const blank = [...table().tBodies[0]!.rows].find(row => row.textContent?.includes("공급처 미입력"))!;
    expect(blank.querySelector("button")).toBeNull();
    expect(blank.title).toBe("공급처를 적으면 따로 비교할 수 있어요");
    const calls = handlers.onSelect.mock.calls.length;
    act(() => blank.cells[0]!.click());
    expect(handlers.onSelect.mock.calls.length).toBe(calls);
  });

  it("shows the period chip and an empty-range state with a reset", async () => {
    await render({ from: "2026-11-01" });
    expect(host.textContent).toContain("유입일 11/1부터");
    expect(host.textContent).toContain("이 유입 기간에 들어온 DB가 없어요.");
    act(() => rowButton(host, "기간 초기화").click());
    expect(handlers.onResetRange).toHaveBeenCalledOnce();
  });

  it("offers import only when the list really is empty — a failed first load never invites duplicate imports", async () => {
    await render({ leads: [] });
    act(() => rowButton(host, "DB 가져오기").click());
    expect(handlers.onImport).toHaveBeenCalledOnce();
    await render({ leads: [], error: "저장소에 연결하지 못했습니다." });
    expect(host.textContent).toContain("공급처 요약을 불러오지 못했어요. 새로고침해 주세요.");
    expect(rowButton(host, "DB 가져오기")).toBeUndefined();
    await render({ error: "앞선 저장이 실패했습니다." }); // 저장 실패 뒤에도 마지막 숫자는 그대로
    expect(table().tFoot!.textContent).toContain("73");
    await render({ leads: [], loading: true });
    expect(host.textContent).toContain("불러오는 중…");
  });

  it("closes through onClose", async () => {
    await render();
    act(() => rowButton(host, "닫기").click());
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });
});

describe("source guards", () => {
  const component = readFileSync("app/(app)/db-sheet/_components/SupplierSummary.tsx", "utf8");
  const pure = readFileSync("app/(app)/db-sheet/_components/supplier-summary.ts", "utf8");
  const page = readFileSync("app/(app)/db-sheet/page.tsx", "utf8");

  it("uses tokens only and never reaches the repo/service layers", () => {
    for (const source of [component, pure]) {
      expect(source).not.toMatch(/\b[\w:-]+-\[[^\]]+\]/);
      expect(source).not.toMatch(/from ["']@\/(repo|service)/);
    }
  });

  it("puts supplier and visible-field toggles together, starts collapsed, and permits the explicit supplier deep link", () => {
    const tools = page.slice(page.indexOf('className="sheet-table-tools"'));
    expect(tools.indexOf("공급처별 보기")).toBeGreaterThan(-1);
    expect(tools.indexOf("공급처별 보기")).toBeLessThan(tools.indexOf("보여줄 항목"));
    expect(page).toContain('aria-controls="db-supplier-summary"');
    expect(page).toMatch(/params\.get\('view'\)==='suppliers'\)setSummaryOpen\(true\)/);
    expect(page).toContain('[summaryOpen,setSummaryOpen]=useState(false)');
    expect(page).not.toContain('SUMMARY_KEY');
    expect(page).toContain('pageNavigation=');
    expect(page).not.toContain('className="sheet-subnav"');
  });
});

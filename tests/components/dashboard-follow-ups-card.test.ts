// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import DashboardFollowUps from "@/components/dashboard/DashboardFollowUps";
import { LoadingProvider } from "@/components/ui/LoadingProvider";
import { cpKey } from "@/lib/query/contract-payment-hooks";
import { followUpMeetingsKey } from "@/lib/query/follow-up-hooks";
import { dbSheetKey } from "@/lib/query/db-sheet-hooks";
import type { ContractPayment, Meeting, Todo } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";
import { TODAY, contract, lead, meeting, slot, todo } from "./follow-ups-factories";

vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  fetchMock = vi.fn(() => new Promise(() => {})); // 미리 채우지 않은 조회는 끝나지 않는다
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  client.clear();
  vi.unstubAllGlobals();
});

interface Seed { contracts?: ContractPayment[]; todos?: Todo[]; meetings?: Meeting[]; leads?: DbSheetLead[] | null }
function seed({ contracts = [], todos = [], meetings = [], leads = [] }: Seed) {
  client.setQueryData(cpKey(), { rows: contracts });
  client.setQueryData(["todos", "all"], { todos });
  client.setQueryData([...followUpMeetingsKey(), TODAY], { meetings });
  if (leads) client.setQueryData(dbSheetKey(), { leads });
}

function render(tree: React.ReactElement = h(DashboardFollowUps, { todayISO: TODAY })) {
  act(() => root.render(h(QueryClientProvider, { client }, tree)));
}
const card = () => host.querySelector("[data-dashboard-follow-ups]") as HTMLElement;
const labels: Record<string,string> = {overdue:"STEP 4 실무/수납 경과 1건", today:"STEP 4 실무/수납 오늘 1건", meeting:"STEP 3 일정·계약 경과 1건", recontact:"STEP 2 컨택관리 경과 1건", stalled:"STEP 4 실무/수납 장기누락 1건"};
const chip = (kind: string) => host.querySelector(kind === "upcoming" ? ".follow-ups-upcoming" : `[aria-label="${labels[kind]}"]`) as HTMLButtonElement | null;
const links = () => [...document.querySelectorAll("[role=dialog] a")].map((a) => a.getAttribute("href"));

const rich: Seed = {
  contracts: [
    contract({ row: 3, 업체명: "샘플 한빛상사", 계약일: "2026-09-01", 수납1: slot({ 진행기관: "신용보증기금" }) }),
    contract({ row: 5, 업체명: "샘플 푸른제작", 계약일: "2026-10-02" }),
  ],
  todos: [
    todo({ id: "late", contractRef: "2026-09-01|샘플 한빛상사", 업체명: "샘플 한빛상사", institutionRef: "신용보증기금", 예정일자: "2026-10-09" }),
    todo({ id: "now", contractRef: "2026-09-01|샘플 한빛상사", 업체명: "샘플 한빛상사", institutionRef: "신용보증기금", 예정일자: TODAY }),
    todo({ id: "soon", contractRef: "2026-09-01|샘플 한빛상사", 업체명: "샘플 한빛상사", institutionRef: "신용보증기금", 예정일자: "2026-10-14" }),
  ],
  meetings: [meeting({ id: "m1", 미팅날짜: "2026-10-10" })],
  leads: [lead({ id: "l1", next: "2026-10-11" })],
};

describe("DashboardFollowUps 카드", () => {
  it("STEP 4개와 0건을 항상 표시하고 총건수는 미래 제외한다", () => {
    seed(rich);
    render();
    expect(card().textContent).toContain("오늘 챙길 일");
    expect(card().textContent).toContain("5건"); // 밀림1 + 오늘1 + 미팅1 + 재연락1 + 멈춤1(푸른제작 계약 후 10일)
    expect(card().textContent).not.toContain("부터 정리");
    expect(card().querySelectorAll(".ft-summary-row")).toHaveLength(4);
    expect(["overdue", "today", "meeting", "recontact", "stalled", "upcoming"].map((k) => chip(k) !== null)).toEqual([true, true, true, true, true, true]);
    expect(card().textContent).not.toContain("지금 챙길 일이 없습니다.");
  });

  it("칩을 누르면 그 목록만 열리고, 같은 칩·Esc·카드 밖 누름으로 닫힌다. 항목 링크는 정확한 도착 주소다", () => {
    seed(rich);
    render();
    act(() => chip("overdue")!.click());
    expect(chip("overdue")!.getAttribute("aria-expanded")).toBe("true");
    expect(links()).toEqual(["/payment?row=3&slot=1&focus=late"]);
    act(() => chip("overdue")!.click());
    expect(document.querySelector("[role=dialog]")).toBeNull();

    act(() => chip("meeting")!.click());
    expect(links()).toEqual(["/schedule?date=2026-10-10&focus=m1"]);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(document.querySelector("[role=dialog]")).toBeNull();

    act(() => chip("recontact")!.click());
    expect(links()).toEqual(["/db-sheet?lead=l1"]);
    act(() => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(document.querySelector("[role=dialog]")).toBeNull();

    act(() => chip("stalled")!.click());
    expect(links()).toEqual(["/payment?row=5&slot=1"]);
    act(() => (document.querySelector(".ft-action") as HTMLButtonElement).click());
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("진행기관 없음");
  });

  it("모든 조회가 성공했고 챙길 일이 없으면 간결한 빈 상태 — 7일 안 할 일은 보조 칩 하나", () => {
    seed({ contracts: [contract({ 계약일: "2026-10-10", 수납1: slot({진행기관:"기관A"}) })], todos: [todo({ contractRef: "2026-10-10|샘플상사", institutionRef:"기관A", 예정일자: "2026-10-15" })] });
    render();
    expect(card().textContent).toContain("0건");
    expect(chip("upcoming")).not.toBeNull();
    expect(host.querySelectorAll(".ft-summary-row")).toHaveLength(4);
  });

  it("계약을 못 찾은 할 일은 셈에서 빼고 안내 한 줄만 남긴다", () => {
    seed({ contracts: [], todos: [todo({ contractRef: "2026-07-01|샘플 옛이름상사", 예정일자: "2026-10-01" })] });
    render();
    expect(chip("overdue")).toBeNull();
    expect(card().textContent).toContain("업체 연결이 끊긴 할 일 1건");
    expect(card().textContent).toContain("0건");
  });

  it("DB관리시트 조회가 일시 장애로 실패하면 빈 상태 안내 대신 안내와 다시 시도(실패한 조회만 다시 읽음)", async () => {
    const reply = { ok: false, status: 503, json: async () => ({ error: "저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요." }) };
    fetchMock.mockImplementation(async () => reply);
    seed({ leads: null });
    render();
    await act(async () => { await sleep(20); });
    expect(card().textContent).toContain("일부 항목을 불러오지 못했어요");
    expect(card().textContent).not.toContain("지금 챙길 일이 없습니다.");
    const before = fetchMock.mock.calls.length;
    const retry = [...card().querySelectorAll("button")].find((b) => b.textContent === "다시 시도")!;
    await act(async () => { retry.click(); await sleep(20); });
    expect(fetchMock.mock.calls.slice(before).map((c) => String(c[0]))).toEqual(["/api/db-sheet"]);
  });

  it("「이 계정은 DB관리시트를 지원하지 않습니다」 503 이면 DB 칩만 조용히 숨긴다", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({ error: "이 계정은 아직 DB관리시트를 지원하지 않습니다." }) }));
    seed({ leads: null, meetings: [meeting({ id: "m1", 미팅날짜: "2026-10-10" })] });
    render();
    await act(async () => { await sleep(20); });
    expect(card().textContent).not.toContain("불러오지 못했어요");
    expect(chip("recontact")).toBeNull();
    expect(chip("meeting")).not.toBeNull();
  });

  it("불러오는 동안 카드 자리만 잡고(aria-busy) 빈 상태 안내는 보이지 않는다", () => {
    render(); // 아무것도 채우지 않음 — 조회가 끝나지 않는다
    expect(card().getAttribute("aria-busy")).toBe("true");
    expect(card().textContent).not.toContain("없어요");
  });
});

describe("STEP summary detail boundaries", () => {
  it("keeps the open popup inside the viewport when resizing or scrolling its anchor offscreen", () => {
    vi.stubGlobal("innerWidth", 320); vi.stubGlobal("innerHeight", 800);
    let anchorTop = 980;
    const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
      return this.matches("[role=dialog]") ? new DOMRect(0, 0, 296, 520) : new DOMRect(280, anchorTop, 40, 28);
    });
    try {
      seed(rich); render();
      act(() => (host.querySelector(".follow-ups-total") as HTMLButtonElement).click());
      const panel = document.querySelector<HTMLElement>("[role=dialog]")!;
      expect(panel.style.top).toBe("268px");
      expect(panel.style.left).toBe("12px");
      anchorTop = -200;
      act(() => window.dispatchEvent(new Event("scroll")));
      expect(panel.style.top).toBe("12px");
    } finally { bounds.mockRestore(); }
  });
  it("the total opens every urgent item oldest first; future tasks remain separate", () => {
    seed(rich); render();
    act(() => (host.querySelector(".follow-ups-total") as HTMLButtonElement).click());
    expect(document.querySelectorAll(".ft-table tbody > tr")).toHaveLength(5);
    expect(links()[0]).toBe("/payment?row=5&slot=1");
    expect(links()).not.toContain("/payment?row=3&slot=1&focus=soon");
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("샘플 푸른제작");
    act(() => (document.querySelector('[aria-label="목록 닫기"]') as HTMLButtonElement).click());
    expect(document.activeElement).toBe(host.querySelector(".follow-ups-total"));
  });
  it("unknown contact dates have their own count and are never invented as long overdue", () => {
    seed({leads:[lead({next:"",result:"부재"})]}); render();
    expect(card().textContent).toContain("날짜 확인 1");
    expect([...card().querySelectorAll('.ft-count[data-tone="long-overdue"]')].map(node => node.textContent)).toEqual(["0", "0", "0", "0"]);
    act(() => (card().querySelector('[data-tone="unknown"]') as HTMLButtonElement).click());
    act(() => (document.querySelector(".ft-action") as HTMLButtonElement).click());
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("다음 연락일 없음");
  });
  it("complete source failure cannot appear as zero or a completed queue", async () => {
    fetchMock.mockImplementation(async () => ({ok:false,status:503,json:async()=>({error:"합성 실패"})}));
    render(); await act(async()=>{await sleep(80);});
    await act(async()=>{await sleep(40);});
    expect(card().textContent).toContain("불러오지 못했어요");
    expect(card().textContent).not.toContain("0건");
    expect(card().textContent).not.toContain("챙길 일이 없습니다");
  });
});

describe("보조 조회와 전역 로딩 오버레이", () => {
  it("후속 미팅·DB관리시트 조회(meta.background)는 오버레이를 띄우지 않고, 일반 첫 조회는 띄운다", async () => {
    client.setQueryData(cpKey(), { rows: [] });
    client.setQueryData(["todos", "all"], { todos: [] });
    render(h(LoadingProvider, null, h(DashboardFollowUps, { todayISO: TODAY })));
    await act(async () => { await sleep(260); });
    expect(fetchMock).toHaveBeenCalled(); // 보조 조회는 실제로 진행 중
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(card().getAttribute("aria-busy")).toBe("true");

    function Foreground() { useQuery({ queryKey: ["foreground-probe"], queryFn: () => new Promise(() => {}) }); return null; }
    render(h(LoadingProvider, null, h(DashboardFollowUps, { todayISO: TODAY }), h(Foreground)));
    await act(async () => { await sleep(260); });
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });
});

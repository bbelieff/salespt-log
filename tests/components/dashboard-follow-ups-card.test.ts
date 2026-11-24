// @vitest-environment jsdom
/** 대시보드 「오늘 챙길 일」 할 일 구역(2026-11-24 개편) — 실제 조회 훅 + 합성 캐시로 본 상태·필터·예정 창. */
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
  window.localStorage.clear();
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
const rows = () => [...card().querySelectorAll(".tz-row:not(.tz-row-empty)")];
/** 구역 안 줄 목록의 「열기」 도착 주소(위에서부터). */
const links = () => rows().map((r) => r.querySelector("a.tz-go")!.getAttribute("href"));
const chips = () => [...card().querySelectorAll<HTMLButtonElement>(".tz-chip")];
const chip = (label: string) => chips().find((c) => c.textContent!.trim().startsWith(label)) ?? null;
const steps = () => [...card().querySelectorAll<HTMLButtonElement>(".tz-step")];
const upcoming = () => card().querySelector<HTMLButtonElement>("[data-upcoming-trigger]");
const dialogLinks = () => [...document.querySelectorAll("[role=dialog] a")].map((a) => a.getAttribute("href"));
const click = (el: Element | null) => act(() => (el as HTMLElement).click());

/** 7일 넘게 밀림 1(푸른제작 계약 후 10일) · 밀림 3(할 일 3일·미팅 2일·재연락 1일) · 오늘 1 · 예정 1. */
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
const LATE = "/payment?row=3&slot=1&focus=late", NOW = "/payment?row=3&slot=1&focus=now", SOON = "/payment?row=3&slot=1&focus=soon";
const MEETING = "/schedule?date=2026-10-10&focus=m1", LEAD = "/db-sheet?lead=l1", STALLED = "/payment?row=5&slot=1";

describe("DashboardFollowUps 할 일 구역", () => {
  it("누르지 않아도 남은 건수·목표 문장·급한 순서의 줄·칩·단계 3줄이 보인다(예정은 세지 않는다)", () => {
    seed(rich);
    render();
    expect(card().dataset.state).toBe("list");
    expect(card().textContent).toContain("오늘 챙길 일");
    expect(card().querySelector(".tz-count")!.textContent).toBe("5건 남았어요");
    expect(card().querySelector(".tz-hint")!.textContent).toBe("0건이 되면 오늘 챙길 일은 끝입니다. 가장 급한 일이 맨 위에 있어요.");
    expect(links()).toEqual([STALLED, LATE, MEETING, LEAD, NOW]);
    expect(links()).not.toContain(SOON);
    expect(chips().map((c) => c.textContent!.replace(/\s+/g, " ").trim())).toEqual(["전체 5", "7일 넘게 밀림 1", "밀림 3", "오늘 1"]);
    expect(steps().map((s) => s.getAttribute("aria-label"))).toEqual(["STEP 2 DB관리 1건", "STEP 3 일정·계약 1건", "STEP 4 실무/수납 3건"]);
    expect(upcoming()!.textContent).toContain("예정된 일 · 7일 안");
    expect(upcoming()!.textContent).toContain("1건");
    // 승인된 용어 변경 — 옛 이름은 화면에 남지 않는다.
    expect(card().textContent).not.toMatch(/장기누락|경과/);
    // 5건은 PC 6줄 안이라 「모두 보기」는 폰에서만 필요하다.
    expect(card().querySelector(".tz-more")!.getAttribute("data-pc-hidden")).toBe("true");
  });

  it("칩과 단계는 그 자리의 목록을 좁힌다 — 다시 누르면 풀리고, 줄의 「열기」는 정확한 도착 주소다", () => {
    seed(rich);
    render();
    click(chip("밀림"));
    expect(chip("밀림")!.getAttribute("aria-pressed")).toBe("true");
    expect(links()).toEqual([LATE, MEETING, LEAD]);
    click(steps()[1]!); // STEP 3
    expect(steps()[1]!.getAttribute("aria-pressed")).toBe("true");
    expect(links()).toEqual([MEETING]);
    click(steps()[1]!);
    expect(links()).toEqual([LATE, MEETING, LEAD]);
    click(chip("밀림"));
    expect(chip("전체")!.getAttribute("aria-pressed")).toBe("true");
    expect(links()).toHaveLength(5);

    click(chip("7일 넘게 밀림"));
    click(steps()[2]!); // STEP 4
    expect(links()).toEqual([STALLED]);
    click(rows()[0]!.querySelector(".tz-what"));
    expect(rows()[0]!.querySelector(".tz-detail")!.textContent).toContain("진행기관 없음");

    click(steps()[2]!);
    click(steps()[0]!); // STEP 2 에는 7일 넘게 밀린 일이 없다
    expect(rows()).toHaveLength(0);
    expect(card().querySelector(".tz-row-empty")!.textContent).toContain("이 조건에 해당하는 일이 없어요");
  });

  it("맨 윗줄만 주 버튼이다", () => {
    seed(rich);
    render();
    expect(rows().map((r) => r.querySelector("a.tz-go")!.classList.contains("btn-depth-blue"))).toEqual([true, false, false, false, false]);
  });

  it("예정된 일은 따로 — 누르면 목록 창이 열리고 같은 버튼·Esc·바깥 누름으로 닫힌다", () => {
    seed(rich);
    render();
    click(upcoming());
    expect(upcoming()!.getAttribute("aria-expanded")).toBe("true");
    expect(dialogLinks()).toEqual([SOON]);
    click(upcoming());
    expect(document.querySelector("[role=dialog]")).toBeNull();

    click(upcoming());
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.activeElement).toBe(upcoming());

    click(upcoming());
    act(() => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(document.querySelector("[role=dialog]")).toBeNull();

    click(upcoming());
    click(document.querySelector('[aria-label="목록 닫기"]'));
    expect(document.activeElement).toBe(upcoming());
  });

  it("모든 조회가 성공했고 챙길 일이 없으면 한 줄로 접힌다 — 예정된 일 보기는 남는다", () => {
    seed({ contracts: [contract({ 계약일: "2026-10-10", 수납1: slot({ 진행기관: "기관A" }) })], todos: [todo({ contractRef: "2026-10-10|샘플상사", institutionRef: "기관A", 예정일자: "2026-10-15" })] });
    render();
    expect(card().dataset.state).toBe("done");
    expect(card().textContent).toContain("오늘 챙길 일을 모두 끝냈어요");
    expect(card().textContent).toContain("7일 안에 예정된 일이 1건 있어요.");
    expect(card().hasAttribute("data-emphasis")).toBe(false);
    expect(card().querySelector(".tz-list")).toBeNull();
    expect(upcoming()!.textContent).toBe("예정된 일 보기");
    click(upcoming());
    expect(dialogLinks()).toHaveLength(1);
  });

  it("기록이 하나도 없는 계정은 「모두 끝냄」 대신 DB 등록을 안내한다", () => {
    seed({});
    render();
    expect(card().dataset.state).toBe("first");
    expect(card().textContent).toContain("아직 챙길 일이 없어요");
    expect(card().textContent).not.toContain("모두 끝냈어요");
    const link = card().querySelector("a.tz-go")!;
    expect(link.textContent).toBe("DB 등록하기");
    expect(link.getAttribute("href")).toBe("/db-sheet");
  });

  it("계약을 못 찾은 할 일은 셈에서 빼고 안내 한 줄만 남긴다", () => {
    seed({ contracts: [], todos: [todo({ contractRef: "2026-07-01|샘플 옛이름상사", 예정일자: "2026-10-01" })] });
    render();
    expect(rows()).toHaveLength(0);
    expect(card().dataset.state).toBe("done");
    expect(card().textContent).toContain("업체 연결이 끊긴 할 일 1건");
  });

  it("DB관리시트 조회가 일시 장애로 실패하면 완료·0건 대신 확인 필요와 다시 시도(실패한 조회만 다시 읽음)", async () => {
    const reply = { ok: false, status: 503, json: async () => ({ error: "저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요." }) };
    fetchMock.mockImplementation(async () => reply);
    seed({ leads: null });
    render();
    await act(async () => { await sleep(20); });
    expect(card().dataset.state).toBe("unconfirmed");
    expect(card().textContent).toContain("확인 필요");
    expect(card().textContent).toContain("일부 항목을 불러오지 못했어요");
    expect(card().textContent).not.toContain("모두 끝냈어요");
    expect(card().textContent).not.toContain("0건");
    const before = fetchMock.mock.calls.length;
    const retry = [...card().querySelectorAll("button")].find((b) => b.textContent === "다시 시도")!;
    await act(async () => { retry.click(); await sleep(20); });
    expect(fetchMock.mock.calls.slice(before).map((c) => String(c[0]))).toEqual(["/api/db-sheet"]);
  });

  it("일부만 실패하면 확인된 건수로 보이고 확인 못 한 0 은 — 로 둔다", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({ error: "저장소에 연결하지 못했습니다." }) }));
    seed({ ...rich, leads: null });
    render();
    await act(async () => { await sleep(20); });
    expect(card().querySelector(".tz-count")!.textContent).toBe("확인된 4건 남았어요");
    expect(steps()[0]!.getAttribute("aria-label")).toBe("STEP 2 DB관리 확인 필요");
    expect(steps()[0]!.querySelector("strong")!.textContent).toBe("—");
    // 남은 건수가 실제보다 적게 보이는 동안에는 「오늘 N건 처리」를 세지도 적지도 않는다.
    expect(card().querySelector(".tz-done")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("「이 계정은 DB관리시트를 지원하지 않습니다」 503 이면 DB 쪽만 조용히 빠진다", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({ error: "이 계정은 아직 DB관리시트를 지원하지 않습니다." }) }));
    seed({ leads: null, meetings: [meeting({ id: "m1", 미팅날짜: "2026-10-10" })] });
    render();
    await act(async () => { await sleep(20); });
    expect(card().textContent).not.toContain("불러오지 못했어요");
    expect(links()).toEqual([MEETING]);
    expect(steps()[0]!.getAttribute("aria-label")).toBe("STEP 2 DB관리 0건");
  });

  it("불러오는 동안 구역 자리만 잡고(aria-busy) 빈 상태·완료 안내는 보이지 않는다", () => {
    render(); // 아무것도 채우지 않음 — 조회가 끝나지 않는다
    expect(card().getAttribute("aria-busy")).toBe("true");
    expect(card().querySelectorAll(".fx-skeleton").length).toBeGreaterThan(3);
    expect(card().textContent).not.toMatch(/없어요|끝냈어요/);
  });
});

describe("할 일 구역 경계", () => {
  it("keeps the open popup inside the viewport when resizing or scrolling its anchor offscreen", () => {
    vi.stubGlobal("innerWidth", 320); vi.stubGlobal("innerHeight", 800);
    let anchorTop = 980;
    const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
      return this.matches("[role=dialog]") ? new DOMRect(0, 0, 296, 520) : new DOMRect(280, anchorTop, 40, 28);
    });
    try {
      seed(rich); render();
      click(upcoming());
      const panel = document.querySelector<HTMLElement>("[role=dialog]")!;
      expect(panel.style.top).toBe("268px");
      expect(panel.style.left).toBe("12px");
      anchorTop = -200;
      act(() => window.dispatchEvent(new Event("scroll")));
      expect(panel.style.top).toBe("12px");
    } finally { bounds.mockRestore(); }
  });
  it("unknown contact dates have their own chip and are never invented as long overdue", () => {
    seed({ leads: [lead({ next: "", result: "부재" })] }); render();
    expect(chip("날짜 확인")!.textContent).toContain("1");
    expect(chip("7일 넘게 밀림")!.querySelector("b")!.textContent).toBe("0");
    expect(card().hasAttribute("data-emphasis")).toBe(false);
    click(chip("날짜 확인"));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.querySelector(".ft-badge")!.textContent).toBe("날짜 확인");
    click(rows()[0]!.querySelector(".tz-what"));
    expect(rows()[0]!.querySelector(".tz-detail")!.textContent).toContain("다음 연락일 없음");
  });
  it("complete source failure cannot appear as zero or a completed queue", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({ error: "합성 실패" }) }));
    render(); await act(async () => { await sleep(80); });
    await act(async () => { await sleep(40); });
    expect(card().textContent).toContain("불러오지 못했어요");
    expect(card().textContent).toContain("확인 필요");
    expect(card().textContent).not.toContain("0건");
    expect(card().textContent).not.toMatch(/끝냈어요|챙길 일이 없/);
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

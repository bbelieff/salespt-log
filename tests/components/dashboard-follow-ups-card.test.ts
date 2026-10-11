// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import DashboardFollowUps from "@/components/dashboard/DashboardFollowUps";
import { LoadingProvider } from "@/components/ui/LoadingProvider";
import { cpKey } from "@/lib/query/contract-payment-hooks";
import { monthKey } from "@/lib/query/contact-hooks";
import { dbSheetKey } from "@/lib/query/db-sheet-hooks";
import { meetingLookbackMonths } from "@/lib/analytics/dashboard-follow-ups";
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
  for (const m of meetingLookbackMonths(TODAY)) {
    const own = meetings.filter((x) => x.미팅날짜.startsWith(m));
    client.setQueryData(monthKey(m), { yyyyMM: m, daysByMeetingDate: [{ date: `${m}-01`, meetings: own }], daysByTodoDate: [] });
  }
  if (leads) client.setQueryData(dbSheetKey(), { leads });
}

function render(tree: React.ReactElement = h(DashboardFollowUps, { todayISO: TODAY })) {
  act(() => root.render(h(QueryClientProvider, { client }, tree)));
}
const card = () => host.querySelector("[data-dashboard-follow-ups]") as HTMLElement;
const chip = (kind: string) => host.querySelector(`[data-follow-up-chip="${kind}"]`) as HTMLButtonElement | null;
const links = () => [...host.querySelectorAll("[role=region] a")].map((a) => a.getAttribute("href"));

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
  it("건수가 있는 칩만, 총건수(7일 안 제외)와 우선 문구를 보인다", () => {
    seed(rich);
    render();
    expect(card().textContent).toContain("오늘 챙길 일");
    expect(card().textContent).toContain("5건"); // 밀림1 + 오늘1 + 미팅1 + 재연락1 + 멈춤1(푸른제작 계약 후 10일)
    expect(card().textContent).toContain("밀린 할 일 1건부터 정리해요");
    expect(["overdue", "today", "meeting", "recontact", "stalled", "upcoming"].map((k) => chip(k) !== null)).toEqual([true, true, true, true, true, true]);
    expect(card().textContent).not.toContain("오늘 챙길 일이 없어요");
  });

  it("칩을 누르면 그 목록만 열리고, 같은 칩·Esc·카드 밖 누름으로 닫힌다. 항목 링크는 정확한 도착 주소다", () => {
    seed(rich);
    render();
    act(() => chip("overdue")!.click());
    expect(chip("overdue")!.getAttribute("aria-expanded")).toBe("true");
    expect(links()).toEqual(["/payment?row=3&slot=1&focus=late"]);
    act(() => chip("overdue")!.click());
    expect(host.querySelector("[role=region]")).toBeNull();

    act(() => chip("meeting")!.click());
    expect(links()).toEqual(["/schedule?date=2026-10-10&focus=m1"]);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(host.querySelector("[role=region]")).toBeNull();

    act(() => chip("recontact")!.click());
    expect(links()).toEqual(["/db-sheet?lead=l1"]);
    act(() => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(host.querySelector("[role=region]")).toBeNull();

    act(() => chip("stalled")!.click());
    expect(links()).toEqual(["/payment?row=5&slot=1"]);
    expect(host.querySelector("[role=region]")!.textContent).toContain("계약 후 10일");
  });

  it("모든 조회가 성공했고 챙길 일이 없으면 칭찬 한 줄만 — 7일 안 할 일은 보조 칩 하나", () => {
    seed({ contracts: [contract({ 계약일: "2026-10-10" })], todos: [todo({ contractRef: "2026-10-10|샘플상사", 예정일자: "2026-10-15" })] });
    render();
    expect(card().textContent).toContain("오늘 챙길 일이 없어요 👏");
    expect(chip("upcoming")).not.toBeNull();
    expect(host.querySelectorAll("[data-follow-up-chip]")).toHaveLength(1);
  });

  it("계약을 못 찾은 할 일은 셈에서 빼고 안내 한 줄만 남긴다", () => {
    seed({ contracts: [], todos: [todo({ contractRef: "2026-07-01|샘플 옛이름상사", 예정일자: "2026-10-01" })] });
    render();
    expect(chip("overdue")).toBeNull();
    expect(card().textContent).toContain("업체 연결이 끊긴 할 일 1건");
    expect(card().textContent).toContain("오늘 챙길 일이 없어요 👏");
  });

  it("DB관리시트 조회가 일시 장애로 실패하면 칭찬 문구 대신 안내와 다시 시도(실패한 조회만 다시 읽음)", async () => {
    const reply = { ok: false, status: 503, json: async () => ({ error: "저장소에 연결하지 못했습니다. 입력 내용을 유지하고 다시 시도해 주세요." }) };
    fetchMock.mockImplementation(async () => reply);
    seed({ leads: null });
    render();
    await act(async () => { await sleep(20); });
    expect(card().textContent).toContain("일부 항목을 불러오지 못했어요");
    expect(card().textContent).not.toContain("오늘 챙길 일이 없어요");
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

  it("불러오는 동안 카드 자리만 잡고(aria-busy) 칭찬 문구는 보이지 않는다", () => {
    render(); // 아무것도 채우지 않음 — 조회가 끝나지 않는다
    expect(card().getAttribute("aria-busy")).toBe("true");
    expect(card().textContent).not.toContain("없어요");
  });
});

describe("보조 조회와 전역 로딩 오버레이", () => {
  it("월 미팅·DB관리시트 조회(meta.background)는 오버레이를 띄우지 않고, 일반 첫 조회는 띄운다", async () => {
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

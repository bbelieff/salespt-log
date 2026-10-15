// @vitest-environment jsdom

// 2026-10-12 #7 — DashboardFinance 영업이익 상세의 채널 표: 기간 칩마다 합계 = 영업이익 칸,
// contractChannels 없으면 표 없음, 응답에 없는 계약은 「확인 중」 + 다시 불러오기 1회.
import * as React from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardContractChannel } from "@/types";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));

const slot = (수납액 = 0, 수납일 = "") => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액, 수납일, 메모: "" });
const contract = (row: number, 업체명: string, 계약일: string, 수임비: number, over: Record<string, unknown> = {}) =>
  ({ row, 계약일, 업체명, 수임비, 수납1: slot(), 수납2: slot(), 수납3: slot(), 반환액: 0, 해지일: "", linkedMeetingId: "", ...over });

const state = vi.hoisted(() => ({ extraRow: false }));
const ROWS = [
  contract(3, "가상상사A", "2026-10-13", 3_000_000, { linkedMeetingId: "m-a", 수납1: slot(2_000_000, "2026-10-14") }),
  contract(4, "가상상사B", "2026-09-25", 1_000_000, { linkedMeetingId: "m-b" }),
  contract(5, "가상상사C", "2026-10-05", 2_000_000, { linkedMeetingId: "manual:req-1" }),
  contract(6, "가상상사D", "2026-08-20", 400_000, { 반환액: 400_000, 해지일: "2026-10-14" }),
];
vi.mock("@/query/contract-payment-hooks", () => ({
  useContractPayments: () => ({
    data: { rows: state.extraRow ? [...ROWS, contract(7, "가상상사E", "2026-10-15", 700_000, { linkedMeetingId: "m-e" })] : ROWS },
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/query/db-hooks", () => ({
  useDBOverview: () => ({
    data: { purchases: [{ 구매일: "2026-10-06", 주문금액: 900_000 }], productions: [], banners: [{ 날짜: "2026-09-26", 주문금액: 1_000_000 }] },
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/query/expense-ledger-hooks", () => ({
  useExpenseLedger: () => ({
    data: { entries: [{ source: "recurring", amountWon: 100_000, periodStart: "2026-10-13", periodEnd: "2026-10-13" }] },
    isLoading: false,
    isError: false,
  }),
}));

let DashboardFinance: typeof import("@/components/dashboard/DashboardFinance").default;

const CHANNELS: DashboardContractChannel[] = [
  { key: "3|ak:m-a", channel: "현수막" },
  { key: "4|ak:m-b", channel: "매입DB" },
  { key: "5|ak:manual:req-1", channel: null },
  { key: "6|2026-08-20|가상상사D", channel: null },
];

let root: Root | undefined;
let container: HTMLDivElement | undefined;
type Props = React.ComponentProps<typeof DashboardFinance>;
function render(props: Partial<Props> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(createElement(DashboardFinance, { onOpenExpenseLedger: () => {}, ...props })));
  return container;
}
const rerender = (props: Partial<Props>) => act(() => root?.render(createElement(DashboardFinance, { onOpenExpenseLedger: () => {}, ...props })));
const chip = (label: string) => {
  const el = [...(container?.querySelectorAll("button[aria-pressed]") ?? [])].find((b) => b.textContent === label);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`chip '${label}' is missing`);
  return el;
};
/** 「₩-1,234」·「−₩1,234」 → -1234 */
const won = (text: string | null | undefined) => {
  const t = text ?? "";
  const n = Number(t.replace(/[^\d]/g, ""));
  return /[-−]/.test(t) ? -n : n;
};
/** 영업이익 칸의 최종 금액(움직이는 동안에도 겹쳐 둔 최종값). */
const profitBox = () => {
  const el = container?.querySelector("#fin-col-profit [data-profit-sign]");
  return won(el?.querySelector(".invisible")?.textContent ?? el?.textContent);
};
const totalCells = () => [...(container?.querySelectorAll('[data-row="total"] td .sr-only') ?? [])].map((s) => won(s.textContent));

beforeEach(async () => {
  // 탭 단위 모듈 가드는 시험마다 새로 시작하되 한 시험 안의 재마운트에는 유지한다.
  vi.resetModules();
  DashboardFinance = (await import("@/components/dashboard/DashboardFinance")).default;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T03:00:00Z")); // KST 10/15(목) — 이번 주 10/12~10/18
});
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  state.extraRow = false;
  vi.useRealTimers();
});

describe("DashboardFinance — 영업이익 상세 채널 표", () => {
  it("기간 칩을 바꿀 때마다 표 합계 남은 돈 = 영업이익 칸(원 단위)", () => {
    render({ contractChannels: CHANNELS });
    act(() => container?.querySelector<HTMLButtonElement>("#fin-col-profit")?.click());
    const expected: Record<string, number> = {
      // 전체: 매출 3.0+2.0+1.0+2.0+0.4−0.4 = 8.0M, 비용 0.9+1.0+0.1 = 2.0M
      "전체": 6_000_000,
      // 이번 달: 매출 3.0+2.0+2.0−0.4 = 6.6M, 비용 0.9+0.1 = 1.0M
      "이번 달": 5_600_000,
      // 이번 주: 매출 3.0+2.0−0.4 = 4.6M, 비용 0.1M
      "이번 주": 4_500_000,
    };
    for (const label of ["전체", "이번 달", "이번 주"]) {
      act(() => chip(label).click());
      expect(container?.querySelector('[data-testid="fin-channel-profit"]')).not.toBeNull();
      const [revenue, cost, left] = totalCells();
      expect(left).toBe(expected[label]);
      expect(left).toBe(revenue! - cost!);
      expect(profitBox()).toBe(left);
    }
  });

  it("contractChannels 가 없으면(옛 응답) 표·문장 없이 기존 줄만", () => {
    render();
    act(() => container?.querySelector<HTMLButtonElement>("#fin-col-profit")?.click());
    const panel = container?.querySelector("#fin-detail-panel");
    expect(panel?.textContent).toContain("계약 4건");
    expect(panel?.querySelector('[data-testid="fin-channel-profit"]')).toBeNull();
    expect(panel?.textContent).not.toContain("쓴 돈");
  });

  it("응답에 없는 계약은 「확인 중」, 같은 어긋남엔 다시 불러오기 1번만", () => {
    state.extraRow = true;
    const onRefreshChannels = vi.fn();
    render({ contractChannels: CHANNELS, onRefreshChannels, channelsRefreshing: true });
    expect(onRefreshChannels).toHaveBeenCalledTimes(1);
    act(() => container?.querySelector<HTMLButtonElement>("#fin-col-profit")?.click());
    expect(container?.querySelector('[data-row="pending"]')?.textContent).toContain("확인 중…");
    // 다시 받은 응답도 그 계약이 없으면(새 배열·같은 키) 또 부르지 않는다 — 대시보드 GET 은 쓰기를 포함한다.
    rerender({ contractChannels: [...CHANNELS], onRefreshChannels, channelsRefreshing: false });
    expect(onRefreshChannels).toHaveBeenCalledTimes(1);
    expect(container?.querySelector('[data-row="pending"]')?.textContent).toContain("확인 못 함");
    // 화면 이동 뒤 다시 마운트해도 탭 단위 가드가 유지된다.
    act(() => root?.unmount());
    container?.remove();
    render({ contractChannels: [...CHANNELS], onRefreshChannels });
    expect(onRefreshChannels).toHaveBeenCalledTimes(1);
    act(() => container?.querySelector<HTMLButtonElement>("#fin-col-profit")?.click());
    expect(container?.querySelector('[data-row="pending"]')?.textContent).toContain("확인 못 함");
    // 받아 오면 제 채널로.
    rerender({ contractChannels: [...CHANNELS, { key: "7|ak:m-e", channel: "매입DB" }], onRefreshChannels });
    expect(container?.querySelector('[data-row="pending"]')).toBeNull();
    expect(onRefreshChannels).toHaveBeenCalledTimes(1);
  });
});

describe("비용 원장 창 요약 = 비용 칸과 같은 기간·같은 숫자 (화석 B5, 2026-10-15)", () => {
  it("기간을 바꾸면 원장 요약 값도 그 기간으로 따라간다", () => {
    const onPeriodTotals = vi.fn();
    render({ contractChannels: CHANNELS, onPeriodTotals });
    const last = () => onPeriodTotals.mock.calls.at(-1)?.[0] as { dbCost: number; additional: number | null; label: string };
    expect(last().dbCost).toBe(1_900_000); // 전체: 매입 90만 + 현수막 100만
    expect(last().additional).toBe(100_000);
    act(() => chip("이번 주").click());
    expect(last().dbCost).toBe(0); // 이번 주(10/12~18)엔 DB 비용 없음
    expect(last().label).toMatch(/^이번 주/);
  });
});

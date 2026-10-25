// @vitest-environment jsdom
/** 오늘 챙길 일 창 「챙길 일 | 새 공고」(2026-10-26 맞춤공고 4d). 합성 데이터만. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUpsLauncherView from "@/components/dashboard/FollowUpsLauncherView";
import { grantInbox, type GrantMatchesResponse } from "@/lib/analytics/grant-match";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const ann = (id: string, lastSeen: string) => ({ id, title: `가상 공고 ${id}`, agency: "", regionText: "", maxAmount: "", deadlineText: "", deadlineDate: "", link: "", lastSeen });
const res: GrantMatchesResponse = { unavailable: false, announcements: { A: ann("A", "2026-10-22"), B: ann("B", "2026-10-23"), C: ann("C", "2026-10-23") }, companies: {
  "2026-10-01|가상정밀": { hasInfo: true, noRegion: false, matches: [{ id: "A", verdict: "check", reasons: ["x"], urgent: false }, { id: "B", verdict: "match", reasons: [], urgent: false }] },
  "2026-10-02|예시상사": { hasInfo: true, noRegion: false, matches: [{ id: "C", verdict: "match", reasons: [], urgent: true }] },
} };

describe("grantInbox", () => {
  it("업체 × 공고, 급함 → 맞음 → 확인 순", () => {
    expect(grantInbox(res).map((g) => `${g.company}:${g.id}`)).toEqual(["예시상사:C", "가상정밀:B", "가상정밀:A"]);
    expect(grantInbox({ ...res, unavailable: true })).toEqual([]);
  });
});

let root: Root, host: HTMLDivElement;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("챙길 일 | 새 공고 칸", () => {
  const items = grantInbox(res).map((g) => ({ ...g, href: "/payment?row=3" }));
  it("두 칸 숫자, 새 공고 칸을 누르면 공고 줄", () => {
    act(() => root.render(React.createElement(FollowUpsLauncherView, { items: [], grantItems: items })));
    const tabs = [...host.querySelectorAll<HTMLButtonElement>(".fl-tabs button")];
    expect(tabs.map((b) => b.textContent)).toEqual(["챙길 일 0", "새 공고 3"]);
    expect(tabs[0]!.getAttribute("aria-pressed")).toBe("true");
    act(() => tabs[1]!.click());
    const rows = [...host.querySelectorAll(".fl-item")];
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain("소진");
    expect(rows[0]!.querySelector("a")?.getAttribute("href")).toBe("/payment?row=3");
    expect(host.querySelector<HTMLButtonElement>(".fl-fab")!.getAttribute("aria-label")).toContain("0건");
  });
  it("맞춤공고를 못 읽으면 칸 없이 예전 머리", () => {
    act(() => root.render(React.createElement(FollowUpsLauncherView, { items: [] })));
    expect(host.querySelector(".fl-tabs")).toBeNull();
    expect(host.querySelector(".fl-head h2")?.textContent).toContain("오늘 챙길 일");
  });
});

// @vitest-environment jsdom
/** 할 일 줄을 펼친 상세 — 「이 일이 뜬 이유」와 「정보」 두 묶음, 같은 말은 한 번만(belie 2026-11-25). 합성 항목만 쓴다. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import FollowUpRow, { followUpDetailNotes } from "@/components/dashboard/FollowUpRow";
import type { FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const stalled: FollowUpItem = {
  key: "stalled:1:1", kind: "overdue", step: "4", group: "long-overdue", title: "샘플 상사", company: "샘플 상사",
  detail: "진행 1 · 기관 미정 · 진행기관 없음 · 다음 할 일 없음 · 7일 이상 진행 정체", badge: "D+07", href: "/payment?row=3&slot=1",
  dueISO: "2026-09-01", overdueDays: 7, action: "진행기관과 다음 할 일 확인",
  reasons: ["진행기관 없음", "다음 할 일 없음", "7일 이상 진행 정체"],
  facts: [{ label: "진행", value: "1" }, { label: "기관", value: "미정" }, { label: "계약일", value: "2026-09-01" }],
};

let root: Root | undefined, host: HTMLElement | undefined;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });
function render(item: FollowUpItem) {
  host = document.createElement("ul"); document.body.append(host); root = createRoot(host);
  act(() => root!.render(React.createElement(FollowUpRow, { item, primary: false, expanded: true, onToggle: () => {} })));
  return host.querySelector(".tz-detail")!;
}

describe("followUpDetailNotes", () => {
  it("이유·정보 칸과 겹치는 조각은 모두 빠진다", () => {
    expect(followUpDetailNotes(stalled)).toEqual([]);
  });
  it("다른 데 없는 조각(상품·채널·장소)만 남는다", () => {
    expect(followUpDetailNotes({ ...stalled, detail: "진행 1 · 기관 미정 · 가상 상품 · 진행기관 없음" })).toEqual(["가상 상품"]);
    expect(followUpDetailNotes({ ...stalled, action: "미팅 준비", reasons: ["미팅 예정"], detail: "2026-09-01 · 14:00 · 가상 회의실",
      facts: [{ label: "미팅일", value: "2026-09-01" }, { label: "시간", value: "14:00" }] })).toEqual(["가상 회의실"]);
  });
});

describe("FollowUpRow 펼친 상세", () => {
  it("이유는 한 줄에 하나씩, 정보는 이름표와 값으로 나뉘고 같은 말이 되풀이되지 않는다", () => {
    const detail = render(stalled);
    expect([...detail.querySelectorAll(".tz-detail-why li")].map(li => li.textContent)).toEqual(stalled.reasons);
    expect([...detail.querySelectorAll(".tz-detail-info dt")].map(dt => dt.textContent)).toEqual(["기준일", "진행", "기관", "계약일"]);
    expect(detail.querySelector(".tz-detail-note")).toBeNull();
    expect(detail.textContent!.split("진행기관 없음")).toHaveLength(2);
  });
  it("남는 조각이 있으면 정보 아래 한 줄로 보인다", () => {
    expect(render({ ...stalled, detail: "진행 1 · 가상 상품" }).querySelector(".tz-detail-note")!.textContent).toBe("가상 상품");
  });
});

describe("「예정된 일」 창의 펼친 줄", () => {
  it("할 일 줄과 같은 두 묶음을 쓰고, 표에서 잘리는 업체·할 일을 정보 맨 앞에 다시 보인다", async () => {
    const { default: FollowUpsDetailPanel } = await import("@/components/dashboard/FollowUpsDetailPanel");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(React.createElement(FollowUpsDetailPanel, { id: "p", items: [{ ...stalled, kind: "upcoming", group: "upcoming" } as FollowUpItem], incomplete: false,
      panelRef: { current: null }, position: {}, onClose: () => {}, onPointerEnter: () => {}, onPointerLeave: () => {} })));
    const panel = document.querySelector<HTMLElement>("[role=dialog]")!;
    act(() => panel.querySelector<HTMLButtonElement>(".ft-action")!.click());
    const detail = panel.querySelector(".ft-expanded .tz-detail")!;
    expect([...detail.querySelectorAll(".tz-detail-why li")].map(li => li.textContent)).toEqual(stalled.reasons);
    expect([...detail.querySelectorAll("dt")].map(dt => dt.textContent)).toEqual(["업체", "해야 할 일", "기준일", "진행", "기관", "계약일"]);
    expect(detail.textContent!.split("진행기관 없음")).toHaveLength(2);
  });
});

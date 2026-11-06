// @vitest-environment jsdom
/** 「정리 기다리는 통화 N건」(2026-11-07 belie 모바일 기획 2판 ③) — 할 일이 남은 통화만 세고, 0건이면 줄이 없다. 가상 업체만. */
import React, { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { useCallUi } from "@/app/(app)/db-sheet/_components/CallUi";
import type { DbSheetLead } from "@/types/db-sheet";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const lead = (n: number, company: string) => ({ ...blank(), id: `00000000-0000-4000-8000-00000000004${n}`, company, phone: `010-0000-404${n}` });
const rows = [lead(1, "가상하나"), lead(2, "가상두울"), lead(3, "가상세엣"), lead(4, "가상네엣")];

function Harness() {
  const ui = useCallUi(rows as unknown as DbSheetLead[], () => {});
  const [on, setOn] = useState(false);
  const shown = on ? rows.filter(r => ui.pending.includes(r.id)) : rows;
  return h("div", null, ui.strip(on, () => setOn(!on)), h("ul", null, shown.map(r => h("li", { key: r.id }, r.company))));
}

let active: { id: string; leadId: string; status: string }[] = [];
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ calls: active }))));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const flush = () => act(async () => { for (let t = 0; t < 5; t++) { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 0)); } });
const strip = () => host.querySelector<HTMLButtonElement>(".dbs-pending-strip");
const names = () => [...host.querySelectorAll("li")].map(li => li.textContent);

it("녹음 필요·정리 실패·확인 필요만 세고(정리 중은 제외), 누르면 그 업체만 → 다시 누르면 전체", async () => {
  active = [
    { id: "c1", leadId: rows[0]!.id, status: "dialed" },
    { id: "c2", leadId: rows[1]!.id, status: "review" },
    { id: "c3", leadId: rows[2]!.id, status: "processing" },
    { id: "c4", leadId: rows[3]!.id, status: "failed" },
  ];
  await act(async () => root.render(h(Harness)));
  await flush();
  expect(strip()!.textContent).toContain("정리 기다리는 통화 3건");
  expect(names()).toHaveLength(4);
  await act(async () => strip()!.click());
  expect(strip()!.getAttribute("aria-pressed")).toBe("true");
  expect(names()).toEqual(["가상하나", "가상두울", "가상네엣"]);
  await act(async () => strip()!.click());
  expect(names()).toHaveLength(4);
});

it("기다리는 통화가 없으면 줄 자체가 없다", async () => {
  active = [{ id: "c3", leadId: rows[2]!.id, status: "processing" }];
  await act(async () => root.render(h(Harness)));
  await flush();
  expect(strip()).toBeNull();
});

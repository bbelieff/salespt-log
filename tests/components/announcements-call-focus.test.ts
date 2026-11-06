// @vitest-environment jsdom
/** 통화 중 새소식 미루기(2026-11-07 belie 모바일 기획 2판 PR4) — 통화 창이 열려 있으면 미뤘다가 닫히면 뜬다. */
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/query/announcements-hook", () => ({
  useAnnouncements: () => ({ data: { notices: [], updates: [], latestPr: 9 } }),
}));
vi.mock("@/components/announcements/NoticePopup", () => ({
  default: () => h("div", { "data-testid": "notice-popup" }, "새소식"),
}));

import AnnouncementsGate from "@/components/announcements/AnnouncementsGate";
import { holdCallFocus } from "@/components/announcements/call-focus";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); localStorage.clear(); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const popup = () => host.querySelector('[data-testid="notice-popup"]');

it("통화 창이 없으면 바로 뜬다", async () => {
  await act(async () => root.render(h(AnnouncementsGate)));
  expect(popup()).not.toBeNull();
});

it("통화 창이 열려 있으면 미뤘다가, 모두 닫히면 뜬다", async () => {
  const releaseA = holdCallFocus();
  const releaseB = holdCallFocus();
  await act(async () => root.render(h(AnnouncementsGate)));
  expect(popup()).toBeNull();
  await act(async () => releaseA());
  expect(popup()).toBeNull();
  await act(async () => { releaseB(); releaseB(); });
  expect(popup()).not.toBeNull();
});

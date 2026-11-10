// @vitest-environment jsdom
/** 잘못된 트레이너 초대 링크: 안내 + 「처음 화면으로」 버튼(2026-11-10 UI 점검). 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => h("a", { ...p, href }, children) }));
vi.mock("@/components/auth/LoginScene", () => ({ default: () => null }));
vi.mock("@/components/auth/TrainerApplication", () => ({ default: () => null }));
import TrainerInvitationEntry from "@/components/auth/TrainerInvitationEntry";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

it("★잘못된 링크면 처음 화면으로 가는 버튼이 있다", async () => {
  window.history.replaceState(null, "", "/trainer/invite#bad");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(h(TrainerInvitationEntry, { signedIn: false })));
  expect(host.textContent).toContain("올바르지 않은 초대 링크입니다");
  const link = [...host.querySelectorAll("a")].find((a) => a.textContent === "처음 화면으로");
  expect(link?.getAttribute("href")).toBe("/");
});

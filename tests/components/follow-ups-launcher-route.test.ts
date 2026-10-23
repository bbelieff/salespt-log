// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FollowUpsLauncher from "@/components/dashboard/FollowUpsLauncher";
const path = vi.hoisted(() => ({ current: "/payment" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => React.createElement("a", props) }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root, host: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});
afterEach(() => { act(() => root.unmount()); host.remove(); client.clear(); vi.unstubAllGlobals(); });
const render = () => act(() => root.render(React.createElement(QueryClientProvider, { client }, React.createElement(FollowUpsLauncher))));

describe("좌하단 빠른 보기 노출 화면 (belie 2026-10-23: 대시보드 제외)", () => {
  it.each(["/dashboard", "/"])("%s 에서는 그리지 않는다", (p) => {
    path.current = p;
    render();
    expect(host.querySelector(".fl-fab")).toBeNull();
  });
  it.each(["/payment", "/contact", "/schedule", "/db-sheet", "/calendar"])("%s 에서는 버튼을 그린다", (p) => {
    path.current = p;
    render();
    expect(host.querySelector(".fl-fab")).not.toBeNull();
  });
});

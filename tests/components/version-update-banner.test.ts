// @vitest-environment jsdom
/** 새 버전 알림 — 서버 버전이 화면 버전과 다를 때만 아래 가운데 알림, 닫으면 그 버전은 이 탭에서 다시 안 묻는다. */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "2026.10.26-1000");
const { default: VersionUpdateBanner, isNewVersion } = await import("@/components/app-version/VersionUpdateBanner");

let root: Root;
let host: HTMLDivElement;
let server = "2026.10.26-1000";
const fetchMock = vi.fn(async () => new Response(JSON.stringify({ version: server }), { status: 200 }));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); fetchMock.mockClear(); });

const focusAndWait = async () => { await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise(r => setTimeout(r, 0)); }); };

describe("isNewVersion", () => {
  it("둘 다 있고 다를 때만 새 버전", () => {
    expect(isNewVersion("a", "b")).toBe(true);
    expect(isNewVersion("a", "a")).toBe(false);
    expect(isNewVersion("", "b")).toBe(false);
    expect(isNewVersion("a", "")).toBe(false);
  });
});

describe("VersionUpdateBanner", () => {
  it("같은 버전이면 아무것도 안 띄운다", async () => {
    server = "2026.10.26-1000";
    act(() => root.render(createElement(VersionUpdateBanner, { enabled: true })));
    await focusAndWait();
    expect(fetchMock).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
    expect(host.querySelector(".vu-banner")).toBeNull();
  });
  it("배포 뒤 버전이 바뀌면 버전명과 새로고침을 띄우고, 닫으면 같은 버전은 다시 안 묻는다", async () => {
    server = "2026.10.26-1405";
    act(() => root.render(createElement(VersionUpdateBanner, { enabled: true })));
    await focusAndWait();
    const banner = host.querySelector(".vu-banner");
    expect(banner?.textContent).toContain("새 버전이 나왔어요");
    expect(banner?.textContent).toContain("2026.10.26-1405");
    expect(banner?.querySelector(".vu-reload")?.textContent).toContain("새로고침");
    act(() => (host.querySelector(".vu-close") as HTMLButtonElement).click());
    expect(host.querySelector(".vu-banner")).toBeNull();
    await focusAndWait();
    expect(host.querySelector(".vu-banner")).toBeNull();
  });
  it("꺼져 있으면(개발 화면) 확인하지 않는다", async () => {
    act(() => root.render(createElement(VersionUpdateBanner, { enabled: false })));
    await focusAndWait();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

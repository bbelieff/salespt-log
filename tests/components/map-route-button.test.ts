// @vitest-environment jsdom
/** 🧭 길찾기 버튼(2026-11-07 belie) — 처음엔 세 지도 고르기, 「다음에도 이 앱으로」면 바로 열기, 검색어 없으면 없음. 가상 주소만. */
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MapRouteButton from "@/app/(app)/schedule/_components/MapRouteButton";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const opened: string[] = [];
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  localStorage.clear(); opened.length = 0;
  vi.spyOn(window, "location", "get").mockReturnValue({ hostname: "salesptlog.online", set href(v: string) { opened.push(v); } } as unknown as Location);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14; SM-S921N)");
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const button = (text: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.includes(text));
const ADDR = "경기 성남시 분당구 가상로 12";

it("처음 누르면 카카오맵·네이버지도·티맵을 고르고, 고른 앱이 주소 검색으로 열린다 → 다음엔 바로", async () => {
  await act(async () => root.render(h(MapRouteButton, { place: "대표님 사무실", address: ADDR })));
  expect(host.textContent).toContain(ADDR);
  await act(async () => button("길찾기")!.click());
  expect([...host.querySelectorAll('[aria-label="지도 앱"] button')].map(b => b.textContent)).toEqual(["카카오맵", "네이버지도", "티맵"]);
  await act(async () => button("티맵")!.click());
  expect(opened[0]).toContain("intent://search?name=" + encodeURIComponent(ADDR));
  expect(opened[0]).toContain("package=com.skt.tmap.ku");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => button("길찾기")!.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(opened).toHaveLength(2);
  expect(button("지도 바꾸기")).toBeTruthy();
});

it("「다음에도 이 앱으로」를 끄면 기억하지 않는다", async () => {
  await act(async () => root.render(h(MapRouteButton, { place: ADDR })));
  await act(async () => button("길찾기")!.click());
  await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  await act(async () => button("카카오맵")!.click());
  expect(opened[0]).toContain("package=net.daum.android.map");
  expect(localStorage.getItem("map-route-app")).toBeNull();
});

it("장소도 소재지도 없으면 버튼이 없다", async () => {
  await act(async () => root.render(h(MapRouteButton, { place: "", address: "" })));
  expect(button("길찾기")).toBeUndefined();
});

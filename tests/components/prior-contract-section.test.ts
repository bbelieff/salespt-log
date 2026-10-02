// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import PriorContractSection from "@/app/(app)/payment/_components/PriorContractSection";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("PriorContractSection policy-news entrypoint", () => {
  it("keeps the mobile entrypoint in-app while the native viewer reads public latest-news", () => {
    act(() => root.render(React.createElement(PriorContractSection)));
    const quickLink = [...host.querySelectorAll("a")].find((link) => link.textContent?.includes("정책자금 뉴스"));
    expect(quickLink?.getAttribute("href")).toBe("/payment/news");
    expect(quickLink?.getAttribute("target")).toBeNull();
    const page = readFileSync("app/(app)/payment/news/page.tsx", "utf8");
    expect(page).toContain("POLICY_NEWS_URL");
    expect(page).toContain("loadPolicyNews");
    expect(page).not.toContain("<iframe");
  });
});

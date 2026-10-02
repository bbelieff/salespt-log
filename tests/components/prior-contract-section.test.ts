// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PriorContractSection from "@/app/(app)/payment/_components/PriorContractSection";
import PolicyNewsEmbed from "@/app/(app)/payment/news/PolicyNewsEmbed";
import { POLICY_NEWS_URL } from "@/config/links";

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
  it("keeps the mobile entrypoint in-app while the iframe source remains public latest-news", () => {
    act(() => root.render(React.createElement(PriorContractSection)));
    const quickLink = [...host.querySelectorAll("a")].find((link) => link.textContent?.includes("정책자금 뉴스"));
    expect(quickLink?.getAttribute("href")).toBe("/payment/news");
    expect(quickLink?.getAttribute("target")).toBeNull();

    act(() => root.render(React.createElement(PolicyNewsEmbed, { src: POLICY_NEWS_URL })));
    expect(host.querySelector("iframe")?.getAttribute("src")).toBe("https://salesptlog.online/news/latest");
  });
});

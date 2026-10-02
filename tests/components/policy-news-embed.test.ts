// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import PolicyNewsEmbed, { isLoadedPolicyNewsDocument, POLICY_NEWS_LOAD_TIMEOUT_MS } from "@/app/(app)/payment/news/PolicyNewsEmbed";
import PolicyNewsPage from "@/app/(app)/payment/news/page";
import { POLICY_NEWS_URL } from "@/config/links";

vi.mock("@/components/TopHeader", () => ({ default: () => null }));
vi.mock("@/components/PageContainer", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

describe("PolicyNewsEmbed", () => {
  it("allows only the exact live same-origin latest-news source with no script capability", () => {
    render(React.createElement(PolicyNewsEmbed, { src: POLICY_NEWS_URL }));
    const frame = host.querySelector("iframe")!;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute("src")).toBe(POLICY_NEWS_URL);
    expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(frame.getAttribute("title")).toContain("실제 뉴스");
  });

  it("rejects a non-allowlisted source without rendering an iframe", () => {
    render(React.createElement(PolicyNewsEmbed, { src: "https://example.invalid/news/latest" }));
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.textContent).toContain("허용된 정책자금 뉴스 원문");
  });

  it("rejects query, fragment, credentials, alternate-port, and path mutations of the public source", () => {
    const credentialVariant = new URL(POLICY_NEWS_URL);
    credentialVariant.username = "u";
    credentialVariant.password = "p";
    const variants = [
      `${POLICY_NEWS_URL}?preview=1`,
      `${POLICY_NEWS_URL}#latest`,
      credentialVariant.href,
      "https://salesptlog.online:444/news/latest",
      "https://salesptlog.online/news/latest/",
    ];

    for (const src of variants) {
      render(React.createElement(PolicyNewsEmbed, { src }));
      expect(host.querySelector("iframe"), src).toBeNull();
      expect(host.textContent).toContain("허용된 정책자금 뉴스 원문");
    }
  });

  it("accepts only a loaded document with actual news title, date, list and body", () => {
    const news = document.implementation.createHTMLDocument("정책자금 데일리");
    news.body.innerHTML = '<main><h1>정책자금 데일리</h1><h2>성격별 건수</h2><time>2026-10-02</time><article data-cat="loan"><a href="https://news.example.invalid/item">정책자금 지원 공고</a> 본문입니다. 접수 일정과 대상 조건을 확인하세요.</article></main>';
    expect(isLoadedPolicyNewsDocument(news)).toBe(true);

    const blank = document.implementation.createHTMLDocument("정책자금 데일리");
    blank.body.innerHTML = "<main>2026-10-02</main>";
    expect(isLoadedPolicyNewsDocument(blank)).toBe(false);
  });

  it("shows fallback and reloads a fresh frame after the bounded load timeout", () => {
    render(React.createElement(PolicyNewsEmbed, { src: POLICY_NEWS_URL }));
    const first = host.querySelector("iframe")!;
    act(() => vi.advanceTimersByTime(POLICY_NEWS_LOAD_TIMEOUT_MS));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("불러오지 못했어요");
    expect(host.querySelector('a[target="_blank"]')?.getAttribute("rel")).toBe("noopener noreferrer");
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.querySelector("iframe")).not.toBe(first);
  });

  it("keeps the app page header context and replaces the external-only placeholder", () => {
    render(React.createElement(PolicyNewsPage));
    expect(host.querySelector("iframe")?.getAttribute("src")).toBe(POLICY_NEWS_URL);
    const page = fs.readFileSync(path.join(process.cwd(), "app/(app)/payment/news/page.tsx"), "utf8");
    expect(page).toContain('<TopHeader');
    expect(page).toContain('pageTitle="정책자금 데일리"');
    expect(page).not.toContain("아직 새 창에서 열립니다");
  });
});

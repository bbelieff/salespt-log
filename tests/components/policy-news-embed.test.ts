// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import PolicyNewsEmbed, {
  POLICY_NEWS_LOAD_TIMEOUT_MS,
  POLICY_NEWS_SANDBOX,
} from "@/app/(app)/payment/news/PolicyNewsEmbed";
import { POLICY_NEWS_URL } from "@/config/links";

vi.mock("@/components/TopHeader", () => ({ default: () => null }));
vi.mock("@/components/PageContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

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

function render(src = POLICY_NEWS_URL) {
  act(() => root.render(React.createElement(PolicyNewsEmbed, { src })));
}

describe("PolicyNewsEmbed 최소 권한", () => {
  it("정확한 latest URL만 opaque-origin 최소 기능 sandbox로 연다", () => {
    render();
    const frame = host.querySelector("iframe")!;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute("src")).toBe(POLICY_NEWS_URL);
    expect(POLICY_NEWS_SANDBOX).toBe("allow-scripts allow-popups");
    expect(frame.getAttribute("sandbox")).toBe(POLICY_NEWS_SANDBOX);
    expect(new Set(frame.getAttribute("sandbox")!.split(/\s+/))).toEqual(
      new Set(["allow-scripts", "allow-popups"]),
    );
    for (const forbidden of [
      "allow-same-origin",
      "allow-popups-to-escape-sandbox",
      "allow-top-navigation",
      "allow-top-navigation-by-user-activation",
      "allow-forms",
      "allow-downloads",
      "allow-modals",
    ]) {
      expect(frame.getAttribute("sandbox")).not.toContain(forbidden);
    }
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(frame.getAttribute("loading")).toBe("eager");
  });

  it("query·fragment·credentials·port·path 변형을 거부하고 정본 링크만 제공한다", () => {
    const credentialVariant = new URL(POLICY_NEWS_URL);
    credentialVariant.username = "user";
    const variants = [
      `${POLICY_NEWS_URL}?preview=1`,
      `${POLICY_NEWS_URL}#latest`,
      credentialVariant.href,
      "https://salesptlog.online:444/news/latest",
      "https://salesptlog.online/news/latest/",
    ];

    for (const src of variants) {
      render(src);
      expect(host.querySelector("iframe"), src).toBeNull();
      const fallback = host.querySelector("a[target=\"_blank\"]")!;
      expect(fallback.getAttribute("href")).toBe(POLICY_NEWS_URL);
      expect(fallback.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("ready 상태는 app chrome 없이 frame만 보이고 child DOM을 읽지 않는다", () => {
    render();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("불러오는 중");
    act(() => host.querySelector("iframe")!.dispatchEvent(new Event("load")));
    expect(host.querySelector('[data-policy-news-frame-state]')?.getAttribute("data-policy-news-frame-state")).toBe("ready");
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.textContent).not.toContain("원문 프레임 로드됨");
    expect(host.textContent).not.toContain("원문 프레임이 로드됐어요");

    const viewer = readFileSync("app/(app)/payment/news/PolicyNewsEmbed.tsx", "utf8");
    expect(viewer).not.toMatch(/contentDocument|contentWindow|querySelectorAll?\s*\(/);
    expect(viewer).not.toContain("실시간 원문");
  });

  it("bounded timeout 뒤 오류와 정본 링크를 보이고 재시도는 새 frame을 만든다", () => {
    render();
    const first = host.querySelector("iframe")!;
    act(() => vi.advanceTimersByTime(POLICY_NEWS_LOAD_TIMEOUT_MS));
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("불러오지 못했어요");
    expect(host.querySelector(`a[href="${POLICY_NEWS_URL}"]`)).not.toBeNull();
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.querySelector("iframe")).not.toBe(first);
    expect(host.querySelector('[role="status"]')?.textContent).toContain("불러오는 중");
  });
});

describe("원본 frame route 계약", () => {
  it("desktop remaining-height와 mobile frame 높이를 동시에 보존한다", () => {
    render();
    const viewer = host.querySelector('section[aria-label="정책자금 데일리 원문"]')!;
    const frame = host.querySelector("iframe")!;
    expect(viewer.className).toContain("pc:h-full");
    expect(viewer.className).toContain("pc:min-h-0");
    expect(viewer.className).toContain("pc:overflow-hidden");
    expect(viewer.className).not.toContain("overflow-x");
    expect(frame.className).toContain("h-[65dvh]");
    expect(frame.className).toContain("pc:h-full");
    expect(frame.className).toContain("pc:min-h-0");
  });

  it("SalesPT header·route-local containment를 유지하고 source/new-window banner를 렌더하지 않는다", () => {
    const page = readFileSync("app/(app)/payment/news/page.tsx", "utf8");
    expect(page).toContain('pageTitle="정책자금 데일리"');
    expect(page).toContain("POLICY_NEWS_URL");
    expect(page).toContain("data-policy-news-desktop-shell");
    expect(page).toContain("pc:flex pc:h-dvh pc:min-h-0 pc:flex-col pc:overflow-hidden");
    expect(page).toContain('className="pc:min-h-0 pc:flex-1"');
    expect(page).not.toContain('target="_blank"');
    expect(page).not.toContain('rel="noopener noreferrer"');
    expect(page).not.toContain("ExternalArrow");
    expect(page).not.toContain("출처");
    expect(page).not.toContain("새 창에서 열기");
    expect(page).not.toContain("loadPolicyNews");
    expect(page).not.toContain("<Suspense");
  });

  it("거부된 native JSON 파서·재구성 경로를 제거한다", () => {
    const links = readFileSync("lib/config/links.ts", "utf8");
    const viewer = readFileSync("app/(app)/payment/news/PolicyNewsEmbed.tsx", "utf8");
    expect(links).not.toContain("extractEmbeddedPolicyNewsData");
    expect(links).not.toContain("normalizePolicyNewsData");
    expect(links).not.toContain("loadPolicyNews");
    expect(viewer).not.toContain("PolicyNewsCard");
  });
});

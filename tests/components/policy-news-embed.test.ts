// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import PolicyNewsEmbed from "@/app/(app)/payment/news/PolicyNewsEmbed";
import {
  extractEmbeddedPolicyNewsData,
  loadPolicyNews,
  normalizePolicyNewsData,
  safePolicyNewsExternalUrl,
  POLICY_NEWS_FETCH_TIMEOUT_MS,
  POLICY_NEWS_URL,
  type PolicyNewsLoadResult,
} from "@/config/links";

vi.mock("@/components/TopHeader", () => ({ default: () => null }));
vi.mock("@/components/PageContainer", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const rawItem = {
  확인상태: "확인",
  사업명: "지역 소상공인 자금",
  주관기관: "지원기관",
  지역: "서울",
  성격: "융자",
  최대지원금액: "1억원",
  공고일: "2026-10-02",
  마감일: "예산 소진 시",
  지원대상: "소상공인",
  업종제한: "일부 업종 제외",
  창업업력제한: "없음",
  특정타겟: "일반",
  대출종류: "운전자금",
  상환조건: "분할 상환",
  대출금리: "공고 확인",
  "기타조건(보증료 등)": "공고 확인",
  신청방법: "온라인 신청",
  공고원문링크: "https://example.com/notice",
  다운로드링크: "https://example.com/file.pdf",
  "뉴스·보도링크": "https://example.com/news",
};

function sourceFixture(data: unknown) {
  return `<!doctype html><script>const DATA = /*__DATA__*/${JSON.stringify(data)}; boot(DATA);</script>`;
}

function readyResult(items = [rawItem]): PolicyNewsLoadResult {
  return {
    status: "ready",
    data: normalizePolicyNewsData({ meta: { 기준일: "2026-10-02", 총건수: items.length }, items }),
  };
}

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
  vi.useRealTimers();
});

function render(result: PolicyNewsLoadResult) {
  act(() => root.render(React.createElement(PolicyNewsEmbed, { result })));
}

describe("정책자금 DATA 안전 파서", () => {
  it("실제 latest source 형태의 고정 marker 뒤 JSON 객체만 읽는다", () => {
    const raw = { meta: { 기준일: "2026-10-02", 총건수: 1 }, items: [rawItem] };
    expect(extractEmbeddedPolicyNewsData(sourceFixture(raw))).toEqual(raw);
    const normalized = normalizePolicyNewsData(raw);
    expect(normalized.total).toBe(1);
    expect(normalized.items[0]).toMatchObject({ name: rawItem.사업명, category: "융자" });
  });

  it("marker 누락·중복·잘린 JSON·잘못된 구조를 거부한다", () => {
    expect(() => extractEmbeddedPolicyNewsData("<script>const DATA={}</script>")).toThrow();
    const one = sourceFixture({ meta: {}, items: [] });
    expect(() => extractEmbeddedPolicyNewsData(one + one)).toThrow();
    expect(() => extractEmbeddedPolicyNewsData("const DATA = /*__DATA__*/{\"meta\":" )).toThrow();
    expect(() => normalizePolicyNewsData({ meta: { 기준일: "not-a-date" }, items: [] })).toThrow();
  });

  it("unsafe URL·credentials를 제거하고 text payload는 코드로 실행하지 않는다", () => {
    for (const unsafe of ["javascript:alert(1)", "data:text/html,bad", "https://test-user:test-pass@127.0.0.1/x", "file:///tmp/x"]) {
      expect(safePolicyNewsExternalUrl(unsafe), unsafe).toBeNull();
    }
    expect(safePolicyNewsExternalUrl("https://example.com/a")).toBe("https://example.com/a");
    const malicious = {
      ...rawItem,
      사업명: '<img src=x onerror="globalThis.pwned=1">',
      공고원문링크: "javascript:alert(1)",
      다운로드링크: "data:text/html,bad",
      "뉴스·보도링크": "https://test-user:test-pass@127.0.0.1/x",
    };
    render(readyResult([malicious]));
    expect(host.textContent).toContain("<img src=x");
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector('article a[href]')).toBeNull();
  });

  it("원문 script/HTML 실행 경로를 두지 않는다", () => {
    const page = readFileSync("app/(app)/payment/news/page.tsx", "utf8");
    const viewer = readFileSync("app/(app)/payment/news/PolicyNewsEmbed.tsx", "utf8");
    const links = readFileSync("lib/config/links.ts", "utf8");
    expect(links).toContain("JSON.parse");
    expect(links).not.toMatch(/\beval\s*\(|new Function|dangerouslySetInnerHTML/);
    expect(viewer).not.toMatch(/<iframe|dangerouslySetInnerHTML|allow-scripts/);
  });
});

describe("서버 fetch 경계", () => {
  it("고정 public URL만 no-store·cookie omit·redirect error로 읽는다", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: async () => sourceFixture({ meta: { 기준일: "2026-10-02" }, items: [rawItem] }),
    }) as Response);
    const result = await loadPolicyNews(fetcher as typeof fetch);
    expect(result.status).toBe("ready");
    expect(fetcher).toHaveBeenCalledWith(POLICY_NEWS_URL, expect.objectContaining({
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    }));
  });

  it("fetch 오류와 timeout을 안전한 오류 결과로 바꾼다", async () => {
    expect(await loadPolicyNews(vi.fn(async () => { throw new Error("network"); }) as typeof fetch)).toMatchObject({ status: "error" });

    vi.useFakeTimers();
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const pending = loadPolicyNews(fetcher as typeof fetch);
    await vi.advanceTimersByTimeAsync(POLICY_NEWS_FETCH_TIMEOUT_MS);
    await expect(pending).resolves.toMatchObject({ status: "error" });
  });
});

describe("native viewer UX", () => {
  it("날짜·목록·성격 필터를 앱 안에서 렌더한다", () => {
    const second = { ...rawItem, 사업명: "창업 지원사업", 성격: "보조금" };
    render(readyResult([rawItem, second]));
    expect(host.textContent).toContain("2026-10-02 정책자금 뉴스");
    expect(host.textContent).toContain("총 2건");
    expect(host.textContent).toContain(rawItem.사업명);
    const filter = [...host.querySelectorAll("button")].find((button) => button.textContent === "보조금")!;
    act(() => filter.click());
    expect(host.textContent).toContain(second.사업명);
    expect(host.textContent).not.toContain(rawItem.사업명);
  });

  it("빈 목록을 0으로 렌더하되 오류로 오인하지 않는다", () => {
    render(readyResult([]));
    expect(host.textContent).toContain("총 0건");
    expect(host.textContent).toContain("오늘 등록된 정책자금 뉴스가 없어요");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("오류 상태는 내부 재시도와 안전한 원문 링크를 제공한다", () => {
    render({ status: "error", message: "잠시 뒤 다시 시도해 주세요." });
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('a[href="/payment/news?retry=1"]')?.textContent).toContain("다시 시도");
    const original = host.querySelector(`a[href="${POLICY_NEWS_URL}"]`);
    expect(original?.getAttribute("target")).toBe("_blank");
    expect(original?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("페이지는 Suspense loading과 SalesPT header를 유지한다", () => {
    const page = readFileSync("app/(app)/payment/news/page.tsx", "utf8");
    expect(page).toContain('pageTitle="정책자금 데일리"');
    expect(page).toContain("<Suspense");
    expect(page).toContain("정책자금 뉴스를 불러오는 중…");
    expect(page).not.toContain("실시간 원문");
  });
});

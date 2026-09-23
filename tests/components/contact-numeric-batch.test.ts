// @vitest-environment jsdom
/**
 * contact-autosave-ux — numeric autosave safety regressions (real hooks).
 *
 *  - rapid numeric edits batch into ONE save with the newest values (800ms debounce kept).
 *  - a slow save followed by a newer edit keeps the newest draft: two sends,
 *    second carries the newest payload, nothing lost, no false "saved".
 *  - contact page never dims the whole main on background refetch, while the
 *    real initial-load path (global overlay + early return) stays intact.
 */
import { readFileSync } from "node:fs";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSaveMetrics } from "@/lib/query/contact-hooks";
import { useContactMetrics } from "@/app/(app)/contact/_lib/use-contact-metrics";
import { EMPTY_BY_CHANNEL } from "@/app/(app)/contact/_lib/contactDefaults";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type MetricsApi = ReturnType<typeof useContactMetrics>;

let root: Root | undefined;
let host: HTMLDivElement | undefined;
let client: QueryClient;
let api: MetricsApi;
let posts: Array<{ url: string; body: unknown }>;

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function stubPost(respond: (body: unknown) => Promise<unknown>) {
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      posts.push({ url, body });
      const data = await respond(body);
      return { ok: true, json: async () => data } as unknown as Response;
    }),
  );
}

function renderMetrics() {
  function Probe() {
    const saveMetrics = useSaveMetrics({ silent: true });
    const metrics = useContactMetrics({
      date: "2026-09-24",
      serverChannels: EMPTY_BY_CHANNEL(),
      saveMetrics,
      onProductionHold: () => {},
    });
    api = metrics;
    return h("div", null, metrics.status);
  }
  act(() => {
    root!.render(h(QueryClientProvider, { client }, h(Probe)));
  });
}

beforeEach(() => {
  client = makeClient();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  client.clear();
  vi.unstubAllGlobals();
});

const inflowOf = (n: number) => {
  const next = { ...api.draft };
  next.매입DB = { ...next.매입DB, inflow: n };
  return next;
};

describe("contact numeric autosave batching (800ms kept)", () => {
  it("batches rapid edits into one save carrying the newest values", async () => {
    stubPost(async () => ({ ok: true }));
    renderMetrics();
    act(() => api.update(inflowOf(1)));
    act(() => api.update(inflowOf(2)));
    act(() => api.update(inflowOf(3)));
    await act(async () => {
      await sleep(1150); // past the 800ms debounce + flight
    });
    expect(posts.length).toBe(1);
    expect(posts[0]!.url).toContain("/api/daily/2026-09-24");
    expect((posts[0]!.body as { 매입DB: { inflow: number } }).매입DB.inflow).toBe(3);
    expect(api.status).toBe("saved");
    expect(api.dirty).toBe(false);
  });

  it("slow save + later edit retains the newest draft (latest wins, nothing lost)", async () => {
    let release!: (v: unknown) => void;
    const held = new Promise<unknown>((r) => {
      release = r;
    });
    let calls = 0;
    stubPost(async () => {
      calls++;
      if (calls === 1) return held; // first save hangs
      return { ok: true };
    });
    renderMetrics();
    act(() => api.update(inflowOf(1)));
    await act(async () => {
      await sleep(950); // first flight starts (debounce elapsed)
    });
    act(() => api.update(inflowOf(2))); // newer edit lands mid-flight
    await act(async () => {
      release({ ok: true });
      await sleep(1200); // first ACK + second flight
    });
    expect(posts.length).toBe(2);
    expect((posts[1]!.body as { 매입DB: { inflow: number } }).매입DB.inflow).toBe(2);
    expect(api.draft.매입DB.inflow).toBe(2);
    expect(api.dirty).toBe(false);
    expect(api.status).toBe("saved");
  });

  it("save failure is surfaced, never reported as saved", async () => {
    stubPost(async () => {
      throw new Error("offline");
    });
    renderMetrics();
    act(() => api.update(inflowOf(5)));
    await act(async () => {
      await sleep(1150);
    });
    expect(api.status).toBe("error");
    expect(api.error).toMatch(/offline/);
    expect(api.dirty).toBe(true);
    expect(api.draft.매입DB.inflow).toBe(5);
  });
});

describe("contact page background-refetch dimming removed", () => {
  const src = () =>
    readFileSync(`${process.cwd()}/app/(app)/contact/page.tsx`, "utf8");

  it("never dims the whole main on background refetch", () => {
    const text = src();
    expect(text).not.toContain("opacity-50");
    expect(text).not.toMatch(/isFetching \? "opacity-50"/);
  });

  it("keeps the real initial-load path (early return + global overlay)", () => {
    const text = src();
    expect(text).toMatch(/dayQuery\.isLoading/);
    expect(text).toMatch(/dayQuery\.isError/);
  });
});

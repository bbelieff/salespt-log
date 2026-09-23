// @vitest-environment jsdom
/**
 * contact-autosave-ux — LoadingProvider silent opt-out regressions (real provider).
 *
 *  - silent pending mutation → no overlay, button still clickable.
 *  - simultaneous foreground mutation → overlay still blocks.
 *  - default (no meta) + silent:false → overlay still blocks (strict opt-out).
 *  - query initial loading → overlay still blocks.
 *  - actual hooks: useSaveMetrics/usePatchMeeting default = blocking,
 *    { silent: true } = meta.silent (contact numeric + meeting autosave opt-in).
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { LoadingProvider } from "@/components/ui/LoadingProvider";
import { useSaveMetrics, usePatchMeeting } from "@/lib/query/contact-hooks";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const overlay = (el: HTMLElement) => el.querySelector('[role="status"]');

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;
let client: QueryClient;

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

function render(tree: React.ReactElement) {
  act(() => {
    root!.render(h(QueryClientProvider, { client }, h(LoadingProvider, null, tree)));
  });
}

// Deferred gate for controllable pending windows (>150ms show delay).
function gate() {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("LoadingProvider silent background autosave", () => {
  it("silent pending mutation shows no overlay and the button stays clickable", async () => {
    const g = gate();
    let clicks = 0;
    let mutate!: () => void;
    function Probe() {
      const m = useMutation<unknown, Error, null>({ mutationFn: () => g.promise, meta: { silent: true } });
      mutate = () => m.mutate(null);
      return h("button", { type: "button", onClick: () => clicks++, id: "go" }, "go");
    }
    render(h(Probe));
    act(() => mutate());
    await act(async () => {
      await sleep(260); // past the 150ms show delay
    });
    expect(overlay(host!)).toBeNull();
    act(() => host!.querySelector<HTMLButtonElement>("#go")!.click());
    expect(clicks).toBe(1);
    await act(async () => {
      g.resolve({ ok: true });
      await sleep(60);
    });
  });

  it("simultaneous foreground mutation still blocks even with a silent one pending", async () => {
    const gs = gate();
    const gf = gate();
    let startSilent!: () => void;
    let startForeground!: () => void;
    function Probe() {
      const s = useMutation<unknown, Error, null>({ mutationFn: () => gs.promise, meta: { silent: true } });
      const f = useMutation<unknown, Error, null>({ mutationFn: () => gf.promise });
      startSilent = () => s.mutate(null);
      startForeground = () => f.mutate(null);
      return h("div", null, "probe");
    }
    render(h(Probe));
    act(() => startSilent());
    act(() => startForeground());
    await act(async () => {
      await sleep(260);
    });
    expect(overlay(host!)).not.toBeNull();
    await act(async () => {
      gs.resolve({});
      gf.resolve({});
      await sleep(60);
    });
  });

  it("default and silent:false mutations still block (strict explicit opt-out)", async () => {
    const g1 = gate();
    const g2 = gate();
    let a!: () => void;
    let b!: () => void;
    function Probe() {
      const m1 = useMutation<unknown, Error, null>({ mutationFn: () => g1.promise });
      const m2 = useMutation<unknown, Error, null>({ mutationFn: () => g2.promise, meta: { silent: false } });
      a = () => m1.mutate(null);
      b = () => m2.mutate(null);
      return h("div", null, "probe");
    }
    render(h(Probe));
    act(() => a());
    await act(async () => {
      await sleep(260);
    });
    expect(overlay(host!)).not.toBeNull();
    await act(async () => {
      g1.resolve({});
      await sleep(500); // let the first overlay clear (min-show 350ms)
    });
    act(() => b());
    await act(async () => {
      await sleep(260);
    });
    expect(overlay(host!)).not.toBeNull();
    await act(async () => {
      g2.resolve({});
      await sleep(60);
    });
  });

  it("query initial loading still blocks", async () => {
    const g = gate();
    function Probe() {
      useQuery({ queryKey: ["contact-ux-initial"], queryFn: () => g.promise });
      return h("div", null, "probe");
    }
    render(h(Probe));
    await act(async () => {
      await sleep(260);
    });
    expect(overlay(host!)).not.toBeNull();
    await act(async () => {
      g.resolve({ ok: true });
      await sleep(60);
    });
  });
});

describe("contact mutation hooks silent opt-in", () => {
  const stubDayPost = (impl: (url: string) => Promise<unknown>) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({ ok: true, json: () => impl(url) }) as unknown as Response),
    );
  };

  it("useSaveMetrics default blocks, { silent:true } sets meta.silent", async () => {
    const g = gate();
    stubDayPost(() => g.promise);
    let saveDefault!: ReturnType<typeof useSaveMetrics>;
    let saveSilent!: ReturnType<typeof useSaveMetrics>;
    function Probe() {
      saveDefault = useSaveMetrics();
      saveSilent = useSaveMetrics({ silent: true });
      return h("div", null, "probe");
    }
    render(h(Probe));
    let p!: Promise<unknown>;
    act(() => {
      p = saveDefault.mutateAsync({ date: "2026-09-24", channels: {} });
      p.catch(() => {});
    });
    const blocking = client
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === "pending");
    expect(blocking.length).toBe(1);
    expect(blocking[0]!.meta?.silent).not.toBe(true);
    await act(async () => {
      g.resolve({ ok: true });
      await p;
    });
    client.getMutationCache().clear();

    const g2 = gate();
    stubDayPost(() => g2.promise);
    act(() => {
      p = saveSilent.mutateAsync({ date: "2026-09-24", channels: {} });
      p.catch(() => {});
    });
    const silent = client
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === "pending");
    expect(silent.length).toBe(1);
    expect(silent[0]!.meta?.silent).toBe(true);
    await act(async () => {
      g2.resolve({ ok: true });
      await p;
    });
  });

  it("usePatchMeeting default blocks, { silent:true } sets meta.silent", async () => {
    const g = gate();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: () => g.promise }) as unknown as Response),
    );
    let patchDefault!: ReturnType<typeof usePatchMeeting>;
    let patchSilent!: ReturnType<typeof usePatchMeeting>;
    function Probe() {
      patchDefault = usePatchMeeting();
      patchSilent = usePatchMeeting({ silent: true });
      return h("div", null, "probe");
    }
    render(h(Probe));
    let p!: Promise<unknown>;
    act(() => {
      p = patchDefault.mutateAsync({ date: "2026-09-24", id: "m1", partial: {} });
      p.catch(() => {});
    });
    expect(
      client.getMutationCache().getAll().filter((m) => m.state.status === "pending")[0]!.meta
        ?.silent,
    ).not.toBe(true);
    await act(async () => {
      g.resolve({ ok: true });
      await p;
    });
    client.getMutationCache().clear();

    const g2 = gate();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: () => g2.promise }) as unknown as Response),
    );
    act(() => {
      p = patchSilent.mutateAsync({ date: "2026-09-24", id: "m1", partial: {} });
      p.catch(() => {});
    });
    expect(
      client.getMutationCache().getAll().filter((m) => m.state.status === "pending")[0]!.meta
        ?.silent,
    ).toBe(true);
    await act(async () => {
      g2.resolve({ ok: true });
      await p;
    });
  });
});

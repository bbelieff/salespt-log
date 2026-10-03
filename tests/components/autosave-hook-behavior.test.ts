// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/components/autosave/useAutosave";

type Value = { value: number };
type Api = ReturnType<typeof useAutosave<Value>>;
type Save = (arg: { target: Record<string, unknown>; payload: Value }) => Promise<unknown>;
let root: Root;
let host: HTMLDivElement;
let api: Api;
function mount(save: Save, strict = false) {
  function Editor() {
    api = useAutosave<Value>({ target: { student: "synthetic-a", row: "row-1" }, initial: { value: 0 }, save, delayMs: 20 });
    return createElement("div", null, `${api.draft.value}:${api.status}`);
  }
  act(() => root.render(strict ? createElement(StrictMode, null, createElement(Editor)) : createElement(Editor)));
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("autosave actual React binding: independent loss regressions", () => {
  it("does not write during hydration", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    await act(async () => { await new Promise(r => setTimeout(r, 35)); });
    expect(save).not.toHaveBeenCalled(); expect(api.dirty).toBe(false);
  });
  it("survives StrictMode effect cleanup/replay", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save, true);
    act(() => api.update({ value: 2 }));
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 2 } });
    expect(api.dirty).toBe(false);
  });
  it("save-and-leave commits the current staged currency group", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.stage({ value: 2 }));
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 2 } });
    expect(api.dirty).toBe(false);
  });
  it("invalid latest input cancels older debounce and prevents save-and-leave", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: 1 }));
    act(() => api.update({ value: Number.NaN }, { valid: false, error: "금액 확인" }));
    await act(async () => { await expect(api.flush()).rejects.toThrow(); });
    expect(save).not.toHaveBeenCalled(); expect(api.dirty).toBe(true);
  });
  it("background server refresh cannot cancel newer pending input", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: 2 }));
    act(() => api.syncServer({ value: 0 }));
    expect(api.draft.value).toBe(2);
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 2 } });
  });
  it("explicit discard cancels pending and resets the draft to saved", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: 2 }));
    act(() => api.discard());
    expect(api.draft.value).toBe(0);
    expect(api.dirty).toBe(false);
    await act(async () => { await new Promise(r => setTimeout(r, 35)); });
    expect(save).not.toHaveBeenCalled();
  });
  it("failed save leaves draft dirty and retry persists it", async () => {
    const save = vi.fn<Save>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined); mount(save);
    act(() => api.update({ value: 2 }));
    await act(async () => { await expect(api.flush()).rejects.toThrow("offline"); });
    expect(api.draft.value).toBe(2); expect(api.dirty).toBe(true); expect(api.status).toBe("error");
    await act(async () => { await api.flush(); });
    expect(api.saved.value).toBe(2); expect(api.dirty).toBe(false);
  });
  it("staged group supersedes an older debounced edit on save-and-leave (F2/1)", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: 1 }));
    act(() => api.stage({ value: 2 }));
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 2 } });
    await act(async () => { await new Promise(r => setTimeout(r, 40)); });
    expect(save).toHaveBeenCalledOnce(); // no stale intermediate timer write
  });
  it("active-flight edit then stage then flush awaits the final staged payload (F2/1)", async () => {
    let resolveFirst!: () => void;
    const firstGate = new Promise<void>((res) => { resolveFirst = res; });
    const save = vi.fn<Save>(async () => {
      if (save.mock.calls.length === 1) await firstGate;
    });
    mount(save);
    act(() => api.update({ value: 1 }));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); }); // debounce fires, v1 flight starts (blocked)
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 1 } });
    act(() => api.stage({ value: 2 })); // arrives mid-flight
    let done!: Promise<void>;
    act(() => { done = api.flush(); }); // must await v1 then send v2
    await act(async () => {
      resolveFirst(); // v1 ACKs
      await done;
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toMatchObject({ payload: { value: 2 } });
    expect(api.saved.value).toBe(2); expect(api.dirty).toBe(false);
  });
  it("dirty server refresh preserves invalid draft validation and error (F2/2)", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: 1 }));
    act(() => api.update({ value: Number.NaN }, { valid: false, error: "금액 확인" }));
    expect(api.error).toBe("금액 확인");
    act(() => api.syncServer({ value: 0 })); // dirty: draft NaN vs saved 0
    expect(Number.isNaN(api.draft.value)).toBe(true); // draft preserved, not clobbered
    expect(api.error).toBe("금액 확인"); // refetch must not turn invalid draft valid
    expect(api.dirty).toBe(true);
    await act(async () => { await expect(api.flush()).rejects.toThrow("금액 확인"); });
    expect(save).not.toHaveBeenCalled();
    act(() => api.update({ value: 3 })); // explicit valid user edit recovers
    expect(api.error).toBe("");
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 3 } });
  });
  it("dirty server refresh preserves failed-save error status (F2/4)", async () => {
    const save = vi.fn<Save>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined); mount(save);
    act(() => api.update({ value: 2 }));
    await act(async () => { await expect(api.flush()).rejects.toThrow("offline"); });
    expect(api.status).toBe("error"); expect(api.error).toBe("offline");
    act(() => api.syncServer({ value: 0 })); // dirty: draft 2 vs saved 0
    expect(api.draft.value).toBe(2);
    expect(api.status).toBe("error");
    expect(api.error).toBe("offline");
    expect(api.dirty).toBe(true);
    await act(async () => { await api.flush(); });
    expect(api.saved.value).toBe(2); expect(api.dirty).toBe(false);
  });
  it("stage alone does not clear prior invalid; commit(true) before flush saves (F2/3)", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: Number.NaN }, { valid: false, error: "금액 확인" }));
    act(() => api.stage({ value: 2 })); // valid latest, but stage carries no validity
    await act(async () => { await expect(api.flush()).rejects.toThrow("금액 확인"); });
    expect(save).not.toHaveBeenCalled();
    act(() => api.commit(true)); // explicit group validation before save-and-leave
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 2 } });
  });
  it("stage with explicit valid flag clears prior invalid (F2/3 validity API)", async () => {
    const save = vi.fn<Save>(async () => {}); mount(save);
    act(() => api.update({ value: Number.NaN }, { valid: false, error: "금액 확인" }));
    act(() => api.stage({ value: 2 }, true));
    await act(async () => { await api.flush(); });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ payload: { value: 2 } });
  });
});


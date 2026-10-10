// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import { useDbSheet } from "@/app/(app)/db-sheet/_components/use-db-sheet";

const mocks = vi.hoisted(() => ({ invalidateQueries: vi.fn(async () => {}), dirty: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }) }));
vi.mock("@/components/DirtyGuard", () => ({ useDirtyEntry: (...args: unknown[]) => mocks.dirty(...args) }));

type Api = ReturnType<typeof useDbSheet>;
type Pending = { body: Record<string, unknown> | undefined; resolve: (response: Response) => void };
let api: Api, root: Root, host: HTMLDivElement;
let requests: Pending[];
const id = "d020a334-1011-4000-8000-000000000001";
function lead(overrides: Partial<DbSheetLead> = {}): DbSheetLead {
  return { ...DbSheetLeadInput.parse({ id, date: "2026-10-11", channel: "직접생산", supplier: "메타 광고", company: "합성 회사", phone: "010-0000-0001" }), revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null, ...overrides };
}
function answer(index: number, rows: DbSheetLead[], ok = true) {
  requests[index]!.resolve({ ok, json: async () => ok ? { leads: rows } : { error: "합성 저장 실패" } } as Response);
}
async function mount() {
  function Harness() { api = useDbSheet(); return createElement("div", null, `${api.loading}:${api.pending}:${api.error}`); }
  await act(async () => { root.render(createElement(Harness)); });
}
async function loaded() { await mount(); await act(async () => { answer(0, [lead()]); }); }
async function debounce() { await act(async () => { await vi.advanceTimersByTimeAsync(500); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); requests = [];
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>(resolve => {
    requests.push({ body: init.body ? JSON.parse(String(init.body)) : undefined, resolve });
  })));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("DB sheet real hook persistence", () => {
  it("loads canonical normalized server data without an initial write", async () => {
    await mount(); expect(api.loading).toBe(true); expect(requests).toHaveLength(1);
    const canonical = lead();
    await act(async () => { answer(0, [canonical]); });
    expect(api.loading).toBe(false); expect(api.error).toBe(""); expect(api.pending).toBe(0);
    expect(api.leads).toEqual([canonical]);
    expect(api.leads[0]!.phone).toBe("010-0000-0001");
    expect(api.leads[0]!.contact.ci.대표자이름).toBe("");
    await debounce(); expect(requests).toHaveLength(1);
  });

  it.each(["record", "register"] as const)("keeps a newer note when an older %s response arrives", async action => {
    await loaded();
    let job!: Promise<void>;
    await act(async () => { job = action === "record" ? api.record(id, "컨택진행", "2026-10-11") : api.register(id); });
    expect(requests[1]!.body?.action).toBe(action === "record" ? "contact" : "meeting");
    act(() => api.contact(id, { ...api.leads[0]!.contact, note: "응답 대기 중 새 메모" }));
    const saved = lead({ revision: 2, result: "컨택진행", first: "2026-10-11", stage: action === "record" ? "상담 중" : "미팅예약", meetingId: action === "register" ? "synthetic-meeting" : null });
    await act(async () => { answer(1, [saved]); await job; });
    expect(api.leads[0]!.contact.note).toBe("응답 대기 중 새 메모");
    expect(api.leads[0]!.revision).toBe(2);
    expect(api.leads[0]!.meetingId).toBe(saved.meetingId);
    await debounce();
    expect(requests[2]!.body).toMatchObject({ action: "save", revision: 2, lead: { contact: { note: "응답 대기 중 새 메모" } } });
    await act(async () => { answer(2, [{ ...saved, revision: 3, contact: { ...saved.contact, note: "응답 대기 중 새 메모" } }]); });
    expect(api.pending).toBe(0); expect(api.error).toBe("");
  });

  it("serializes edits on the same lead and uses the acknowledged revision for the second write", async () => {
    await loaded();
    act(() => api.edit(id, "company", "첫 수정")); await debounce();
    expect(requests[1]!.body).toMatchObject({ revision: 1, lead: { company: "첫 수정" } });
    act(() => api.edit(id, "company", "두 번째 수정")); await debounce();
    expect(requests).toHaveLength(2);
    await act(async () => { answer(1, [lead({ company: "첫 수정", revision: 2 })]); });
    expect(api.leads[0]!.company).toBe("두 번째 수정");
    expect(requests[2]!.body).toMatchObject({ revision: 2, lead: { company: "두 번째 수정" } });
    await act(async () => { answer(2, [lead({ company: "두 번째 수정", revision: 3 })]); });
    expect(api.leads[0]!.revision).toBe(3); expect(api.pending).toBe(0);
  });

  it("retains failed input, exposes the failure and does not invalidate queries as if saved", async () => {
    await loaded();
    act(() => api.edit(id, "company", "실패해도 유지")); await debounce();
    await act(async () => { answer(1, [], false); });
    expect(api.leads[0]!.company).toBe("실패해도 유지");
    expect(api.leads[0]!.revision).toBe(1); expect(api.error).toBe("합성 저장 실패");
    expect(api.pending).toBe(0); expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    await act(async () => { await expect(api.flush(id)).rejects.toThrow("저장 오류"); });
    expect(mocks.dirty.mock.lastCall?.[1]).toBe(true);
  });
});

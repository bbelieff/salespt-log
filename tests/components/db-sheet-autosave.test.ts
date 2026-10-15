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
  it("suggests only acknowledged suppliers and preserves entry after a duplicate rejection", async () => {
    await loaded();
    act(()=>api.edit(id,"supplier","저장 전 공급처"));
    expect(api.suppliers).not.toContain("저장 전 공급처");
    await debounce();
    await act(async()=>{answer(1,[lead({supplier:"저장된 공급처",revision:2})]);});
    expect(api.suppliers).toContain("저장된 공급처");
    const newRow=lead({id:"d020a334-1011-4000-8000-000000000002"});
    let job!:Promise<void>;
    await act(async()=>{job=api.add([newRow],newRow.id);});
    await act(async()=>{requests[2]!.resolve({ok:false,json:async()=>({error:"중복 업체",code:"duplicate",duplicates:[{id,company:"합성 회사",phone:"010-0000-0001"}]})} as Response);await expect(job).rejects.toMatchObject({code:"duplicate"});});
    expect(api.leads).toHaveLength(1);expect(api.error).toBe("");
    await act(async()=>{job=api.add([newRow],newRow.id,[newRow.id]);});
    expect(requests[3]!.body).toMatchObject({allowDuplicateIds:[newRow.id]});
    await act(async()=>{answer(3,[newRow]);await job;});
    expect(api.leads).toHaveLength(2);
  });

  it("uses the server outcome rather than requested inflow flags in its success notice",async()=>{
    await loaded();const newRow=lead({id:"d020a334-1011-4000-8000-000000000002",recording:{inflow:true,activities:true}});
    let job!:Promise<void>;await act(async()=>{job=api.add([newRow],newRow.id);});
    const impact={inflow:0,contacts:0,meetings:0,rows:[]};
    await act(async()=>{requests[1]!.resolve({ok:true,json:async()=>({leads:[newRow],impact})} as Response);await job;});
    expect(api.addition).toEqual({total:1,impact});
  });

  it("requires another preview if a saved edit changed the revision after the impact was shown",async()=>{
    await loaded();const recording={inflow:true,activities:true};let preview!:ReturnType<Api['recordingPreview']>;
    await act(async()=>{preview=api.recordingPreview(id,recording);});
    await act(async()=>{requests[1]!.resolve({ok:true,json:async()=>({impact:{inflow:1,contacts:0,meetings:0,rows:[]}})} as Response);await preview;});
    act(()=>api.edit(id,'date','2026-10-12'));await debounce();
    await act(async()=>{answer(2,[lead({revision:2,date:'2026-10-12'})]);});
    await act(async()=>{await expect(api.configure(id,recording)).rejects.toThrow('다시 확인');});
    expect(requests).toHaveLength(3);expect(api.error).toBe('');
  });

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
    const saved = lead({ revision: 2, result: "컨택진행", first: "2026-10-11", stage: action === "record" ? "상담 중" : "미팅예약", meetingId: action === "register" ? "synthetic-meeting" : null, funnel: action === "record" ? "상담" : "미팅" });
    await act(async () => { answer(1, [saved]); await job; });
    expect(api.leads[0]!.contact.note).toBe("응답 대기 중 새 메모");
    expect(api.leads[0]!.revision).toBe(2);
    expect(api.leads[0]!.meetingId).toBe(saved.meetingId);
    // 공급처별 성과가 새로고침 없이 바뀌도록 서버가 계산한 단계도 함께 받는다.
    expect(api.leads[0]!.funnel).toBe(saved.funnel);
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
it("next date uses an explicit atomic schedule flag; duplicate DOM input events create only one save",async()=>{
 await loaded();
 act(()=>{api.edit(id,"next","2026-10-12");api.edit(id,"next","2026-10-12");});
 await debounce();expect(requests).toHaveLength(2);expect(requests[1]!.body).toMatchObject({action:"save",scheduleNext:true,lead:{next:"2026-10-12"}});
 const saved=lead({revision:2,next:"2026-10-12",followUp:{generation:1,completedGeneration:null,lastContactDate:""}});
 await act(async()=>{answer(1,[saved]);});
 act(()=>api.contact(id,{...api.leads[0]!.contact,date:"2026-10-12"}));await debounce();
 expect(requests[2]!.body).not.toHaveProperty("scheduleNext");
 await act(async()=>{answer(2,[{...saved,revision:3}]);});
 expect(mocks.invalidateQueries).toHaveBeenCalledWith({queryKey:["meeting-follow-ups"]});
});

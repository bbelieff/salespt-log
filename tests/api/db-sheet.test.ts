import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  view: vi.fn(), writable: vi.fn(), user: vi.fn(), enabled: vi.fn(),
  firstDate:vi.fn(),inflow:vi.fn(),suppliers:vi.fn(),recording:vi.fn(),deletion:vi.fn(),list: vi.fn(), save: vi.fn(), schedule: vi.fn(), contact: vi.fn(), meeting: vi.fn(), batch: vi.fn(),
  salesSync: vi.fn(), meetingSync: vi.fn(),
  contracts: vi.fn(), todos: vi.fn(),
}));
vi.mock("@/repo/db/read-daily", () => ({ readContractsFromDb: mocks.contracts, readTodosFromDb: mocks.todos }));
vi.mock("@/service/db-sheet-sync",()=>({queueDbSheetProductionSync:vi.fn()}));
vi.mock("@/auth/identity", () => ({
  requireStudentViewContext: mocks.view, getWritableUserEmail: mocks.writable,
  StudentViewContextError: class extends Error {
    constructor(public code: string, public status: number) { super(code); }
  },
}));
vi.mock("@/repo/users", () => ({ findUserByEmail: mocks.user }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: mocks.enabled }));
vi.mock("@/repo/db/db-sheet", () => ({
  DbSheetLinkedMeetingReadOnly: class extends Error { constructor() { super("예약된 업체정보와 일정은 STEP 3 일정·계약에서 수정해 주세요."); } },
  DbSheetOperationBlocked:class extends Error {},DbSheetDuplicate:class extends Error {},listDbSheetSuppliers:mocks.suppliers,changeDbSheetRecording:mocks.recording,deleteDbSheetLead:mocks.deletion,
  DbSheetConflict: class extends Error {}, listDbSheet: mocks.list,
  setDbSheetFirstDate:mocks.firstDate,changeDbSheetInflow:mocks.inflow,saveDbSheetLead: mocks.save, scheduleDbSheetContact: mocks.schedule, saveDbSheetContact: mocks.contact,
  registerDbSheetMeeting: mocks.meeting, importDbSheetLeads: mocks.batch,
}));
vi.mock("@/service/sales-write", () => ({ queueSalesRowSync: mocks.salesSync }));
vi.mock("@/service/meetings-write", () => ({ queueMeetingSheetSync: mocks.meetingSync }));

import { GET, POST } from "../../app/api/db-sheet/route";
import { StudentViewContextError } from "@/auth/identity";
import { DbSheetConflict, DbSheetLinkedMeetingReadOnly, DbSheetOperationBlocked } from "@/repo/db/db-sheet";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";

const id = "11111111-1111-4111-8111-111111111111";
const batchId = "22222222-2222-4222-8222-222222222222";
const ctx = { email: "synthetic@example.test", spreadsheetId: "synthetic-sheet", cohort: "연습" };
const input = DbSheetLeadInput.parse({
  id, date: "2026-10-11", channel: "매입DB", company: "합성 업체",
  contact: { date: "2026-10-11", meetingDate: "2026-10-12", time: "14:00", ci: { 소재지: "합성 주소" } },
});
const lead: DbSheetLead = { ...input, revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null };
const change = { lead, changedSales: [{ date: input.date, channel: input.channel }] };
const request = (body: unknown) => new NextRequest("https://app.example.test/api/db-sheet", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const save = () => request({ action: "save", lead: input, revision: null });
function expectNoWrites() {
  for (const fn of [mocks.firstDate,mocks.inflow,mocks.save, mocks.schedule, mocks.contact, mocks.meeting, mocks.batch, mocks.salesSync, mocks.meetingSync]) expect(fn).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_URL", ""); vi.stubEnv("NEXTAUTH_URL", "");
  mocks.contracts.mockResolvedValue([]); mocks.todos.mockResolvedValue([]);
  mocks.view.mockResolvedValue({ email: ctx.email }); mocks.writable.mockResolvedValue(ctx.email);
  mocks.user.mockResolvedValue(ctx); mocks.enabled.mockReturnValue(true);
  mocks.suppliers.mockResolvedValue([]);mocks.recording.mockResolvedValue(change);mocks.deletion.mockResolvedValue(change);
  mocks.firstDate.mockResolvedValue({...change,changedSales:[]});mocks.inflow.mockResolvedValue(change);
  mocks.list.mockResolvedValue([lead]); mocks.save.mockResolvedValue(change); mocks.schedule.mockResolvedValue(change);
  mocks.contact.mockResolvedValue(change); mocks.batch.mockResolvedValue([change]);
  mocks.meeting.mockResolvedValue({ ...change, meetingId: batchId });
});
afterEach(() => vi.unstubAllEnvs());

describe("DB sheet HTTP + real service boundary", () => {
  it("GET resolves authenticated tenant freshly and prevents caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    // Projection contract: GET adds the derived funnel step (untouched lead → 유입); nothing else changes.
    expect(await response.json()).toEqual({ leads: [{ ...lead, funnel: "유입" }],suppliers:[] });
    expect(mocks.user).toHaveBeenCalledWith(ctx.email, { fresh: true });
    expect(mocks.list).toHaveBeenCalledWith(ctx); expectNoWrites();
  });
  it.each(["GET", "POST"])("%s rejects unauthenticated callers before repository access", async method => {
    mocks.view.mockRejectedValue(new StudentViewContextError("unauthenticated", 401));
    const response = method === "GET" ? await GET() : await POST(save());
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(mocks.user).not.toHaveBeenCalled(); expectNoWrites();
  });
  it("rejects another viewed student and read-only writers", async () => {
    mocks.writable.mockResolvedValue("other@example.test");
    expect((await POST(save())).status).toBe(403); expect(mocks.user).not.toHaveBeenCalled(); expectNoWrites();
    mocks.writable.mockRejectedValue(new StudentViewContextError("student_view_forbidden", 403));
    expect((await POST(save())).status).toBe(403); expectNoWrites();
  });
  it.each([
    { action: "save", lead: { ...input, date: "2026-02-30" }, revision: null },
    { action: "save", lead: { ...input, channel: "invented-channel" }, revision: null },
    { action: "contact", id, revision: 1, date: "2026-13-01", result: "컨택진행", note: "" },
    { action: "save", lead: input, revision: -1 },
    { action: "import", batchId, leads: [] },
    { action: "unknown" },
  ])("rejects invalid command before writes %#", async body => {
    expect((await POST(request(body))).status).toBe(400); expectNoWrites();
  });
  it("rejects malformed JSON", async () => {
    const response = await POST(new NextRequest("https://app.example.test/api/db-sheet", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }));
    expect(response.status).toBe(400); expectNoWrites();
  });
  it.each(["disabled", "missing-sheet", "mismatched-override", "legacy"])("fails closed for %s", async mode => {
    if (mode === "disabled") mocks.enabled.mockReturnValue(false);
    if (mode === "missing-sheet") mocks.user.mockResolvedValue({ ...ctx, spreadsheetId: "" });
    if (mode === "mismatched-override") mocks.view.mockResolvedValue({ email: ctx.email, sheetOverride: "another-sheet" });
    if (mode === "legacy") mocks.user.mockResolvedValue({ ...ctx, cohort: "2" });
    expect((await GET()).status).toBe(503); expect((await POST(save())).status).toBe(503);
    expect(mocks.list).not.toHaveBeenCalled(); expectNoWrites();
  });
  it("uses server tenant, ignores forged body ownership, and queues mirror only after save", async () => {
    const response = await POST(request({ action: "save", lead: input, revision: null, email: "attacker@example.test", spreadsheetId: "another-sheet" }));
    expect(response.status).toBe(200); expect(mocks.save).toHaveBeenCalledWith(ctx, input, null);
    expect(mocks.salesSync).toHaveBeenCalledWith(ctx, input.date, input.channel);
  });
  it("dispatches contact and import commands with tenant/revision intact", async () => {
    const command = { action: "contact", id, revision: 1, date: "2026-10-12", result: "컨택진행", note: "합성 상담" };
    expect((await POST(request(command))).status).toBe(200);
    expect(mocks.contact).toHaveBeenCalledWith(ctx, id, command, 1);
    expect((await POST(request({ action: "import", batchId, leads: [input] }))).status).toBe(200);
    expect(mocks.batch).toHaveBeenCalledWith(ctx, batchId, [input]);
  });
  it("builds meeting from stored tenant lead rather than request fields", async () => {
    const response = await POST(request({ action: "meeting", id, revision: 1, company: "forged", channel: "현수막" }));
    expect(response.status).toBe(200);
    expect(mocks.meeting).toHaveBeenCalledWith(ctx, id, expect.objectContaining({
      업체명: input.company, channel: input.channel, 예약일: input.contact.date,
      미팅날짜: input.contact.meetingDate, 장소: "합성 주소",
    }), 1);
    expect(mocks.meetingSync).toHaveBeenCalledWith(ctx, batchId);
  });
  it("missing or stale meeting lead does not create a card", async () => {
    mocks.list.mockResolvedValue([]);
    expect((await POST(request({ action: "meeting", id, revision: 1 }))).status).toBe(409); expectNoWrites();
    mocks.list.mockResolvedValue([{ ...lead, revision: 2 }]);
    expect((await POST(request({ action: "meeting", id, revision: 1 }))).status).toBe(409); expectNoWrites();
  });
  it("maps concurrency conflict and redacts DB failure without firing mirrors", async () => {
    mocks.save.mockRejectedValue(new DbSheetConflict());
    expect((await POST(save())).status).toBe(409);
    mocks.save.mockRejectedValue(new Error("postgres://synthetic-secret customer-payload"));
    const response = await POST(save()); expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/synthetic-secret|customer-payload|postgres/);
    expect(mocks.salesSync).not.toHaveBeenCalled(); expect(mocks.meetingSync).not.toHaveBeenCalled();
  });
  it("returns a specific conflict for linked meeting fields without firing mirrors", async () => {
    mocks.save.mockRejectedValue(new DbSheetLinkedMeetingReadOnly());
    const response = await POST(save());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "예약된 업체정보와 일정은 STEP 3 일정·계약에서 수정해 주세요." });
    expect(mocks.salesSync).not.toHaveBeenCalled(); expect(mocks.meetingSync).not.toHaveBeenCalled();
  });
  it("fails before committing if required work-status reads fail", async () => {
    mocks.contracts.mockRejectedValue(new Error("synthetic-db-failure"));
    const response = await POST(save());
    expect(response.status).toBe(503); expectNoWrites();
    expect(JSON.stringify(await response.json())).not.toContain("synthetic-db-failure");
  });
  it.each(["text/plain", "application/x-www-form-urlencoded", "application/jsonp", ""])("rejects non-JSON content type %s", async type => {
    const req = save(); req.headers.set("content-type", type);
    expect((await POST(req)).status).toBe(415); expectNoWrites();
  });
  it.each([
    { origin: "https://other.example.test" },
    { origin: "null" },
    { origin: "" },
    { "sec-fetch-site": "cross-site" },
  ])("rejects cross-site browser requests %#", async headers => {
    const req = save(); for (const [key, value] of Object.entries(headers)) req.headers.set(key, value);
    expect((await POST(req)).status).toBe(403); expectNoWrites();
  });
  it("accepts JSON charset with same-origin and prevents a forged request URL overriding configured origin", async () => {
    const req = save(); req.headers.set("content-type", "application/json; charset=utf-8"); req.headers.set("origin", "https://app.example.test");
    expect((await POST(req)).status).toBe(200);
    mocks.save.mockClear(); mocks.salesSync.mockClear();
    vi.stubEnv("AUTH_URL", "https://app.example.test/auth");
    const forged = new NextRequest("https://other.example.test/api/db-sheet", { method: "POST", headers: { origin: "https://other.example.test", "content-type": "application/json" }, body: JSON.stringify({ action: "save", lead: input, revision: null }) });
    expect((await POST(forged)).status).toBe(403); expectNoWrites();
  });
  it("supports NEXTAUTH_URL and fails closed on malformed configured origin", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://configured.example.test/auth");
    const req = save(); req.headers.set("origin", "https://configured.example.test");
    expect((await POST(req)).status).toBe(200);
    mocks.save.mockClear(); mocks.salesSync.mockClear();
    vi.stubEnv("AUTH_URL", "invalid-url");
    const invalid = save(); invalid.headers.set("origin", "https://configured.example.test");
    expect((await POST(invalid)).status).toBe(403); expectNoWrites();
  });
});

it("explicit schedule and atomic next edit carry the server revision and authorized tenant",async()=>{
 const response=await POST(request({action:"schedule",id,revision:2,next:"2026-10-12"}));
 expect(response.status).toBe(200);expect(mocks.schedule).toHaveBeenCalledWith(ctx,id,"2026-10-12",2);
 const edited=await POST(request({action:"save",lead:{...input,next:"2026-10-12",followUp:{generation:99}},revision:2,scheduleNext:true}));
 expect(edited.status).toBe(200);expect(mocks.save).toHaveBeenCalledWith(ctx,expect.not.objectContaining({followUp:expect.anything()}),2,true);
});

it("recording and deletion previews cannot write or mirror and require revisions/confirmation",async()=>{
 mocks.recording.mockResolvedValue({...change,changedSales:[],impact:{inflow:1,contacts:0,meetings:0,rows:[]}});
 const result=await POST(request({action:'recording-preview',id,revision:1,recording:{inflow:true,activities:false}}));expect(result.status).toBe(200);expect((await result.json()).impact.inflow).toBe(1);
 expect(mocks.recording).toHaveBeenCalledWith(ctx,id,1,{inflow:true,activities:false},true);expect(mocks.salesSync).not.toHaveBeenCalled();
 expect((await POST(request({action:'delete',id,revision:1}))).status).toBe(400);expect(mocks.deletion).not.toHaveBeenCalled();
 expect((await POST(request({action:'delete',id,revision:1,confirmed:true}))).status).toBe(200);expect(mocks.deletion).toHaveBeenCalledWith(ctx,id,1,false);
});
it("strips forged ledger evidence while preserving recording choice",async()=>{
 const response=await POST(request({action:'save',lead:{...input,recording:{inflow:false,activities:true},_recorded:{inflow:true,contacts:['2020-01-01'],meeting:true},inflowStatus:{state:'recorded'}},revision:null}));
 expect(response.status).toBe(200);const actual=mocks.save.mock.calls[0]?.[1];expect(actual.recording).toEqual({inflow:false,activities:true});expect(actual).not.toHaveProperty('_recorded');expect(actual).not.toHaveProperty('inflowStatus');
});

it("validates first-date command and keeps display edit out of sales sync",async()=>{
 for(const first of ["2026-02-30","not-date"]){expect((await POST(request({action:"first-date",id,revision:1,first}))).status).toBe(400);}
 expect(mocks.firstDate).not.toHaveBeenCalled();
 for(const first of ["2026-10-01",""]){expect((await POST(request({action:"first-date",id,revision:1,first}))).status).toBe(200);expect(mocks.firstDate).toHaveBeenLastCalledWith(ctx,id,first,1);}
 expect(mocks.salesSync).not.toHaveBeenCalled();expect(mocks.meetingSync).not.toHaveBeenCalled();
});
it("validates AS input without defaulting omitted fields",async()=>{
 expect(DbSheetLeadInput.parse(input)).not.toHaveProperty("asReceived");
 expect(DbSheetLeadInput.safeParse({...input,asReceived:"true"}).success).toBe(false);
 expect(DbSheetLeadInput.safeParse({...input,asNote:"x".repeat(20001)}).success).toBe(false);
 const response=await POST(request({action:"contact",id,revision:1,date:input.date,result:"AS예정",note:"AS 요청"}));expect(response.status).toBe(200);
 expect(mocks.contact).toHaveBeenCalledWith(ctx,id,expect.objectContaining({result:"AS예정"}),1);
});
it("routes inflow preview/apply through tenant and revision guard",async()=>{
 expect((await POST(request({action:"inflow-preview",id,revision:1,inflow:false}))).status).toBe(200);
 expect(mocks.inflow).toHaveBeenLastCalledWith(ctx,id,1,false,true);expect(mocks.salesSync).not.toHaveBeenCalled();
 expect((await POST(request({action:"inflow",id,revision:1,inflow:false}))).status).toBe(200);
 expect(mocks.inflow).toHaveBeenLastCalledWith(ctx,id,1,false,false);
 mocks.writable.mockResolvedValue("other@example.test");
 expect((await POST(request({action:"inflow",id,revision:1,inflow:false}))).status).toBe(403);expect(mocks.inflow).toHaveBeenCalledTimes(2);
});
it.each(['inflow-preview','inflow'])('keeps strict %s validation failures at 409 without mirror writes',async action=>{
 mocks.inflow.mockRejectedValue(new DbSheetOperationBlocked('유입 기여 기록과 설정이 맞지 않아 처리할 수 없습니다.'));
 const response=await POST(request({action,id,revision:1,inflow:false}));
 expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'유입 기여 기록과 설정이 맞지 않아 처리할 수 없습니다.'});
 expect(mocks.salesSync).not.toHaveBeenCalled();expect(mocks.meetingSync).not.toHaveBeenCalled();
});
it('keeps an isolated projection absent through service/HTTP while preserving a normal sibling',async()=>{
 const bad={...lead},good={...lead,id:batchId,inflowStatus:{state:'recorded' as const,count:1 as const}};
 mocks.list.mockResolvedValue([bad,good]);const response=await GET();expect(response.status).toBe(200);
 const body=await response.json();expect(body.leads).toHaveLength(2);expect(body.leads[0]).not.toHaveProperty('inflowStatus');expect(body.leads[1].inflowStatus).toEqual({state:'recorded',count:1});expectNoWrites();
});

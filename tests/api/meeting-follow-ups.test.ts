import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({view:vi.fn(),load:vi.fn()}));
vi.mock("@/auth/identity",()=>({requireStudentViewContext:mocks.view,StudentViewContextError:class extends Error{constructor(public code:string,public status:number){super(code);}}}));
vi.mock("@/service/meeting-follow-ups",()=>({loadFollowUpMeetings:mocks.load}));
vi.mock("@/lib/analytics/api-timing",()=>({withApiTiming:(_key:string,fn:unknown)=>fn}));
import {GET} from "../../app/api/meetings/follow-ups/route";
import {StudentViewContextError} from "@/auth/identity";
const request=(suffix="")=>new NextRequest("https://example.test/api/meetings/follow-ups?through=2026-10-12"+suffix);
beforeEach(()=>{vi.resetAllMocks();mocks.view.mockResolvedValue({email:"synthetic@example.test",sheetOverride:"owned-sheet"});mocks.load.mockResolvedValue([]);});
it("uses resolved viewing student, ignores URL email/sheet and prevents caching",async()=>{
 const response=await GET(request("&email=other@example.test&sheet=other"));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");expect(mocks.load).toHaveBeenCalledWith("synthetic@example.test","2026-10-12","owned-sheet");
});
it.each([401,403] as const)("fails closed with authorization status %s",async status=>{
 mocks.view.mockRejectedValue(new StudentViewContextError(status===401?"unauthenticated":"student_view_forbidden",status));expect((await GET(request())).status).toBe(status);expect(mocks.load).not.toHaveBeenCalled();
});
it("rejects impossible dates and redacts storage failures",async()=>{
 const bad=new NextRequest("https://example.test/api/meetings/follow-ups?through=2026-02-30");expect((await GET(bad)).status).toBe(400);expect(mocks.load).not.toHaveBeenCalled();
 mocks.load.mockRejectedValue(new Error("private-db-secret"));const response=await GET(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("private-db-secret");
});

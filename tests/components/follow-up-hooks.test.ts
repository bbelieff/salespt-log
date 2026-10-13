import { afterEach, expect, it, vi } from "vitest";
const query=vi.hoisted(()=>vi.fn());
vi.mock("@tanstack/react-query",()=>({useQuery:query}));
import { useFollowUpMeetings } from "@/lib/query/follow-up-hooks";
afterEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();});
it("uses the complete pending endpoint with background loading and explicit failure",async()=>{
 query.mockImplementation(options=>options);
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({meetings:[]})})));
 useFollowUpMeetings("2026-10-12",{enabled:false});
 const config=query.mock.calls[0]![0];expect(config).toMatchObject({queryKey:["meeting-follow-ups","2026-10-12"],enabled:false,retry:false,meta:{background:true}});
 expect(await config.queryFn()).toEqual({meetings:[]});expect(fetch).toHaveBeenCalledWith("/api/meetings/follow-ups?through=2026-10-19",{cache:"no-store"});
 vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,json:async()=>({error:"일시 오류"})})));
 await expect(config.queryFn()).rejects.toThrow("일시 오류");
});

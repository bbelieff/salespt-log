import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const mock=vi.hoisted(()=>({view:vi.fn(),email:vi.fn(),restore:vi.fn(),list:vi.fn()}));
vi.mock("@/auth/identity",()=>({getWritableUserEmail:mock.email,requireStudentViewContext:mock.view,StudentViewContextError:class extends Error{status=403}}));
vi.mock("@/service/meeting-archive",()=>({restoreDeletedMeeting:mock.restore,deletedMeetings:mock.list}));
import {POST} from "../../app/api/meeting/[id]/restore/route";
import {GET} from "../../app/api/meetings/deleted/route";
beforeEach(()=>{vi.resetAllMocks();mock.email.mockResolvedValue('synthetic-owner@example.test');mock.view.mockResolvedValue({email:'synthetic-owner@example.test'});mock.restore.mockResolvedValue({id:'same-id'});mock.list.mockResolvedValue([]);});
it("uses authenticated owner, never a supplied tenant",async()=>{const r=await POST(new NextRequest('http://local/api/meeting/same-id/restore',{method:'POST',body:JSON.stringify({email:'other@example.test'})}),{params:Promise.resolve({id:'same-id'})});expect(r.status).toBe(200);expect(mock.restore).toHaveBeenCalledWith('synthetic-owner@example.test','same-id',undefined);});
it("denies restore and list without authenticated write identity",async()=>{mock.email.mockRejectedValue(new Error('unauthorized'));expect((await GET()).status).toBe(500);expect((await POST(new NextRequest('http://local'),{params:Promise.resolve({id:'same-id'})})).status).toBe(500);expect(mock.restore).not.toHaveBeenCalled();expect(mock.list).not.toHaveBeenCalled();});
it("returns clear complex conflict and hides internal failure text",async()=>{mock.restore.mockRejectedValue(new Error('MEETING_ARCHIVE_COMPLEX'));expect((await POST(new NextRequest('http://local'),{params:Promise.resolve({id:'same-id'})})).status).toBe(409);mock.restore.mockRejectedValue(new Error('internal-private-diagnostic'));const r=await POST(new NextRequest('http://local'),{params:Promise.resolve({id:'same-id'})});expect(JSON.stringify(await r.json())).not.toContain('internal-private-diagnostic');});
it("archive listing scopes through resolved identity",async()=>{await GET();expect(mock.list).toHaveBeenCalledWith('synthetic-owner@example.test',undefined);});

it("denies writes when view and writable identities differ",async()=>{mock.email.mockResolvedValue('other@example.test');const r=await POST(new NextRequest('http://local'),{params:Promise.resolve({id:'same-id'})});expect(r.status).toBe(403);expect(mock.restore).not.toHaveBeenCalled();});

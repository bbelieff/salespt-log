import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),db:vi.fn(),sheet:vi.fn(),enabled:vi.fn(),capture:vi.fn()}));
vi.mock("@/repo/users",()=>({findUserByEmail:mocks.user}));
vi.mock("@/repo/db/read-daily",()=>({readMeetingsFromDb:mocks.db}));
vi.mock("@/repo/meetings",()=>({readAllMeetings:mocks.sheet}));
vi.mock("@/repo/db/client",()=>({dbEnabled:mocks.enabled}));
vi.mock("@sentry/nextjs",()=>({captureException:mocks.capture}));
import {loadFollowUpMeetings} from "@/service/meeting-follow-ups";
import {meeting,TODAY} from "../components/follow-ups-factories";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({spreadsheetId:"synthetic",cohort:"11"});mocks.enabled.mockReturnValue(true);mocks.db.mockResolvedValue([]);mocks.sheet.mockResolvedValue([]);});
it("DB source includes old and today's pending results without writes or a lower date boundary",async()=>{
 const old=meeting({미팅날짜:"2024-01-01"}),today=meeting({미팅날짜:TODAY});
 mocks.db.mockResolvedValue([old,today,meeting({미팅날짜:"2026-10-13"}),meeting({상태:"취소"}),meeting({상태:"변경"}),meeting({미팅날짜:"bad"})]);
 expect(await loadFollowUpMeetings("synthetic@example.test",TODAY)).toEqual([old,today]);expect(mocks.sheet).not.toHaveBeenCalled();
 expect(mocks.user).toHaveBeenCalledWith("synthetic@example.test",{fresh:true});expect(mocks.db).toHaveBeenCalledWith("synthetic");
});
it("legacy cohort and disabled DB use existing read-only Sheets source",async()=>{
 mocks.user.mockResolvedValue({spreadsheetId:"synthetic",cohort:"3"});await loadFollowUpMeetings("s@example.test",TODAY);expect(mocks.db).not.toHaveBeenCalled();expect(mocks.sheet).toHaveBeenCalledWith("synthetic");
});
it("DB read failure falls back once; both failing rejects instead of returning false empty",async()=>{
 mocks.db.mockRejectedValue(new Error("db failure"));const pending=meeting();mocks.sheet.mockResolvedValue([pending]);expect(await loadFollowUpMeetings("s@example.test",TODAY)).toEqual([pending]);
 mocks.sheet.mockRejectedValue(new Error("sheet failure"));await expect(loadFollowUpMeetings("s@example.test",TODAY)).rejects.toThrow("sheet failure");
});
it("missing sheet and mismatched authorized override cannot read another tenant",async()=>{
 await expect(loadFollowUpMeetings("s@example.test",TODAY,"other-sheet")).rejects.toThrow("[no-sheet]");expect(mocks.db).not.toHaveBeenCalled();expect(mocks.sheet).not.toHaveBeenCalled();
 mocks.user.mockResolvedValue(null);await expect(loadFollowUpMeetings("s@example.test",TODAY)).rejects.toThrow("[no-sheet]");
});

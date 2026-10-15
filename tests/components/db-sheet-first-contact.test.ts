import { expect, it } from "vitest";
import { blank, recordContact } from "@/app/(app)/db-sheet/_components/model";
it.each(["단순거절","재통화","컨택진행","상담 후 거절"])("sets selected date once for %s", result => {
 const row=recordContact(blank(),result,"2027-01-10");expect(row.first).toBe("2027-01-10");
 expect(recordContact(row,"컨택진행","2027-01-11").first).toBe("2027-01-10");
 expect(recordContact(row,"상담 후 거절","2027-01-09").first).toBe("2027-01-10");
});
it.each(["미컨택","부재"])("does not start a date for %s", result => expect(recordContact(blank(),result,"2027-01-10").first).toBe(""));
it("keeps nonqualified contact out of consultation stage and preserves qualified history",()=>{
 const row=recordContact(blank(),"단순거절","2027-01-10");expect(row.stage).toBe("미컨택");
 const qualified=recordContact(row,"컨택진행","2027-01-11");expect(qualified.stage).toBe("상담 중");
 expect(recordContact(qualified,"재통화","2027-01-12").stage).toBe("상담 중");
 expect(recordContact({...qualified,stage:"미팅예약"},"단순거절","2027-01-13").stage).toBe("미팅예약");
});

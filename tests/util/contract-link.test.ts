import { describe, expect, it } from "vitest";
import { isManualContractLink, manualContractLink, meetingIdFromLink } from "@/util/contract-link";

describe("contract-link — 「영업기록 없이 추가」 표식", () => {
  it("manual:<key> 만 수동 표식", () => {
    expect(manualContractLink("abc")).toBe("manual:abc");
    expect(isManualContractLink("manual:abc")).toBe(true);
    expect(isManualContractLink(" manual:abc")).toBe(true);
    expect(isManualContractLink("m-1")).toBe(false);
    expect(isManualContractLink("")).toBe(false);
    expect(isManualContractLink(undefined)).toBe(false);
    expect(isManualContractLink(null)).toBe(false);
  });
  it("meetingIdFromLink — 진짜 미팅 id 만 통과", () => {
    expect(meetingIdFromLink("m-1")).toBe("m-1");
    expect(meetingIdFromLink("manual:abc")).toBeUndefined();
    expect(meetingIdFromLink("")).toBeUndefined();
    expect(meetingIdFromLink(undefined)).toBeUndefined();
  });
});

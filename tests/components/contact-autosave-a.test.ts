/**
 * Scope A domain regressions — contact split.
 * Behavioral: numeric payloads can never carry meeting drafts, per-draft
 * registration is idempotent, date warnings are preserved inline.
 */
import { describe, expect, it } from "vitest";
import {
  isMetricsOnlyPayload,
  isSameDayMeeting,
  metricsSavePayload,
  shouldSkipRegister,
} from "@/app/(app)/contact/_lib/metrics-autosave";
import {
  buildMeetingFromSlot,
  slotComplete,
} from "@/app/(app)/contact/_lib/meeting-draft";
import { EMPTY_BY_CHANNEL } from "@/app/(app)/contact/_lib/contactDefaults";
import type { NewSlot } from "@/app/(app)/contact/_components/MeetingSlotItem";

const slot = (over: Partial<NewSlot> = {}): NewSlot => ({
  tempId: "draft-1",
  channel: "매입DB",
  미팅날짜: "2026-09-25",
  미팅시간: "14:00",
  업체명: "○○부동산",
  장소: "잠실",
  예약비고: "",
  ...over,
});

describe("metrics autosave payload", () => {
  it("contains only the four numeric keys per channel — no meeting data", () => {
    const draft = EMPTY_BY_CHANNEL();
    draft.매입DB.inflow = 3;
    const payload = metricsSavePayload(draft);
    expect(isMetricsOnlyPayload(payload)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("tempId");
    expect(JSON.stringify(payload)).not.toContain("업체명");
  });

  it("is a snapshot — later draft edits do not leak into the queued payload", () => {
    const draft = EMPTY_BY_CHANNEL();
    const payload = metricsSavePayload(draft);
    draft.매입DB.inflow = 99;
    expect(payload.매입DB.inflow).toBe(0);
  });

  it("rejects payloads polluted with draft/meeting keys", () => {
    const dirty = { ...metricsSavePayload(EMPTY_BY_CHANNEL()) };
    (dirty.매입DB as unknown as Record<string, unknown>).tempId = "draft-1";
    expect(isMetricsOnlyPayload(dirty)).toBe(false);
  });
});

describe("per-draft meeting registration", () => {
  it("builds the meeting row with the frozen reservation date and stable id", () => {
    const m = buildMeetingFromSlot(slot(), "2026-09-23");
    expect(m.id).toBe("draft-1"); // stable operation identity → idempotent retry
    expect(m.예약일).toBe("2026-09-23");
    expect(m.상태).toBe("예약");
  });

  it("requires all fields before a draft is registrable", () => {
    expect(slotComplete(slot())).toBe(true);
    expect(slotComplete(slot({ 업체명: "  " }))).toBe(false);
    expect(slotComplete(slot({ 미팅시간: "" }))).toBe(false);
  });

  it("retry skips append when the id already exists (no duplicates)", () => {
    expect(shouldSkipRegister("draft-1", new Set(["draft-1"]))).toBe(true);
    expect(shouldSkipRegister("draft-1", new Set(["other"]))).toBe(false);
  });

  it("flags same-day meetings for the inline warning, blanks stay quiet", () => {
    expect(isSameDayMeeting("2026-09-23", "2026-09-23")).toBe(true);
    expect(isSameDayMeeting("2026-09-23", "2026-09-25")).toBe(false);
    expect(isSameDayMeeting("2026-09-23", "")).toBe(false);
  });
});

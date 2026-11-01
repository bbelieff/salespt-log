/** 통화 정리 스위치 — 목록에 든 사람만, 미설정이면 아무도. */
import { afterEach, expect, it, vi } from "vitest";
import { isCallSummaryUser } from "@/config";

afterEach(() => { vi.unstubAllEnvs(); });

it("CALL_SUMMARY_EMAILS 에 든 사람만 켜진다(대소문자·공백 무시)", () => {
  vi.stubEnv("CALL_SUMMARY_EMAILS", " Pilot@Example.test , b@example.test");
  expect(isCallSummaryUser("pilot@example.test ")).toBe(true);
  expect(isCallSummaryUser("other@example.test")).toBe(false);
});

it("미설정이면 아무도 안 켜진다", () => {
  vi.stubEnv("CALL_SUMMARY_EMAILS", "");
  expect(isCallSummaryUser("pilot@example.test")).toBe(false);
});

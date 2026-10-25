// @vitest-environment jsdom
/** 실제 탭 찍기 — 미지원·휴대폰·거절이면 null(사진 붙이기로), 찍는 동안만 가리고 끝나면 공유를 끄고 가림을 되돌린다. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canCaptureTab, captureTab } from "@/components/bug-report/capture";

const PC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0";
const stop = vi.fn();
function setNavigator(ua: string, getDisplayMedia?: () => Promise<unknown>) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", { value: getDisplayMedia ? { getDisplayMedia } : undefined, configurable: true });
}

beforeEach(() => {
  stop.mockClear();
  document.body.innerHTML = `<p id="phone">010-1234-5678</p><p id="plain">메모</p>`;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("captureTab", () => {
  it("탭 찍기가 없으면 null", async () => {
    setNavigator(PC_UA);
    expect(canCaptureTab()).toBe(false);
    await expect(captureTab(0)).resolves.toBeNull();
  });
  it("휴대폰은 허락 창을 띄우지 않고 null", async () => {
    const gdm = vi.fn();
    setNavigator("Mozilla/5.0 (Linux; Android 14) Chrome/141.0 Mobile", gdm);
    await expect(captureTab(0)).resolves.toBeNull();
    expect(gdm).not.toHaveBeenCalled();
  });
  it("허락하지 않으면 null, 가림도 남지 않는다", async () => {
    setNavigator(PC_UA, () => Promise.reject(new DOMException("denied", "NotAllowedError")));
    await expect(captureTab(0)).resolves.toBeNull();
    expect(document.querySelector(".bug-report-mask")).toBeNull();
  });
  it("찍는 동안만 개인정보를 가리고, 끝나면 공유를 끄고 되돌린다", async () => {
    let maskedDuringCapture = false;
    setNavigator(PC_UA, async () => ({ getTracks: () => [{ stop }] }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {
      maskedDuringCapture = document.getElementById("phone")!.classList.contains("bug-report-mask")
        && !document.getElementById("plain")!.classList.contains("bug-report-mask");
    });
    await captureTab(0); // jsdom 은 영상 크기가 0 이라 그림은 null — 정리 동작만 본다
    expect(maskedDuringCapture).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".bug-report-mask")).toBeNull();
  });
});

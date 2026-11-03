// @vitest-environment jsdom
/** 통화 정리 앞단(PR-5a) — 파일 확인 규칙, 칩, 앱 고르기·녹음 올리기 대화상자. 가상 업체·번호만. */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { callChip, checkRecording, eul, euro, latestCallByLead, readCallApp, saveCallApp } from "@/app/(app)/db-sheet/_components/call-client";
import { CallDialDialog } from "@/app/(app)/db-sheet/_components/CallDial";
import { CallUploadDialog } from "@/app/(app)/db-sheet/_components/CallUploadDialog";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement, root: Root;
const fetchMock = vi.fn();
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  HTMLDialogElement.prototype.showModal = vi.fn(); HTMLDialogElement.prototype.close = vi.fn();
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const button = (text: string) => [...host.querySelectorAll("button")].find(b => b.textContent === text)!;
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const DIALED = Date.parse("2026-11-03T05:02:00Z");
const row = { ...blank(), id: "00000000-0000-4000-8000-000000000002", company: "가상기계", owner: "김가상", phone: "010-0000-1234" };

it("파일 이름의 번호·저장 시각·형식으로 그 통화가 맞는지 본다", () => {
  const f = (name: string, at = DIALED + 3 * 60_000, size = 1000) => ({ name, size, lastModified: at });
  expect(checkRecording(f("통화 녹음 010-0000-1234_261103_140211.m4a"), "01000001234", DIALED)).toMatchObject({ phoneMatch: true, warn: "", fileError: "" });
  expect(checkRecording(f("010-0000-5678_261103_1402.m4a"), row.phone, DIALED)).toMatchObject({ namePhone: "010-0000-5678", phoneMatch: false, warn: "phone" });
  expect(checkRecording(f("녹음.m4a", DIALED + 45 * 60_000), row.phone, DIALED)).toMatchObject({ phoneMatch: null, minutesOff: 45, warn: "time" });
  expect(checkRecording(f("녹음.m4a"), row.phone, null)).toMatchObject({ warn: "", minutesOff: null });
  expect(checkRecording(f("녹음.amr"), row.phone, DIALED).fileError).toContain("녹음만");
  expect(checkRecording(f("녹음.m4a", DIALED, 15 * 1024 * 1024), row.phone, DIALED).fileError).toContain("14MB");
});

it("상태 칩과 업체별 최근 통화", () => {
  expect(callChip("dialed")?.label).toBe("녹음 대기");
  expect(callChip("processing")?.label).toBe("정리 중");
  expect(callChip("review")?.label).toBe("확인 대기");
  expect(callChip("failed")?.label).toBe("정리 실패");
  expect(callChip("confirmed")).toBeNull();
  const latest = latestCallByLead([{ id: "b", leadId: "L" }, { id: "a", leadId: "L" }] as never);
  expect(latest.get("L")?.id).toBe("b");
  expect([eul("익시오"), eul("에이닷"), euro("에이닷"), euro("기본 전화 앱"), euro("다른 녹음 앱")]).toEqual(["익시오를", "에이닷을", "에이닷으로", "기본 전화 앱으로", "다른 녹음 앱으로"]);
  saveCallApp("adot"); expect(readCallApp()).toBe("adot");
  saveCallApp(null); expect(readCallApp()).toBeNull();
  localStorage.setItem("db-sheet-call-app", "evil"); expect(readCallApp()).toBeNull();
});

it("앱 고르기: 앱 이름만, [항상 이 앱으로]는 저장하고 번호 복사 → 기록 → 안내", async () => {
  const write = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
  fetchMock.mockResolvedValue(ok({ id: "call-1" }));
  const dialed = vi.fn();
  await act(async () => root.render(createElement(CallDialDialog, { row, onDialed: dialed, onClose: vi.fn() })));
  expect([...host.querySelectorAll("label")].map(l => l.textContent)).toEqual(["익시오", "에이닷", "기본 전화 앱", "다른 녹음 앱"]);
  act(() => (host.querySelector("input[type=radio]") as HTMLInputElement).click());
  await act(async () => button("항상 이 앱으로").click());
  expect(write).toHaveBeenCalledWith("010-0000-1234");
  expect(fetchMock).toHaveBeenCalledWith("/api/calls", expect.objectContaining({ method: "POST" }));
  expect(dialed).toHaveBeenCalledWith(expect.objectContaining({ id: "call-1", leadId: row.id }));
  expect(readCallApp()).toBe("ixio");
  expect(host.textContent).toContain("번호를 복사했어요. 익시오를 열어");
  expect(host.textContent).toContain("가상기계에 익시오로 걸게요");
  expect(host.textContent).toContain("전화 버튼은 항상 익시오로 걸어요");
});

it("기록이 실패하면 안내하고 닫지 않는다", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "없는 기능이에요" }), { status: 404 }));
  const close = vi.fn();
  await act(async () => root.render(createElement(CallDialDialog, { row, onDialed: vi.fn(), onClose: close })));
  act(() => ([...host.querySelectorAll("input[type=radio]")][3] as HTMLInputElement).click());
  await act(async () => button("이번만").click());
  expect(host.textContent).toContain("없는 기능이에요");
  expect(close).not.toHaveBeenCalled();
  expect(readCallApp()).toBeNull();
});

it("녹음 올리기: 고른 파일을 확인하고, 다른 번호면 한 번 묻고, 올리면 그 통화에 붙인다", async () => {
  fetchMock.mockResolvedValue(ok({ ok: true }));
  const uploaded = vi.fn(), close = vi.fn();
  const call = { id: "call-1", leadId: row.id, status: "dialed", calledAt: new Date(DIALED).toISOString() } as never;
  await act(async () => root.render(createElement(CallUploadDialog, { row, call, asked: true, onUploaded: uploaded, onClose: close })));
  expect(host.textContent).toContain("방금 가상기계와 통화하셨나요?");
  expect(button("나중에 올릴게요")).toBeDefined();
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  const pick = (name: string) => act(() => {
    Object.defineProperty(input, "files", { value: [new File(["x"], name, { lastModified: DIALED + 60_000 })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await pick("통화 녹음 010-0000-5678_261103.m4a");
  expect(host.textContent).toContain("010-0000-5678 통화예요");
  expect(button("이 녹음이 맞아요")).toBeDefined();
  await pick("통화 녹음 010-0000-1234_261103.m4a");
  expect(host.textContent).toContain("일치");
  await act(async () => button("정리 시작").click());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]![0]).toBe("/api/calls/call-1/upload");
  expect(uploaded).toHaveBeenCalledWith("call-1");
  expect(close).toHaveBeenCalled();
});

it("📞 없이 올리면 녹음 저장 시각으로 통화를 먼저 기록한다", async () => {
  fetchMock.mockResolvedValueOnce(ok({ id: "new-call" })).mockResolvedValueOnce(ok({ ok: true }));
  await act(async () => root.render(createElement(CallUploadDialog, { row, call: null, asked: false, onUploaded: vi.fn(), onClose: vi.fn() })));
  expect(host.textContent).toContain("가상기계 통화 녹음 올리기");
  expect(button("나중에 올릴게요")).toBeUndefined();
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  const at = Date.now() - 60 * 60_000;
  act(() => {
    Object.defineProperty(input, "files", { value: [new File(["x"], "녹음.m4a", { lastModified: at })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => button("정리 시작").click());
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({ leadId: row.id, calledAt: new Date(at).toISOString() });
  expect(fetchMock.mock.calls[1]![0]).toBe("/api/calls/new-call/upload");
});

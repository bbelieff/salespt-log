// @vitest-environment jsdom
/** 통화 정리 앞단(PR-5a) — 파일 확인 규칙, 칩, 앱 고르기·녹음 올리기 대화상자. 가상 업체·번호만. */
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { callChip, checkRecording, eul, euro, latestCallByLead, readCallApp, readCallNotice, readDefaultReady, saveCallApp, saveCallNotice } from "@/app/(app)/db-sheet/_components/call-client";
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
  expect(checkRecording(f("녹음.amr"), row.phone, DIALED).fileError).toBe("통화 녹음이나 통화 내용 파일이 아니에요");
  // 받아쓴 통화 내용(.txt·.pdf)도 같은 확인 — 번호·시각은 그대로, 크기는 5MB 까지.
  expect(checkRecording(f("통화 010-0000-1234.txt"), row.phone, DIALED)).toMatchObject({ fileError: "", phoneMatch: true, warn: "" });
  expect(checkRecording(f("통화내용.pdf"), row.phone, DIALED).fileError).toBe("");
  expect(checkRecording(f("통화내용.pdf", DIALED, 6 * 1024 * 1024), row.phone, DIALED).fileError).toContain("5MB");
  expect(checkRecording(f("녹음.m4a", DIALED, 15 * 1024 * 1024), row.phone, DIALED).fileError).toContain("14MB");
});

it("상태 칩과 업체별 최근 통화", () => {
  expect(callChip("dialed")?.label).toBe("녹음 필요");
  expect(callChip("processing")?.label).toBe("정리 중");
  expect(callChip("review")?.label).toBe("확인 필요");
  expect(callChip("failed")?.label).toBe("정리 실패");
  expect(callChip("confirmed")).toBeNull();
  const latest = latestCallByLead([{ id: "b", leadId: "L" }, { id: "a", leadId: "L" }] as never);
  expect(latest.get("L")?.id).toBe("b");
  expect([eul("익시오"), eul("에이닷"), euro("에이닷"), euro("기본 전화 앱"), euro("다른 녹음 앱")]).toEqual(["익시오를", "에이닷을", "에이닷으로", "기본 전화 앱으로", "다른 녹음 앱으로"]);
  saveCallApp("adot"); expect(readCallApp()).toBe("adot");
  saveCallApp(null); expect(readCallApp()).toBeNull();
  localStorage.setItem("db-sheet-call-app", "evil"); expect(readCallApp()).toBeNull();
});

it("앱 고르기: 앱 이름만, 누르면 바로 — 「다음에도 이 앱으로」(기본 켬)면 저장, 번호 복사 → 기록 → 안내", async () => {
  const write = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
  fetchMock.mockResolvedValue(ok({ id: "call-1" }));
  const dialed = vi.fn();
  await act(async () => root.render(createElement(CallDialDialog, { row, onDialed: dialed, onClose: vi.fn() })));
  expect([...host.querySelectorAll(".dbs-call-apps button")].map(b => b.textContent)).toEqual(["익시오", "에이닷", "기본 전화 앱", "다른 녹음 앱"]);
  expect((host.querySelector("input[type=checkbox]") as HTMLInputElement).checked).toBe(true);
  // 익시오는 기본 통화 앱으로 정하면 tel: 로 열린다 — 처음 한 번 바꾸는 길을 보여 주고, 아직이면 번호만 복사.
  await act(async () => button("익시오").click());
  expect(host.textContent).toContain("처음 한 번만 바꿔 주세요");
  expect(host.textContent).toContain("기본 앱 선택 › 전화 앱 › 익시오");
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => button("번호만 복사").click());
  expect(readDefaultReady("ixio")).toBe(false);
  expect(write).toHaveBeenCalledWith("010-0000-1234");
  expect(fetchMock).toHaveBeenCalledWith("/api/calls", expect.objectContaining({ method: "POST" }));
  expect(dialed).toHaveBeenCalledWith(expect.objectContaining({ id: "call-1", leadId: row.id }));
  expect(readCallApp()).toBe("ixio");
  expect(host.textContent).toContain("번호를 복사했어요");
  expect(host.textContent).toContain("익시오를 열고 붙여 넣어 거세요");
  expect(host.textContent).toContain("늘 익시오로 걸어요");
});

it("익시오를 기본 통화 앱으로 바꿨으면 tel: 로 바로 걸고, 그 뒤로는 묻지 않는다 (2026-11-05 belie)", async () => {
  fetchMock.mockResolvedValue(ok({ id: "call-2" }));
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
  const hrefs: string[] = [];
  const loc = window.location;
  Object.defineProperty(window, "location", { configurable: true, value: { ...loc, set href(v: string) { hrefs.push(v); } } });
  const close = vi.fn();
  await act(async () => root.render(createElement(CallDialDialog, { row, onDialed: vi.fn(), onClose: close })));
  await act(async () => button("에이닷").click());
  await act(async () => button("바꿨어요, 걸기").click());
  expect(readDefaultReady("adot")).toBe(true);
  expect(readCallApp()).toBe("adot");
  expect(hrefs).toEqual(["tel:01000001234"]);
  expect(close).toHaveBeenCalled();
  Object.defineProperty(window, "location", { configurable: true, value: loc });
});

it("기록이 실패하면 안내하고 닫지 않는다", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "없는 기능이에요" }), { status: 404 }));
  const close = vi.fn();
  await act(async () => root.render(createElement(CallDialDialog, { row, onDialed: vi.fn(), onClose: close })));
  act(() => (host.querySelector("input[type=checkbox]") as HTMLInputElement).click());
  await act(async () => button("다른 녹음 앱").click());
  expect(host.textContent).toContain("없는 기능이에요");
  expect(close).not.toHaveBeenCalled();
  expect(readCallApp()).toBeNull();
});

it("녹음 올리기: 고른 파일을 확인하고, 다른 번호면 한 번 묻고, 올리면 그 통화에 붙인다", async () => {
  saveCallNotice();
  fetchMock.mockResolvedValue(ok({ ok: true }));
  const uploaded = vi.fn(), close = vi.fn();
  const call = { id: "call-1", leadId: row.id, status: "dialed", calledAt: new Date(DIALED).toISOString() } as never;
  await act(async () => root.render(createElement(CallUploadDialog, { row, call, asked: true, onUploaded: uploaded, onClose: close })));
  expect(host.textContent).toContain("방금 가상기계와 통화하셨나요?");
  expect(button("나중에")).toBeDefined();
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  const pick = (name: string) => act(() => {
    Object.defineProperty(input, "files", { value: [new File(["x"], name, { lastModified: DIALED + 60_000 })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await pick("통화 녹음 010-0000-5678_261103.m4a");
  expect(host.textContent).toContain("번호가 달라요");
  expect(host.textContent).toContain("녹음 010-0000-5678 · 업체 010-0000-1234");
  expect(button("그래도 올리기")).toBeDefined();
  await pick("통화 녹음 010-0000-1234_261103.m4a");
  expect(host.textContent).toContain("가상기계 통화가 맞아요");
  await act(async () => button("올리기").click());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]![0]).toBe("/api/calls/call-1/upload");
  expect(uploaded).toHaveBeenCalledWith("call-1");
  expect(close).toHaveBeenCalled();
});

it("안드로이드: 기본 전화 앱은 Recordings › Call, 익시오·에이닷은 앱에서 저장하라고 안내한다", async () => {
  // jsdom 기본 userAgent 는 아이폰이 아님 = 안드로이드 쪽 안내.
  await act(async () => root.render(createElement(CallUploadDialog, { row, call: null, asked: false, onUploaded: vi.fn(), onClose: vi.fn() })));
  expect(host.textContent).toContain("내 파일 › Recordings › Call");
  expect(host.textContent).not.toContain("받아쓴 글 붙여 넣기");
  act(() => root.unmount()); root = createRoot(host);
  saveCallApp("ixio");
  await act(async () => root.render(createElement(CallUploadDialog, { row, call: null, asked: false, onUploaded: vi.fn(), onClose: vi.fn() })));
  expect(host.textContent).toContain("익시오에서 녹음이나 통화 내용(.txt·.pdf)을 폰에 저장한 뒤 골라 주세요");
  expect(host.textContent).not.toContain("Recordings");
  expect(button("녹음 대신 받아쓴 글 붙여 넣기")).toBeDefined();
});

it("📞 없이 올리면 녹음 저장 시각으로 통화를 먼저 기록한다", async () => {
  saveCallNotice();
  fetchMock.mockResolvedValueOnce(ok({ id: "new-call" })).mockResolvedValueOnce(ok({ ok: true }));
  await act(async () => root.render(createElement(CallUploadDialog, { row, call: null, asked: false, onUploaded: vi.fn(), onClose: vi.fn() })));
  expect(host.textContent).toContain("가상기계 녹음 올리기");
  expect(button("나중에")).toBeUndefined();
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  const at = Date.now() - 60 * 60_000;
  act(() => {
    Object.defineProperty(input, "files", { value: [new File(["x"], "녹음.m4a", { lastModified: at })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => button("올리기").click());
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({ leadId: row.id, calledAt: new Date(at).toISOString() });
  expect(fetchMock.mock.calls[1]![0]).toBe("/api/calls/new-call/upload");
});

it("첫 업로드 고지: 확인 전에는 아무것도 보내지 않고, [취소]는 그대로, [확인하고 올리기]는 기록하고 올린다", async () => {
  fetchMock.mockResolvedValue(ok({ ok: true }));
  const uploaded = vi.fn();
  const call = { id: "call-1", leadId: row.id, status: "dialed", calledAt: new Date(DIALED).toISOString() } as never;
  await act(async () => root.render(createElement(CallUploadDialog, { row, call, asked: false, onUploaded: uploaded, onClose: vi.fn() })));
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  act(() => {
    Object.defineProperty(input, "files", { value: [new File(["x"], "통화 녹음 010-0000-1234.m4a", { lastModified: DIALED + 60_000 })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => button("올리기").click());
  expect(fetchMock).not.toHaveBeenCalled();
  expect(host.textContent).toContain("처음 한 번만 확인해 주세요");
  expect(host.textContent).toContain("Google AI");
  act(() => button("취소").click());
  expect(host.textContent).not.toContain("처음 한 번만");
  expect(readCallNotice()).toBe(false);
  await act(async () => button("올리기").click());
  await act(async () => button("확인하고 올리기").click());
  expect(readCallNotice()).toBe(true);
  expect(fetchMock.mock.calls[0]![0]).toBe("/api/calls/call-1/upload");
  expect(uploaded).toHaveBeenCalledWith("call-1");
  localStorage.setItem("db-sheet-call-notice", "0"); expect(readCallNotice()).toBe(false);
});

it("받아쓴 통화 내용 .txt 를 고르면 글만 뽑아 글자로 올린다", async () => {
  saveCallNotice();
  fetchMock.mockResolvedValue(ok({ ok: true }));
  const call = { id: "call-1", leadId: row.id, status: "dialed", calledAt: new Date(DIALED).toISOString() } as never;
  await act(async () => root.render(createElement(CallUploadDialog, { row, call, asked: false, onUploaded: vi.fn(), onClose: vi.fn() })));
  expect((host.querySelector("input[type=file]") as HTMLInputElement).accept).toContain(".txt");
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  act(() => {
    Object.defineProperty(input, "files", { value: [new File(["나: 안녕하세요\n상대: 네"], "통화 010-0000-1234.txt", { lastModified: DIALED + 60_000 })], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.textContent).toContain("가상기계 통화가 맞아요");
  await act(async () => button("올리기").click());
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/calls/call-1/upload");
  expect(JSON.parse(String(init.body))).toEqual({ text: "나: 안녕하세요\n상대: 네" });
});

it("통화 정리 확인: 결과를 골라야 확정, 체크한 칸만 보내고, 409 면 문구를 보여 주고 닫지 않는다", async () => {
  const { CallConfirmScreen } = await import("@/app/(app)/db-sheet/_components/CallConfirmScreen");
  const { CallExtraction } = await import("@/types/call");
  const { DbSheetContact } = await import("@/types/db-sheet");
  const extraction = CallExtraction.parse({ answered: [11], company: { 신용점수: "780", 소재지: "합성시 새주소" }, memo: "AI 메모", evidence: { 신용점수: "상대: 780점" } });
  const lead = { ...row, revision: 7, contact: DbSheetContact.parse({ note: "옛 메모", ci: { 소재지: "합성시 옛주소" } }) } as never;
  const call = { id: "call-9", leadId: row.id, status: "review", calledAt: "2026-11-03T05:00:00Z", transcript: "", extraction } as never;
  const saved = vi.fn(), close = vi.fn();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "다른 화면에서 이 DB 가 바뀌었어요. 새로고침한 뒤 다시 확정해 주세요." }), { status: 409 }));
  await act(async () => root.render(createElement(CallConfirmScreen, { lead, call, onSaved: saved, onClose: close })));
  const save = button("저장하기");
  expect(save.disabled).toBe(true);
  expect(host.textContent).toContain("컨택결과를 골라 주세요");
  expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("옛 메모\n\nAI 메모");
  const select = host.querySelector("select[aria-label=컨택결과]") as HTMLSelectElement;
  act(() => { select.value = "재통화"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(save.disabled).toBe(false);
  await act(async () => save.click());
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/calls/call-9/confirm");
  expect(JSON.parse(String(init.body))).toMatchObject({ revision: 7, date: "2026-11-03", result: "재통화", company: { 신용점수: "780" }, meeting: null });
  expect(JSON.parse(String(init.body)).company.소재지).toBeUndefined();
  expect(host.textContent).toContain("다른 화면에서 이 DB 가 바뀌었어요");
  expect(saved).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(ok({ lead: {} }));
  await act(async () => button("저장하기").click());
  expect(saved).toHaveBeenCalledOnce();
});

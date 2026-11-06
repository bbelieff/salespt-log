// @vitest-environment jsdom
/**
 * 미팅 잡은 업체도 DB정보에서 업체정보를 고친다(2026-11-07 belie 「윈디 팝업 2번」).
 * 고친 값은 미팅에 바로 저장(PATCH /api/meeting/:id 와 같은 usePatchMeeting) — DB 줄은 미팅을 보여 주는 읽기 전용이라.
 * 업체명·미팅날짜/시간은 그대로 잠금. 합성 데이터만.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import { blank } from "@/app/(app)/db-sheet/_components/model";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const mutateAsync = vi.fn(async () => ({ ok: true }));
vi.mock("@/query/contact-hooks", () => ({ usePatchMeeting: () => ({ mutateAsync }) }));
vi.mock("@/components/DirtyGuard", () => ({ useDirtyEntry: () => undefined }));
vi.mock("@/components/meeting-safety/DeletedMeetings", () => ({ default: () => null }));
// 업체정보 편집기는 자리만 — 「고치기」 버튼이 onSave 를 부른다(편집기 자체 동작은 다른 시험이 본다).
vi.mock("@/components/CompanyInfoEditor", () => ({
  default: ({ value, onChange, onSave }: { value: { 소재지?: string }; onChange: (v: unknown) => void; onSave: (v: unknown) => void }) =>
    h("div", { "data-editor": true }, h("output", null, value.소재지 ?? ""), h("button", { type: "button", onClick: () => { const v = { ...value, 소재지: "가상시 가상구 1" }; onChange(v); onSave(v); } }, "고치기")),
}));

const { ContactPanel, contactDraft } = await import("@/app/(app)/db-sheet/_components/ContactPanel");
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); mutateAsync.mockClear(); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function render(registered: boolean, onMeetingSaved = vi.fn()) {
  const row = { ...blank(), company: "가상상회", meetingId: registered ? "m-1" : undefined, effectiveMeetingId: registered ? "m-2" : undefined };
  const draft = { ...contactDraft(row), registered, ci: CompanyInfo.parse({ 소재지: "가상시 1" }), date: "2026-11-07" };
  act(() => root.render(h(ContactPanel, { row, draft, onChange: vi.fn(), onResult: vi.fn(), onRegister: vi.fn(), onCompany: vi.fn(), onMeetingSaved })));
  return onMeetingSaved;
}

describe("미팅 잡은 업체 — 업체정보만 열리고 미팅에 저장", () => {
  it("업체정보 편집기는 잠기지 않고, 업체명·미팅 칸은 잠김", () => {
    render(true);
    const editor = host.querySelector("[data-editor]")!;
    expect(editor.closest("fieldset[disabled]")).toBeNull();
    expect(host.querySelector<HTMLInputElement>('[aria-label="확인한 업체명"]')!.closest("fieldset")!.disabled).toBe(true);
    expect(host.querySelector('[aria-label="미팅예약"]')!.closest("fieldset")!.disabled).toBe(true);
  });
  it("고치면 지금 미팅(이어진 미팅 id)에 업체정보만 저장하고 시트를 다시 읽는다", async () => {
    const saved = render(true);
    await act(async () => (host.querySelector("[data-editor] button") as HTMLButtonElement).click());
    await flush();
    expect(mutateAsync).toHaveBeenCalledWith({ id: "m-2", partial: { 업체정보: expect.objectContaining({ 소재지: "가상시 가상구 1" }) }, date: "2026-11-07" });
    expect(saved).toHaveBeenCalled();
    expect(host.querySelector("[data-editor] output")!.textContent).toBe("가상시 가상구 1");
  });
  it("미팅 전 업체는 예전대로 DB 줄 초안에 저장(미팅 저장 없음)", async () => {
    render(false);
    expect(host.querySelector("[data-editor]")!.closest("fieldset[disabled]")).toBeNull();
    await act(async () => (host.querySelector("[data-editor] button") as HTMLButtonElement).click());
    await flush();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

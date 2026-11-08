// @vitest-environment jsdom
/**
 * 미팅예약을 골랐거나 미팅 날짜·시간을 채우면 스스로 [예약 등록](2026-11-08 belie 「미팅예약인데 STEP 3 누락 0건」).
 * 예전에 채워 두기만 한 칸(이번에 손대지 않음)은 자동 등록하지 않고 안내만 — 일별 기록에 따로 잡은 미팅과 겹칠 수 있다. 합성 데이터만.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import { blank } from "@/app/(app)/db-sheet/_components/model";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/query/contact-hooks", () => ({ usePatchMeeting: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/components/DirtyGuard", () => ({ useDirtyEntry: () => undefined }));
vi.mock("@/components/meeting-safety/DeletedMeetings", () => ({ default: () => null }));
vi.mock("@/components/CompanyInfoEditor", () => ({ default: () => null }));
// 날짜·시간 칸은 자리만 — 버튼이 값을 채운다.
vi.mock("@/app/(app)/contact/_components/MeetingSlotForm", () => ({
  DateTimeRow: ({ onDate, onTime }: { onDate: (v: string) => void; onTime: (v: string) => void }) =>
    h("div", null, h("button", { type: "button", onClick: () => onDate("2026-11-12") }, "날짜"), h("button", { type: "button", onClick: () => onTime("15:00") }, "시간")),
  FieldNote: () => null,
}));

const { ContactPanel, contactDraft } = await import("@/app/(app)/db-sheet/_components/ContactPanel");
type Draft = ReturnType<typeof contactDraft>;
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.useFakeTimers(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

function mount(opts: { result?: string; book?: boolean; draft?: Partial<Draft> }) {
  const row = { ...blank(), company: "가상상회", result: opts.result ?? "미컨택", meetingId: null };
  let draft: Draft = { ...contactDraft(row), ci: CompanyInfo.parse({ 소재지: "가상시 1" }), date: "2026-11-08", ...opts.draft };
  const onRegister = vi.fn();
  const render = () => root.render(h(ContactPanel, { row, draft, book: opts.book, onChange: (v: Draft) => { draft = v; render(); }, onResult: vi.fn(), onRegister, onCompany: vi.fn() }));
  act(render);
  return onRegister;
}
const click = (label: string) => act(() => { [...host.querySelectorAll("button")].find(b => b.textContent === label)!.click(); });
const text = () => host.textContent ?? "";

it("미팅예약을 고르면 미팅 칸이 열리고, 날짜·시간을 채우면 1.2초 뒤 스스로 예약 등록", () => {
  const onRegister = mount({ book: true });
  expect(text()).toContain("미팅 일정·시간 칸을 채우면 바로 예약돼요");
  click("날짜"); click("시간");
  expect(text()).toContain("곧 예약돼요");
  act(() => { vi.advanceTimersByTime(1100); });
  expect(onRegister).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(200); });
  expect(onRegister).toHaveBeenCalledTimes(1);
});

it("미팅예약을 안 골라도 이번에 날짜·시간을 채우면 예약 등록", () => {
  const onRegister = mount({});
  click("미팅예약"); click("날짜"); click("시간");
  act(() => { vi.advanceTimersByTime(1300); });
  expect(onRegister).toHaveBeenCalledTimes(1);
});

it("예전에 미팅예약만 저장되고 칸이 채워진 줄은 자동 등록하지 않고 [예약 등록]을 안내", () => {
  const onRegister = mount({ result: "컨택진행", draft: { meetingDate: "2026-11-05", time: "15:00" } });
  act(() => { vi.advanceTimersByTime(3000); });
  expect(onRegister).not.toHaveBeenCalled();
  expect(text()).toContain("아직 일정에 안 들어갔어요 · [예약 등록]을 눌러 주세요");
});

it("소재지가 비면 무엇이 빠졌는지 알려 주고 등록하지 않는다", () => {
  const onRegister = mount({ book: true, draft: { ci: CompanyInfo.parse({}) } });
  click("날짜"); click("시간");
  act(() => { vi.advanceTimersByTime(3000); });
  expect(onRegister).not.toHaveBeenCalled();
  expect(text()).toContain("소재지 칸을 채우면 바로 예약돼요");
});

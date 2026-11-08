// @vitest-environment jsdom
/**
 * 미팅 등록 확인 카드(2026-11-08 belie) — STEP 3 에 들어갔다는 사실 · 기록 내용 · 고치는 길. 합성 데이터만.
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
vi.mock("@/app/(app)/contact/_components/MeetingSlotForm", () => ({ DateTimeRow: () => null, FieldNote: () => null }));

const { ContactPanel, contactDraft } = await import("@/app/(app)/db-sheet/_components/ContactPanel");
const { meetingWhen } = await import("@/app/(app)/db-sheet/_components/MeetingBookedCard");
type Draft = ReturnType<typeof contactDraft>;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const unbooked = { ...blank(), id: "lead-1", company: "가상상회", channel: "매입DB", result: "미컨택", meetingId: null as string | null, stage: "" };
const booked = { ...unbooked, result: "컨택진행", meetingId: "m-1", stage: "미팅예약" };
const draftOf = (registered: boolean): Draft => ({ ...contactDraft(unbooked), registered, ci: CompanyInfo.parse({ 소재지: "가상시 1" }), place: "가상시 1", date: "2026-11-08", meetingDate: "2026-11-12", time: "15:00", reservationNote: "지참서류 확인" });
const render = (row: typeof unbooked, draft: Draft) => act(() => root.render(h(ContactPanel, { row, draft, onChange: vi.fn(), onResult: vi.fn(), onRegister: vi.fn(), onCompany: vi.fn() })));
const card = () => host.querySelector('[aria-label="미팅 등록 확인"]');

it("미팅 날짜는 「11/12(목) 15:00」으로", () => {
  expect(meetingWhen("2026-11-12", "15:00")).toBe("11/12(목) 15:00");
  expect(meetingWhen("", "")).toBe("날짜 미정");
});

it("등록된 미팅은 STEP 3 에 들어갔다는 것과 기록 내용·고치는 길을 보여 준다", () => {
  render(booked, draftOf(true));
  const c = card()!;
  expect(c.textContent).toContain("STEP 3 일정에 등록돼 있어요");
  expect(c.textContent).toContain("11/12(목) 15:00");
  expect(c.textContent).toContain("가상시 1");
  expect(c.textContent).toContain("지참서류 확인");
  expect(c.textContent).toContain("11/8(일) 매입DB · 컨택진행 +1 · 미팅예약 +1");
  const links = [...c.querySelectorAll("a")].map(a => [a.textContent, a.getAttribute("href")]);
  expect(links).toEqual([
    ["날짜·시간 고치기", "/schedule?date=2026-11-12&focus=m-1&edit=schedule"],
    ["STEP 3 일정에서 보기 →", "/schedule?date=2026-11-12&focus=m-1"],
  ]);
  expect(c.className).not.toContain("is-just");
});

it("이 화면에서 방금 등록되면 「방금 등록됐어요」로 강조", () => {
  render(unbooked, draftOf(false));
  expect(card()).toBeNull();
  render(booked, draftOf(true));
  expect(card()!.textContent).toContain("방금 STEP 3 일정에 등록됐어요");
  expect(card()!.className).toContain("is-just");
});

it("일별 기록을 끈 DB 는 숫자가 안 올라간다고 알려 준다", () => {
  render({ ...booked, recording: { inflow: true, activities: false } } as typeof booked, draftOf(true));
  expect(card()!.textContent).toContain("일별 기록 꺼짐");
});

it("미팅이 삭제된 줄에는 카드를 띄우지 않는다", () => {
  render({ ...booked, stage: "미팅 삭제됨" }, draftOf(true));
  expect(card()).toBeNull();
});

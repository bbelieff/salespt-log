// @vitest-environment jsdom
/** 주간 보드 미팅 창 — 업체정보 요약(기본 보기 항목)·입력칸 중복 없음·결과 난 미팅의 업체명 고치기 (2026-11-16). */
import * as React from "react";
import { readFileSync } from "node:fs";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import BoardCompanyRoute from "@/app/(app)/schedule/_components/board/BoardCompanyRoute";
import MeetingNameFix from "@/app/(app)/schedule/_components/board/MeetingNameFix";
import { CompanyInfo } from "@/types";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const h = React.createElement;
const mount = (el: React.ReactElement) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  React.act(() => root.render(el));
  return { host, done: () => { React.act(() => root.unmount()); host.remove(); } };
};
const info = CompanyInfo.parse({ 대표자이름: "홍가상", 신용점수: "919/855", 사업자구분: "법인", 과세유형: "일반과세", 주생산품목: "포장용 필름", 금년도매출: "1,200", 매출기준연도: "2026", 기대출사업자: "신보 100백만" });
const click = (host: HTMLElement, text: string) => React.act(() => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!.click());

it("업체정보 요약은 기본 보기의 [대표자]·[사업자] 항목을 모두 목록으로 보여 준다", () => {
  const { host, done } = mount(h(BoardCompanyRoute, { meetingId: "m1", place: "", info, editing: false, onEdit: vi.fn(), onSaveAddress: vi.fn() }));
  click(host, "업체정보");
  const labels = [...host.querySelectorAll("#wb-qinfo dt")].map((d) => d.textContent);
  expect(labels).toEqual(["이름", "신용점수", "기대출 개인", "개업일", "사업자 구분", "업종", "아이템", "연매출", "사업자 대출", "4대보험 직원", "특허 및 인증", "소재지", "기타메모"]);
  const text = host.querySelector("#wb-qinfo")!.textContent!;
  expect(text).toContain("법인 · 일반과세");
  expect(text).toContain("Y(2026) 1,200");
  expect(text).toContain("신보 100백만");
  done();
});

it("입력칸이 열려 있으면 요약 목록은 그리지 않는다 — 같은 내용이 두 번 보이지 않게", () => {
  const onEdit = vi.fn();
  const { host, done } = mount(h(BoardCompanyRoute, { meetingId: "m1", place: "", info, editing: true, onEdit, onSaveAddress: vi.fn() }));
  expect(host.querySelector(".wb-qbox")).toBeNull();
  click(host, "업체정보"); // 입력칸을 닫고 요약으로
  expect(onEdit).toHaveBeenCalledTimes(1);
  done();
});

it("결과가 난 미팅의 업체명·장소 고치기 — 바뀐 값만 저장한다", async () => {
  const onSave = vi.fn(), onCancel = vi.fn();
  const { host, done } = mount(h(MeetingNameFix, { name: "법인", place: "가상시 1", contract: true, pending: false, onSave, onCancel }));
  expect(host.textContent).toContain("실무/수납의 계약 업체명도 함께 바뀌어요");
  const input = host.querySelector("input")!;
  React.act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "주식회사가상");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await React.act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(onSave).toHaveBeenCalledWith({ 업체명: "주식회사가상" });
  expect(onCancel).toHaveBeenCalled();
  done();
});

it("미팅 창 배선 — 넓은 1열 입력칸, 결과 난 미팅에 고치기 줄, 계약 미팅 이름은 장부도 함께", () => {
  const pop = readFileSync("app/(app)/schedule/_components/board/BoardMeetingPop.tsx", "utf8");
  expect(pop).toContain("useBoardPopWide(ciEdit)");
  expect(pop).toContain("hideSave stacked");
  expect(pop).toContain("업체명·장소 고치기");
  const patch = readFileSync("app/(app)/schedule/_lib/useMeetingPatch.ts", "utf8");
  expect(patch).toMatch(/editLinked\.mutateAsync\(\{\s*meetingId: id, old: \{ 계약일: prevMeeting\.미팅날짜, 업체명: prevMeeting\.업체명 \}, next: \{ 업체명: newName \}/);
});

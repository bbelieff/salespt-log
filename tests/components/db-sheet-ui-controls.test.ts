// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InflowStatusCell from "@/app/(app)/db-sheet/_components/InflowStatusCell";
import { DbDetail } from "@/app/(app)/db-sheet/_components/DbDetail";
import { blank } from "@/app/(app)/db-sheet/_components/model";
import { contactDraft } from "@/app/(app)/db-sheet/_components/ContactPanel";
import PeriodPicker from "@/components/ui/PeriodPicker";
import { DbContactActions } from "@/app/(app)/db-sheet/_components/DbContactActions";
import SupplierFilter from "@/app/(app)/db-sheet/_components/SupplierFilter";
import { outcomeLabel } from "@/app/(app)/db-sheet/_components/model";
import { recordsDbSheetFirstContact } from "@/types/db-sheet";
vi.mock("@/components/CompanyInfoEditor", () => ({ default: () => React.createElement("div", null, "합성 업체정보") }));
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const row = { ...blank(), company: "합성 회사", date: "2026-10-17", inflowStatus: { state: "recorded" as const, count: 1 as const } };
beforeEach(() => { localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); });
const click = (element: Element) => act(() => (element as HTMLElement).click());
it("table inflow badge only opens DB information without opening a second dialog", () => {
  const open = vi.fn(); act(() => root.render(React.createElement(InflowStatusCell, { row, onOpen: open })));
  click(host.querySelector("button")!);
  expect(open).toHaveBeenCalledOnce(); expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(host.querySelectorAll("[role=radio]")).toHaveLength(0);
});
it("keeps the acknowledged inflow state and blocks duplicate input until a failed save restores availability", async () => {
  let reject!: (reason: Error) => void;
  const toggle = vi.fn(() => new Promise<void>((_, no) => { reject = no; }));
  act(() => root.render(React.createElement(InflowStatusCell, { row, onToggle: toggle })));
  const buttons = host.querySelectorAll<HTMLButtonElement>("[role=radio]");
  expect(buttons).toHaveLength(2); click(buttons[1]!); click(buttons[1]!);
  expect(toggle).toHaveBeenCalledTimes(1); expect(buttons[0]!.getAttribute("aria-checked")).toBe("true");
  expect(buttons[0]!.disabled && buttons[1]!.disabled).toBe(true);
  await act(async () => reject(new Error("합성 저장 실패")));
  expect(host.querySelector("[role=alert]")!.textContent).toContain("합성 저장 실패");
  expect(buttons[0]!.getAttribute("aria-checked")).toBe("true"); expect(buttons[1]!.disabled).toBe(false);
});
it("renders one contact result and one header inflow editor, without the old explicit contact button", () => {
  const noop = vi.fn();
  act(() => root.render(React.createElement(DbDetail, { row, draft: contactDraft(row), onChange: noop, onEdit: noop, onResult: noop, onRegister: noop, onOpen: noop, onClose: noop, onDelete: noop, onAsInfo: noop, onInflowChange: async () => {} })));
  click(host.querySelector(".db-contact-open")!);
  expect(host.querySelectorAll('[aria-label="DB정보 컨택결과"]')).toHaveLength(1);
  expect(host.querySelector('[aria-label="컨택내용 결과"]')).toBeNull();
  expect([...host.querySelectorAll("button")].some(e => e.textContent === "이 날짜로 상담 기록")).toBe(false);
  expect(host.querySelectorAll('.db-detail-header [role="radiogroup"]')).toHaveLength(1);
  expect(host.querySelector('.db-info-pane [role="radiogroup"]')).toBeNull();
});
it("can reserve custom date inputs for a separate popover while preserving the shared default", () => {
  const props = { period: "custom" as const, from: "", to: "", onFrom: vi.fn(), onTo: vi.fn(), onPeriod: vi.fn() };
  act(() => root.render(React.createElement(PeriodPicker, { ...props, showRangeInputs: false })));
  expect(host.querySelectorAll("input")).toHaveLength(0);
  act(() => root.render(React.createElement(PeriodPicker, props)));
  expect(host.querySelectorAll("input")).toHaveLength(2);
});

it("shows accounting guidance on each option while keeping AS storage and date policy unchanged",()=>{
 const props={row,date:'2026-10-17',contact:false,onResult:vi.fn(),onAsInfo:vi.fn(),onToggleContact:vi.fn()};
 act(()=>root.render(React.createElement(DbContactActions,props)));
 const options=[...host.querySelectorAll('option')];
 for(const option of options)expect(option.textContent).toBe(outcomeLabel(option.value,true));
 const as=options.find(option=>option.value==='AS예정')!;expect(as.textContent).toContain('AS신청');expect(as.textContent).toContain('집계 제외');
 expect(options.find(option=>option.value==='컨택진행')!.textContent).toContain('STEP 2');
 act(()=>root.render(React.createElement(DbContactActions,{...props,row:{...row,recording:{inflow:true,activities:false}}})));
 expect([...host.querySelectorAll('option')].every(option=>option.textContent===outcomeLabel(option.value,false))).toBe(true);
 expect(recordsDbSheetFirstContact('AS예정')).toBe(false);
});

it("treats a missing projection as an explicit response error, never as a third state or guessed OFF",()=>{
 const toggle=vi.fn(async()=>{});act(()=>root.render(React.createElement(InflowStatusCell,{row:{...row,inflowStatus:undefined},onToggle:toggle})));
 expect(host.querySelector('[role=alert]')!.textContent).toContain('불러오지 못했습니다');expect(host.querySelectorAll('[role=radio]')).toHaveLength(0);expect(host.textContent).not.toMatch(/확인 필요|유입\?/);expect(toggle).not.toHaveBeenCalled();
});

it("includes blank and long suppliers, supports all/clear, and closes its portal on Escape",()=>{
 const change=vi.fn(),options=['','가상 공급처 이름이 매우 길어도 원래 값을 보존','합성 B'];
 act(()=>root.render(React.createElement(SupplierFilter,{options,selected:[],onChange:change})));
 const trigger=host.querySelector('button')!;click(trigger);
 const panel=document.querySelector('[aria-label="공급처 다중선택"]')!;expect(panel.parentElement).toBe(document.body);
 expect(panel.textContent).toContain('공급처 미입력');
 const buttons=[...panel.querySelectorAll('button')];click(buttons.find(button=>button.textContent?.startsWith('모두 선택'))!);expect(change).toHaveBeenLastCalledWith(options);
 click(buttons.find(button=>button.textContent==='선택 해제')!);expect(change).toHaveBeenLastCalledWith([]);
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[aria-label="공급처 다중선택"]')).toBeNull();expect(document.activeElement).toBe(trigger);
});

it("keeps total width while the center grip consumes left slack before growing the shell",()=>{
 const noop=vi.fn(),props={row,draft:contactDraft(row),onChange:noop,onEdit:noop,onResult:noop,onRegister:noop,onOpen:noop,onClose:noop,onDelete:noop,onAsInfo:noop,onInflowChange:async()=>{}};
 Object.defineProperty(window,'innerWidth',{configurable:true,value:1280});
 act(()=>root.render(React.createElement(DbDetail,props)));click(host.querySelector('.db-contact-open')!);
 const shell=host.querySelector<HTMLElement>('.db-detail-shell')!;
 const widths=()=>[shell.style.getPropertyValue('--db-left-width'),shell.style.getPropertyValue('--db-right-width')];
 // 2026-10-23: 업체정보(우열) 기본 680 — 1280 에서는 좌열이 남는 폭(575)으로 줄어든다.
 expect(widths()).toEqual(['575px','680px']);
 const grips=host.querySelectorAll('[role=separator]');
 act(()=>grips[0]!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));expect(widths()).toEqual(['559px','680px']);
 act(()=>grips[1]!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));expect(widths()).toEqual(['575px','664px']);
 for(let i=0;i<3;i++)act(()=>grips[1]!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
 expect(widths()).toEqual(['623px','616px']);
 click(host.querySelector('.db-contact-open')!);click(host.querySelector('.db-contact-open')!);expect(widths()).toEqual(['623px','616px']);
});

it("treats the old saved default right width (560) as the new 680 default but keeps a user-dragged width",()=>{
 const noop=vi.fn(),props={row,draft:contactDraft(row),onChange:noop,onEdit:noop,onResult:noop,onRegister:noop,onOpen:noop,onClose:noop,onDelete:noop,onAsInfo:noop,onInflowChange:async()=>{}};
 Object.defineProperty(window,'innerWidth',{configurable:true,value:1440});
 for(const [saved,expected] of [['560','680px'],['500','500px']] as const){
  localStorage.setItem('db-sheet-panel-left-width','640');localStorage.setItem('db-sheet-panel-right-width',saved);
  act(()=>root.render(React.createElement(DbDetail,{...props,key:saved})));click(host.querySelector('.db-contact-open')!);
  expect(host.querySelector<HTMLElement>('.db-detail-shell')!.style.getPropertyValue('--db-right-width')).toBe(expected);
  act(()=>root.render(React.createElement('div')));
 }
});

it("DB정보 아래에는 영구삭제만 남고 상담·미팅 반영 설정은 없다(2026-10-25 belie)",()=>{
 const noop=vi.fn(),remove=vi.fn();
 act(()=>root.render(React.createElement(DbDetail,{row,draft:contactDraft(row),onChange:noop,onEdit:noop,onResult:noop,onRegister:noop,onOpen:noop,onClose:noop,onDelete:remove,onAsInfo:noop})));
 expect([...host.querySelectorAll('button')].some(button=>button.textContent==='상담·미팅 반영 설정')).toBe(false);
 click([...host.querySelectorAll('button')].find(button=>button.textContent==='삭제')!);expect(remove).toHaveBeenCalledOnce();
});

it("keeps 480/600 → 400/680 in 1081px, restores left on shrink, and grows only after minLeft",()=>{
 const noop=vi.fn();localStorage.setItem('db-sheet-panel-left-width','480');localStorage.setItem('db-sheet-panel-right-width','600');Object.defineProperty(window,'innerWidth',{configurable:true,value:1280});
 act(()=>root.render(React.createElement(DbDetail,{row,draft:contactDraft(row),onChange:noop,onEdit:noop,onResult:noop,onRegister:noop,onOpen:noop,onClose:noop,onDelete:noop,onAsInfo:noop,onInflowChange:async()=>{}})));click(host.querySelector('.db-contact-open')!);
 const shell=host.querySelector<HTMLElement>('.db-detail-shell')!,center=host.querySelector('[aria-label="우열 중앙 경계 너비 조절"]')!;
 const press=(key:string)=>act(()=>center.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})));
 for(let i=0;i<5;i++)press('ArrowRight');expect(shell.style.getPropertyValue('--db-left-width')).toBe('400px');expect(shell.style.getPropertyValue('--db-right-width')).toBe('680px');expect(shell.style.getPropertyValue('--db-panel-width')).toBe('1081px');
 for(let i=0;i<5;i++)press('ArrowLeft');expect(shell.style.getPropertyValue('--db-left-width')).toBe('480px');expect(shell.style.getPropertyValue('--db-panel-width')).toBe('1081px');
 const left=host.querySelector('[aria-label="좌열 왼쪽 바깥 테두리 너비 조절"]')!;for(let i=0;i<10;i++)act(()=>left.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
 expect(shell.style.getPropertyValue('--db-left-width')).toBe('360px');press('ArrowRight');expect(shell.style.getPropertyValue('--db-left-width')).toBe('360px');expect(shell.style.getPropertyValue('--db-panel-width')).toBe('977px');
 expect(host.textContent).not.toContain('컨택일(최초컨택일)');expect(host.querySelector('[aria-label="상담메모"]')).not.toBeNull(); // 2026-10-26: 컨택일 칸·「컨택내용」 제목 제거, 상담메모는 컨택결과 묶음 안
 expect(host.querySelector('.db-call-heading .db-first-contact')).toBeNull();expect(host.querySelector('[aria-label="DB정보 최초상담일"]')).not.toBeNull();
});
it("hides 부재 기록 once the result is 단순거절 (2026-10-25)", () => {
  const noop = vi.fn();
  const render = (result: string) => act(() => root.render(React.createElement(DbDetail, { row: { ...row, result }, draft: contactDraft(row), onChange: noop, onEdit: noop, onResult: noop, onRegister: noop, onOpen: noop, onClose: noop, onDelete: noop, onAsInfo: noop, onInflowChange: async () => {}, onAbsence: async () => {} })));
  render("부재");
  expect(host.querySelector('[aria-label="부재 기록"]')).not.toBeNull();
  render("단순거절");
  expect(host.querySelector('[aria-label="부재 기록"]')).toBeNull();
});
it("부재·재통화 highlight the 다음 연락일 field with an auto-schedule hint instead of a separate notice box (2026-10-25)", () => {
  const noop = vi.fn();
  const render = (result: string, next: string) => act(() => root.render(React.createElement(DbDetail, { row: { ...row, result, next }, draft: contactDraft(row), onChange: noop, onEdit: noop, onResult: noop, onRegister: noop, onOpen: noop, onClose: noop, onDelete: noop, onAsInfo: noop, onInflowChange: async () => {} })));
  render("재통화", "2026-10-26");
  const field = host.querySelector('input[aria-label="DB정보 다음 연락일"]')!.closest("label")!;
  expect(field.className).toContain("db-next-auto");
  expect(field.textContent).toContain("다음날로 자동 입력");
  expect(field.textContent).toContain("바꿀 수 있어요");
  expect(host.textContent).not.toContain("재통화 일정을 정해 주세요");
  render("단순거절", "2026-10-26");
  expect(host.querySelector('input[aria-label="DB정보 다음 연락일"]')!.closest("label")!.className).not.toContain("db-next-auto");
});


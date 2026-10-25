// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContractPayment } from "@/types";
import { contract, slot } from "./follow-ups-factories";
const state=vi.hoisted(()=>({rows:undefined as ContractPayment[]|undefined,pc:false}));
vi.mock("@/components/DirtyGuard",()=>({useGuardedNav:()=> (run:()=>void)=>run()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("@/query/contract-payment-hooks",()=>({useContractPayments:()=>({data:state.rows?{rows:state.rows}:undefined,isLoading:!state.rows,isError:false}),usePatchContractPayment:()=>({}),useRemoveContractPayment:()=>({}),useTerminateContract:()=>({})}));
vi.mock("@/query/me-hook",()=>({useMe:()=>({data:{courseStartISO:"2026-09-01"}})}));
vi.mock("@/query/todos-hooks",()=>({useAllTodos:()=>({data:{todos:[]},isError:false})}));
vi.mock("@/query/grant-match-hooks",()=>({useGrantMatches:()=>({data:undefined})}));
vi.mock("@/components/PageContainer",()=>({default:({children}:{children:React.ReactNode})=>h("div",null,children)}));
vi.mock("@/components/TopHeader",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/ContractRow",()=>({default:(p:{cp:ContractPayment;focusedSlot?:number|null;focusTodoId?:string|null})=>h("div",{"data-detail-row":p.cp.row,"data-slot":p.focusedSlot??"none","data-todo":p.focusTodoId??"none"},p.cp.업체명)}));
vi.mock("@/app/(app)/payment/_components/ContractListTable",()=>({default:(p:{items:Array<{key:string;cp:ContractPayment}>;onSelect:(i:unknown)=>void;renderDetail?:(i:unknown)=>React.ReactNode})=>h("div",null,p.items.map(i=>h("div",{key:i.key},h("button",{"data-select-row":i.cp.row,onClick:()=>p.onSelect(i)},i.cp.업체명),p.renderDetail?.(i))))}));
vi.mock("@/app/(app)/payment/_components/InstitutionWorkList",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/PaymentSelectionBridge",()=>({default:React.forwardRef(function Bridge(){return null;}),syncPaymentSelectionBridge:()=>{},watchDevicePixelRatio:()=>()=>{}}));
vi.mock("@/app/(app)/payment/_components/PaymentPerformanceSummary",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/TerminationModal",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/DeleteConfirmModal",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/TerminationArchive",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/PriorContractSection",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/StandaloneCompanyAdd",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/CompanySearchBar",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/PaymentSortControl",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/PaymentListModeTabs",()=>({default:()=>null}));
vi.mock("@/app/(app)/payment/_components/useMasterPaneWidth",()=>({default:()=>({masterWidth:320,setMasterWidth:()=>{},beginResize:()=>{}}),MASTER_PANE_MIN_WIDTH:320}));
vi.mock("@/app/(app)/payment/_components/DriveLinkBar",()=>({default:()=>null}));
import PaymentPage from "@/app/(app)/payment/page";
let root:Root,host:HTMLDivElement;
const rows=()=>[contract({row:3,업체명:"합성 첫 업체",수납1:slot({진행기관:"기관A"})}),contract({row:17,업체명:"합성 대상 업체",수납1:slot({진행기관:"기관A"}),수납2:slot({진행기관:"기관B"})})];
beforeEach(()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});state.rows=undefined;state.pc=false;
 vi.stubGlobal("matchMedia",vi.fn(()=>({matches:state.pc,addEventListener:()=>{},removeEventListener:()=>{}})));
 vi.stubGlobal("requestAnimationFrame",()=>0);vi.stubGlobal("cancelAnimationFrame",()=>{});
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();window.history.replaceState({},"","/");});
async function render(){await act(async()=>{root.render(h(PaymentPage));});}
it.each([false,true])("actual payment page cold entry selects row-only company without guessing a slot (PC=%s)",async pc=>{
 state.pc=pc;window.history.replaceState({},"","/payment?row=17&focus=ambiguous");
 await render();expect(host.querySelector("[data-detail-row]")).toBeNull();
 state.rows=rows();await render();
 const detail=host.querySelector("[data-detail-row]");expect(detail?.getAttribute("data-detail-row")).toBe("17");expect(detail?.getAttribute("data-slot")).toBe("none");expect(detail?.getAttribute("data-todo")).toBe("none");expect(host.textContent).toContain("연결 진행건을 확인");
});
it.each([false,true])("explicit slot 2 survives row refresh; later user company choice is respected (PC=%s)",async pc=>{
 state.pc=pc;window.history.replaceState({},"","/payment?row=17&slot=2&focus=known");
 state.rows=rows();await render();
 expect(host.querySelector("[data-detail-row]")?.getAttribute("data-slot")).toBe("2");
 if(pc)expect(host.textContent).toContain("진행 2 · 기관B");
 state.rows=rows();await render();expect(host.querySelector("[data-detail-row]")?.getAttribute("data-slot")).toBe("2");
 await act(async()=>{host.querySelector<HTMLButtonElement>('[data-select-row="3"]')!.click();});
 expect(host.querySelector("[data-detail-row]")?.getAttribute("data-detail-row")).toBe("3");expect(host.querySelector("[data-detail-row]")?.getAttribute("data-slot")).toBe("1");
 state.rows=rows();await render();expect(host.querySelector("[data-detail-row]")?.getAttribute("data-detail-row")).toBe("3");
});
it("refreshing data does not repeat the deep-link scroll after initial arrival",async()=>{
 vi.useFakeTimers();
 const target=document.createElement("div");target.id="payment-slot-17-2";target.scrollIntoView=vi.fn();document.body.append(target);
 try {
  window.history.replaceState({},"","/payment?row=17&slot=2");state.rows=rows();await render();
  await act(async()=>{await vi.advanceTimersByTimeAsync(200);});expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
  state.rows=rows();await render();await act(async()=>{await vi.advanceTimersByTimeAsync(200);});expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
 } finally {target.remove();vi.useRealTimers();}
});

// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import { CompanyInfo } from "@/types";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/company-info/CompanyVaultSection",()=>({default:()=>null}));
vi.mock("@/components/company-doc/CompanyDocAutofillDialog",()=>({default:({onClose}:{onClose:()=>void})=>h("div",{role:"dialog","aria-label":"합성 문서 창"},h("button",{onClick:onClose},"합성 닫기"))}));
let root:Root,host:HTMLDivElement;
const save=vi.fn(),change=vi.fn();
beforeEach(()=>{localStorage.clear();host=document.createElement("div");document.body.append(host);root=createRoot(host);vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({ok:true})})));});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.clearAllMocks();localStorage.clear();});
const render=(compactMobile=false)=>act(()=>root.render(h(CompanyInfoEditor,{value:CompanyInfo.parse({}),hideSave:true,defaultOpen:true,defaultLayout:"extended",compactMobile,txtCompanyName:"합성 업체",onSave:save,onChange:change})));
const click=(e:Element)=>act(()=>(e as HTMLElement).click());
const select=(label:string,value:string)=>{const e=host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;act(()=>{e.value=value;e.dispatchEvent(new Event("change",{bubbles:true}));});};
it("leaves shared non-opt-in presentation without new native selects or mobile scope",()=>{render();expect(host.querySelector('[data-payment-company-compact]')).toBeNull();expect(host.querySelectorAll('.payment-ci-native')).toHaveLength(0);});
it("opts in explicitly and uses the same layout/view state, counts and memory without saves",()=>{
 render(true);expect(host.querySelector('[data-payment-company-compact]')).not.toBeNull();
 expect(host.querySelectorAll('.payment-ci-native')).toHaveLength(2);
 const view=host.querySelector<HTMLSelectElement>('select[aria-label="업체정보 항목 보기"]')!;
 expect([...view.options].map(o=>o.text)).toEqual(["전체","적은 것 0","안 적은 것 34"]);
 select("업체정보 항목 보기","empty");expect(localStorage.getItem("salespt:company-info-view")).toBe("empty");
 select("업체정보 보기 범위 선택","basic");expect(host.querySelector('select[aria-label="업체정보 항목 보기"]')).toBeNull();
 expect(localStorage.getItem("salespt:company-info-layout:extended")).toBe("basic");
 select("업체정보 보기 범위 선택","extended");expect(host.querySelector<HTMLSelectElement>('select[aria-label="업체정보 항목 보기"]')!.value).toBe("empty");
 expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("keeps font limits and popup opening on original callbacks without saving",()=>{
 render(true);click(host.querySelector('[data-ci-more]')!);const smaller=host.querySelector<HTMLButtonElement>('[aria-label="업체정보 글자 작게"]')!,bigger=host.querySelector<HTMLButtonElement>('[aria-label="업체정보 글자 크게"]')!;
 expect(smaller.disabled).toBe(true);for(let i=0;i<3;i++)click(bigger);expect(bigger.disabled).toBe(true);click(smaller);expect(bigger.disabled).toBe(false);
 click(host.querySelector('[data-payment-ci-action="popup"]')!);expect(document.querySelector('[data-payment-company-compact-modal]')).not.toBeNull();
 expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("document first click opens only the lazy mock dialog and TXT calls only the mocked export endpoint",async()=>{
 render(true);await act(async()=>click(host.querySelector('[aria-label="문서로 자동입력"]')!));
 expect(host.querySelector('[aria-label="합성 문서 창"]')).not.toBeNull();expect(fetch).not.toHaveBeenCalled();
 click(host.querySelector('[aria-label="합성 문서 창"] button')!);
 click(host.querySelector('[data-ci-more]')!);
 vi.mocked(fetch).mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:"합성 export 차단"})} as Response);
 await act(async()=>click(host.querySelector('[data-payment-ci-action="txt"]')!));
 expect(fetch).toHaveBeenCalledTimes(1);expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("/api/company-info/export");
 expect(vi.mocked(fetch).mock.calls[0]![1]?.method).toBe("POST");
 expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
});
it("changing compact view preserves a staged draft and snapshot membership until view changes",()=>{
 render(true);select("업체정보 항목 보기","empty");
 const input=host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"합성 초안");input.dispatchEvent(new Event("input",{bubbles:true}));});
 expect(host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!.value).toBe("합성 초안");
 expect(host.querySelector<HTMLSelectElement>('select[aria-label="업체정보 항목 보기"]')!.textContent).toContain("적은 것 1");
 const edits=change.mock.calls.length;select("업체정보 항목 보기","filled");
 expect(host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!.value).toBe("합성 초안");
 select("업체정보 보기 범위 선택","basic");select("업체정보 보기 범위 선택","extended");
 expect(host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!.value).toBe("합성 초안");
 expect(change).toHaveBeenCalledTimes(edits);expect(save).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});

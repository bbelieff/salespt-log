// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/company-info/CompanyVaultSection",()=>({default:()=>null}));
let root:Root,host:HTMLDivElement;
const save=vi.fn(),change=vi.fn();
beforeEach(()=>{localStorage.clear();host=document.createElement("div");document.body.append(host);root=createRoot(host);vi.stubGlobal("fetch",vi.fn());});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.clearAllMocks();localStorage.clear();});
function render(payment=true,open=true){act(()=>root.render(h(CompanyInfoEditor,{hideSave:true,desktopHeading:payment,compactMobile:payment,defaultOpen:open,onSave:save,onChange:change,txtCompanyName:"합성 긴 업체"})));}
it("gives the payment heading a stable controlled body and explicit fold action on every click",()=>{
 render();const button=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;
 expect(button.getAttribute("aria-label")).toBe("업체정보 접기");expect(button.getAttribute("aria-expanded")).toBe("true");
 const id=button.getAttribute("aria-controls")!;expect(document.getElementById(id)?.hasAttribute("data-company-info-body")).toBe(true);
 act(()=>button.click());expect(button.getAttribute("aria-expanded")).toBe("false");expect(button.textContent).toContain("펼치기");expect(document.getElementById(id)).toBeNull();
 act(()=>button.click());expect(button.getAttribute("aria-expanded")).toBe("true");expect(document.getElementById(id)).not.toBeNull();
 expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("keeps the original closed default and preserves edited draft across fold/unfold without extra callbacks",()=>{
 render(true,false);const button=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;expect(button.getAttribute("aria-expanded")).toBe("false");act(()=>button.click());
 const input=host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!;act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"합성 초안");input.dispatchEvent(new Event("input",{bubbles:true}));});
 const edits=change.mock.calls.length;act(()=>button.click());act(()=>button.click());expect(host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!.value).toBe("합성 초안");
 expect(change).toHaveBeenCalledTimes(edits);expect(save).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("leaves other shared headings unchanged and limits two-row/44px rules to payment scope",()=>{
 render(false);expect(host.querySelector('[data-payment-company-header]')).toBeNull();expect(host.querySelector('[data-payment-ci-toggle]')).toBeNull();
 const css=readFileSync('app/(app)/payment/payment-company-compact.css','utf8');expect(css).toContain('[data-payment-company-header] [data-company-info-header]');
 expect(css).toContain('min-height:44px');expect(css).toContain('[data-payment-ci-fold]{flex:none;white-space:nowrap;display:inline-flex');expect(css).toContain('min-height:32px;padding:0 8px;border:1px solid #cbd5e1');expect(css).toContain('background:#f8fafc;color:#475569');expect(css).toContain('[data-company-info-header-actions]{grid-column:1');
});

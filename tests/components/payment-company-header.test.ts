// @vitest-environment jsdom
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CompanyInfoHeader from "@/components/company-info/CompanyInfoHeader";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/company-info/CompanyVaultSection",()=>({default:()=>null}));
// This regression owns the React portal event boundary, not OCR/dialog parsing.
vi.mock("@/components/company-doc/CompanyDocAutofillDialog",()=>({default:()=>createPortal(h('div',{role:'dialog'},'합성 문서 팝업'),document.body)}));
let root:Root,host:HTMLDivElement,headerWidth=600;
const save=vi.fn(),change=vi.fn();
beforeEach(()=>{headerWidth=600;localStorage.clear();host=document.createElement("div");document.body.append(host);root=createRoot(host);vi.stubGlobal("fetch",vi.fn());vi.stubGlobal('ResizeObserver',class{constructor(private callback:(entries:unknown[])=>void){}observe(){this.callback([{contentRect:{width:headerWidth}}]);}disconnect(){}});});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.clearAllMocks();localStorage.clear();});
function render(payment=true,open=true){act(()=>root.render(h(CompanyInfoEditor,{hideSave:true,desktopHeading:payment,compactMobile:payment,defaultOpen:open,onSave:save,onChange:change,txtCompanyName:"합성 긴 업체"})));}
it("gives the payment heading a controlled body and direction-only native title toggle",()=>{
 render();const button=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;
 expect(button.getAttribute("aria-label")).toBe("업체정보 접기");expect(button.getAttribute("aria-expanded")).toBe("true");
 const id=button.getAttribute("aria-controls")!;expect(document.getElementById(id)?.hasAttribute("data-company-info-body")).toBe(true);
 act(()=>button.click());expect(button.getAttribute("aria-expanded")).toBe("false");expect(button.textContent).not.toMatch(/접기|펼치기/);expect(button.querySelector<SVGElement>('[data-disclosure-chevron]')?.style.transform).toBe('rotate(0deg)');expect(button.textContent).not.toMatch(/⌄|›|▴|▾/);expect(document.getElementById(id)).toBeNull();
 act(()=>button.click());expect(button.getAttribute("aria-expanded")).toBe("true");expect(document.getElementById(id)).not.toBeNull();
 expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("keeps the original closed default and preserves edited draft across fold/unfold without extra callbacks",()=>{
 render(true,false);const button=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;expect(button.getAttribute("aria-expanded")).toBe("false");act(()=>button.click());
 const input=host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!;act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"합성 초안");input.dispatchEvent(new Event("input",{bubbles:true}));});
 const edits=change.mock.calls.length;act(()=>button.click());act(()=>button.click());expect(host.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')!.value).toBe("합성 초안");
 expect(change).toHaveBeenCalledTimes(edits);expect(save).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("leaves shared headings unchanged and limits compact heading rules to payment scope",()=>{
 render(false);expect(host.querySelector('[data-payment-company-header]')).toBeNull();expect(host.querySelector('[data-payment-ci-toggle]')).toBeNull();
 const css=readFileSync('components/company-info/company-info-header.css','utf8');expect(css).toContain('[data-payment-company-header] [data-payment-ci-responsive][data-company-info-header]');
 expect(css).toContain('min-height:44px');expect(css).toContain('flex-wrap:nowrap');expect(css).toContain('[data-payment-company-header] [data-payment-ci-responsive] [data-company-info-header-actions]');expect(css).not.toContain('grid-column:1');
});
it("uses title-only and short TXT wording only in payment while preserving accessible action names",()=>{
 render();const title=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!,txt=host.querySelector<HTMLButtonElement>('[data-payment-ci-action="txt"]')!;
 expect(title.textContent).not.toMatch(/미입력|외\s*\d+항목/);expect(title.getAttribute('aria-label')).toBe('업체정보 접기');expect(txt.textContent).toContain('TXT 생성');expect(txt.getAttribute('aria-label')).toBe('업체정보 TXT 생성');expect(txt.title).toBe('업체정보 TXT 생성');
 render(false);expect(host.textContent).toContain('미입력');expect(host.querySelector('[data-payment-ci-action="txt"]')?.textContent).toBe('업체정보생성(TXT)');
 expect(readFileSync('components/company-info/company-info-header.css','utf8')).toContain('[data-payment-ci-responsive] [data-ci-tools-menu] .payment-ci-action-label{display:inline}');
});
it("toggles heading padding and tool gaps exactly once while excluding native tools and font group",()=>{
 render();const header=host.querySelector<HTMLElement>('[data-company-info-header]')!,button=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;
 act(()=>header.click());expect(button.getAttribute('aria-expanded')).toBe('false');
 act(()=>button.click());expect(button.getAttribute('aria-expanded')).toBe('true');
 act(()=>host.querySelector<HTMLElement>('[data-company-info-header-actions]')!.click());expect(button.getAttribute('aria-expanded')).toBe('false');
 act(()=>button.click());const font=host.querySelector<HTMLElement>('[data-font-scale-control]')!;
 act(()=>font.querySelector('span')!.click());expect(button.getAttribute('aria-expanded')).toBe('true');
 const fontButtons=font.querySelectorAll('button');expect(fontButtons).toHaveLength(2);const increase=fontButtons[1];if(!increase)throw new Error('font increase button missing');
 act(()=>increase.click());expect(button.getAttribute('aria-expanded')).toBe('true');
 act(()=>host.querySelector<HTMLButtonElement>('[data-payment-ci-action="popup"]')!.click());expect(button.getAttribute('aria-expanded')).toBe('true');
 expect(header.querySelectorAll('button button')).toHaveLength(0);expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("does not treat interactive descendants or a portal document dialog as heading whitespace",async()=>{
 render();const header=host.querySelector<HTMLElement>('[data-company-info-header]')!,button=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;
 for(const tag of ['input','select','textarea','a','label']){const el=document.createElement(tag);header.append(el);act(()=>el.click());expect(button.getAttribute('aria-expanded')).toBe('true');el.remove();}
 const doc=[...header.querySelectorAll('button')].find(el=>el.textContent?.includes('문서로 자동입력'))!;
 await act(async()=>{doc.click();await import('@/components/company-doc/CompanyDocAutofillDialog');});expect(button.getAttribute('aria-expanded')).toBe('true');
 const dialog=document.querySelector('[role="dialog"]');expect(dialog).not.toBeNull();
 act(()=>dialog!.dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(button.getAttribute('aria-expanded')).toBe('true');
 expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('keeps narrow save status outside the tool list and always labels overflow actions',()=>{
 headerWidth=280;const toggle=vi.fn();
 const tools=[h('button',{key:'document'},'문서로 자동입력'),h('button',{key:'txt'},h('span',{className:'payment-ci-action-label'},'TXT 생성')),h('button',{key:'popup'},h('span',{className:'payment-ci-action-label'},'팝업'))];
 act(()=>root.render(h('div',{'data-payment-company-header':''},h(CompanyInfoHeader,{open:true,onToggle:toggle,controlsId:'status-body',payment:true,summary:'',status:h('span',{'aria-live':'polite'},'저장 중…'),tools,fontControl:h('div',{'data-font-scale-control':''},h('button',null,'가+'))}))));
 expect(host.querySelector('[data-ci-tools-primary]')?.textContent).toBe('문서로 자동입력');
 expect(host.querySelector('[data-ci-header-status]')?.textContent).toBe('저장 중…');
 const more=host.querySelector<HTMLButtonElement>('[data-ci-more]')!;act(()=>more.click());
 const menu=host.querySelector<HTMLElement>('[data-ci-tools-menu]')!;expect(menu.textContent).toContain('TXT 생성');expect(menu.textContent).toContain('팝업');
 act(()=>menu.click());expect(toggle).not.toHaveBeenCalled();
 act(()=>menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(host.querySelector('[data-ci-tools-menu]')).toBeNull();expect(document.activeElement).toBe(more);
 expect(readFileSync('components/company-info/company-info-header.css','utf8')).toContain('[data-payment-ci-responsive] [data-ci-tools-menu] [data-font-scale-control]{height:44px;');
});
it('preserves failure status at the same semantic boundary and hides all payment tools when closed',()=>{
 headerWidth=280;const props={onToggle:vi.fn(),controlsId:'error-body',payment:true,summary:'',status:h('span',{'aria-live':'polite'},'저장 실패'),tools:h('button',null,'문서'),fontControl:h('div',{'data-font-scale-control':''},'글자 크기')};
 act(()=>root.render(h('div',{'data-payment-company-header':''},h(CompanyInfoHeader,{...props,open:true}))));
 expect(host.querySelector('[data-ci-header-status]')?.textContent).toBe('저장 실패');expect(host.querySelector('[data-ci-tools-primary]')?.textContent).toBe('문서');
 act(()=>root.render(h('div',{'data-payment-company-header':''},h(CompanyInfoHeader,{...props,open:false}))));
 expect(host.querySelector('[data-ci-header-tools]')).toBeNull();
});

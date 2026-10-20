// @vitest-environment jsdom
import React,{act,createElement as h} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import CompanyInfoEditor from '@/components/CompanyInfoEditor';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
vi.mock('@/components/company-info/CompanyVaultSection',()=>({default:()=>null}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();localStorage.clear();});
it('tracks compact fold state without changing title controls, draft or persistence',()=>{
 const save=vi.fn(),change=vi.fn();act(()=>root.render(h(CompanyInfoEditor,{compactMobile:true,desktopHeading:true,defaultOpen:false,hideSave:true,onSave:save,onChange:change,txtCompanyName:'합성 업체'})));
 const wrapper=host.querySelector('[data-payment-company-compact]')!,toggle=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!;
 expect(wrapper.getAttribute('data-payment-ci-expanded')).toBe('false');expect(toggle.getAttribute('aria-expanded')).toBe('false');
 act(()=>toggle.click());expect(wrapper.getAttribute('data-payment-ci-expanded')).toBe('true');expect(host.querySelector('[data-payment-ci-action=txt]')).not.toBeNull();expect(host.querySelector('[data-payment-ci-action=popup]')).not.toBeNull();expect(host.textContent).toContain('문서로 자동입력');
 act(()=>toggle.click());expect(wrapper.getAttribute('data-payment-ci-expanded')).toBe('false');expect(save).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
});
it('keeps shared non-compact editors outside the mobile-only fold selector',()=>{
 act(()=>root.render(h(CompanyInfoEditor,{defaultOpen:false,hideSave:true,onSave:vi.fn()})));
 expect(host.querySelector('[data-payment-ci-expanded]')).toBeNull();expect(host.querySelector('[data-payment-company-compact]')).toBeNull();expect(host.querySelector('[data-font-scale-control]')).not.toBeNull();
 const css=readFileSync('app/(app)/payment/payment-company-compact.css','utf8');const media=css.indexOf('@media(max-width:767px)');
 expect(css.indexOf('[data-payment-company-compact][data-payment-ci-expanded="false"]')).toBeGreaterThan(media);expect(css).toContain('[data-company-info-header-actions]{display:none}');expect(css).toContain('[data-company-info-header]{gap:0}');
 expect(host.querySelector('[data-payment-ci-fold-mobile]')).toBeNull();
});
it('uses only the compact mobile direction marker while preserving the full accessible title button',()=>{
 act(()=>root.render(h(CompanyInfoEditor,{compactMobile:true,desktopHeading:true,defaultOpen:false,hideSave:true,onSave:vi.fn()})));
 const toggle=host.querySelector<HTMLButtonElement>('[data-payment-ci-toggle]')!,fold=host.querySelector('[data-payment-ci-fold]')!;
 expect(toggle.getAttribute('aria-label')).toBe('업체정보 펼치기');expect(toggle.getAttribute('aria-controls')).toBeTruthy();expect(fold.getAttribute('aria-hidden')).toBe('true');expect(fold.textContent).toBe('›');expect(toggle.textContent).not.toMatch(/접기|펼치기/);
 act(()=>toggle.click());expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(toggle.getAttribute('aria-label')).toBe('업체정보 접기');expect(fold.textContent).toBe('⌄');
 const css=readFileSync('app/(app)/payment/payment-company-compact.css','utf8');const mobile=css.slice(css.indexOf('@media(max-width:767px)'));
 expect(mobile).toContain('[data-payment-ci-fold]{min-height:0;padding:0;border:0;border-radius:0;background:transparent');expect(css).not.toContain('[data-payment-ci-fold-label]');
});
it('applies the explicit compact title exception at 36px without enlarging existing lower titles',()=>{
 const css=readFileSync('app/(app)/payment/payment-company-compact.css','utf8');const mobile=css.slice(css.indexOf('@media(max-width:767px)'));
 expect(mobile).toContain('[data-company-info-header]{display:grid;grid-template-columns:minmax(0,1fr);gap:0;padding:0}');
 expect(mobile).toContain('[data-company-info-header]>button{min-height:36px;padding:8px 12px}');expect(mobile).toContain('min-width:0;padding:0 6px 2px}');
 expect(css.slice(0,css.indexOf('@media(max-width:767px)'))).toContain('[data-payment-ci-toggle]{width:auto;min-height:44px');
 expect(mobile).not.toMatch(/summary\s*\{[^}]*min-height:44px/);
 expect(mobile).not.toContain('margin-top:-');expect(mobile).not.toContain('pointer-events:all');
});
it('retains linked-field inputs/status/undo and explicit payment actions while only marking duplicate prose',()=>{
 const row=readFileSync('app/(app)/payment/_components/ContractRow.tsx','utf8'),linked=readFileSync('app/(app)/payment/_components/LinkedFieldsEditor.tsx','utf8');
 expect(row).toContain('isCarryover && <CarryoverBadge 구분="이월" variant="badge"');expect(row).not.toContain('variant="note"');expect(row).toContain('<LinkedFieldsEditor cp={cp} initiallyEditing compactMobile={inline}');
 expect(row).toContain('data-payment-contract-summary');expect(row).toContain('data-payment-contract-caret');expect(row).toContain('onTerminateRequest');expect(row).toContain('onDeleteRequest');expect(row).toContain('<ContractSlots');
 for(const value of ['고객사(업체명)','계약일','수임비 (원)','onRetry={retry}','canUndo={canUndo}','onUndo={undo}','data-payment-linked-status'])expect(linked).toContain(value);
 expect(linked).toContain('data-payment-linked-note');expect(linked).toContain('useEditContractLinkedFields({ silent: compactMobile })');
 const page=readFileSync('app/(app)/payment/page.tsx','utf8');expect(page).toContain('usePatchContractPayment({ silent: !isPc })');
});

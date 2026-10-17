// @vitest-environment jsdom
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
import {analyzeImport} from '@/app/(app)/db-sheet/_components/adaptive-import';
import {saveImportRules} from '@/app/(app)/db-sheet/_components/adaptive-import-profiles';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===name)!;
it('requires explicit review before reusing a headerless rule when text columns have swapped',async()=>{
 const old=analyzeImport('푸른숲,김가상,01000002001');
 const raw='이가상,별빛공방,01000002002';
 expect(analyzeImport(raw).signature).toBe(old.signature);
 saveImportRules('test-account',old.signature,{0:'company',1:'owner'});
 const apply=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(ImportDialog,{accountKey:'test-account',rows:[],onApply:apply,onClose:vi.fn(),onExisting:vi.fn()})));
 const area=host.querySelector('textarea')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(area,raw);area.dispatchEvent(new Event('input',{bubbles:true}));});
 act(()=>button('자동 배치').click());
 expect(host.textContent).toContain('기억한 열 연결 확인');
 // The guessed fields stay correct, rather than silently applying the old order.
 expect(host.querySelector<HTMLInputElement>('input[aria-label="1번 company"]')!.value).toBe('별빛공방');
 expect(host.querySelector<HTMLInputElement>('input[aria-label="1번 owner"]')!.value).toBe('이가상');
 expect(host.textContent).toContain('1열 → 사업자명: 이가상');
 expect(apply).not.toHaveBeenCalled();
 act(()=>button('이 연결로 배치').click());
 expect(host.querySelector<HTMLInputElement>('input[aria-label="1번 company"]')!.value).toBe('이가상');
 expect(apply).not.toHaveBeenCalled();
});

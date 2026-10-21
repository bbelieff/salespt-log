// @vitest-environment jsdom
import React, {act, createElement as h} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
import type {Row} from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===name)!;
function fill(selector:string,value:string){
 const el=host.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector)!;
 act(()=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
}
async function open(raw:string){
 const apply=vi.fn(async(_rows:Row[])=>{});
 await act(async()=>root.render(h(ImportDialog,{accountKey:'synthetic-account',rows:[],onApply:apply,onClose:vi.fn(),onExisting:vi.fn()})));
 fill('#ai-source',raw);act(()=>button('자동 배치').click());return apply;
}
it('explains which required fields block adding and becomes usable after bulk date/supplier entry',async()=>{
 const apply=await open('사업자명\t대표자\t전화번호\n합성달빛공방\t김가상\t01000002001');
 expect(button('선택한 1건 추가').disabled).toBe(true);
 expect(host.querySelector('footer')!.textContent).toContain('추가 전 확인: 유입일 · 공급처');
 fill('[aria-label="가져오기 공급처"]','합성 공급처');fill('[aria-label="빈 유입일 채우기"]','2026-10-21');
 expect(button('선택한 1건 추가').disabled).toBe(false);
 await act(async()=>button('선택한 1건 추가').click());
 expect(apply).toHaveBeenCalledTimes(1);
 expect(apply.mock.calls[0]![0]).toMatchObject([{company:'합성달빛공방',phone:'010-0000-2001',date:'2026-10-21',supplier:'합성 공급처',recording:{inflow:true,activities:true}}]);
});
it('reviews only the ambiguous business number and imports the corrected customer without placeholder rows',async()=>{
 const headings=['','','','','사업자명','대표자','전화번호','업종','지역','사업자등록번호','유입일'].join('\t');
 const customer=['합성 업종','샘플지역','1234500001','2026-10-21','합성달빛공방','김가상','01000002001'].join('\t');
 const apply=await open(`${headings}\n${customer}\n—\t—\t—`);
 expect(host.textContent).toContain('1건 읽음');
 expect(host.querySelector<HTMLInputElement>('[aria-label="1번 company"]')!.value).toBe('합성달빛공방');
 expect(host.querySelector<HTMLInputElement>('[aria-label="1번 owner"]')!.value).toBe('김가상');
 expect(host.querySelector<HTMLInputElement>('[aria-label="1번 phone"]')!.value).toBe('010-0000-2001');
 act(()=>button('1234500001').click());act(()=>button('사업자번호').click());
 fill('[aria-label="가져오기 공급처"]','합성 공급처');
 expect(button('선택한 1건 추가').disabled).toBe(false);
 await act(async()=>button('선택한 1건 추가').click());
 expect(apply).toHaveBeenCalledTimes(1);
 expect(apply.mock.calls[0]![0]).toMatchObject([{company:'합성달빛공방',owner:'김가상',phone:'010-0000-2001',biz:'1234500001',date:'2026-10-21'}]);
});

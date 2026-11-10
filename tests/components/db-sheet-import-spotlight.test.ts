// @vitest-environment jsdom
/** DB 추가 확인 화면 스포트라이트(2026-11-10 belie 「키노트하듯 음영으로」): 막힌 곳 한 곳만 밝히고, 노란 칸 답은 같은 열에 한 번에. 합성 데이터만. */
import React, {act, createElement as h} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
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
 await act(async()=>root.render(h(ImportDialog,{accountKey:'synthetic-account',rows:[],onApply:vi.fn(async()=>{}),onClose:vi.fn(),onExisting:vi.fn()})));
 fill('#ai-source',raw);act(()=>button('자동 배치').click());
}
const spot=()=>host.querySelector('.ai-spot');

it('lights the common box first, says how many rows are empty, and clears once it is filled',async()=>{
 await open('사업자명\t대표자\t전화번호\n합성달빛공방\t김가상\t01000002001\n합성온유상사\t이가상\t01000002002');
 expect(spot()?.matches('fieldset.ai-common')).toBe(true);
 expect(spot()!.textContent).toContain('1 / 3');
 expect(host.querySelector('fieldset.ai-common legend')!.textContent).toContain('먼저 정해 주세요');
 expect(host.querySelector('fieldset.ai-common')!.textContent).toContain('2건 비어 있어요');
 expect(host.querySelector('footer')!.textContent).toContain('확인할 곳으로');
 fill('[aria-label="가져오기 공급처"]','합성 공급처');fill('[aria-label="빈 유입일 채우기"]','2026-10-21');
 expect(spot()).toBeNull();
 expect(button('선택한 2건 추가').disabled).toBe(false);
 expect(host.querySelector('footer')!.textContent).not.toContain('확인할 곳으로');
});

it('moves the light to the table for yellow cells and applies one answer to the same column',async()=>{
 const headings=['','','','','사업자명','대표자','전화번호','업종','지역','사업자등록번호','유입일'].join('\t');
 const row=(n:number)=>['합성 업종','샘플지역',`123450000${n}`,'2026-10-21',`합성상호${n}`,'김가상',`0100000200${n}`].join('\t');
 await open(`${headings}\n${row(1)}\n${row(2)}`);
 fill('[aria-label="가져오기 공급처"]','합성 공급처');
 expect(spot()?.classList.contains('ai-table-zone')).toBe(true);
 expect(spot()!.textContent).toContain('2 / 3');
 expect(button('선택한 2건 추가').disabled).toBe(true);
 act(()=>button('1234500001').click());
 expect(host.textContent).toContain('같은 열의 나머지 줄에도 똑같이 적용');
 act(()=>button('사업자번호').click());
 expect(button('1234500002')).toBeUndefined();
 expect(spot()).toBeNull();
 expect(button('선택한 2건 추가').disabled).toBe(false);
});

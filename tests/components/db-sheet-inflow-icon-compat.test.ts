// @vitest-environment jsdom
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import InflowStatusCell from '@/app/(app)/db-sheet/_components/InflowStatusCell';
import {blank} from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
it.each(['recorded','excluded','unknown','missing'] as const)('keeps %s projection meaning in a non-interactive icon',state=>{
 const inflowStatus=state==='missing'?undefined:{state,count:state==='recorded'?1:0};
 const row={...blank(),company:'합성 업체',inflowStatus} as ReturnType<typeof blank>,persist=vi.fn(async()=>{});
 act(()=>root.render(createElement(InflowStatusCell,{row,compact:true,iconOnly:true,onToggle:persist})));
 const expected=state==='recorded'?'반영됨':state==='excluded'?'미반영':'확인 필요',icon=host.querySelector('[role=img]')!;
 expect(icon.getAttribute('aria-label')).toBe(`유입 ${expected}`);expect(icon.getAttribute('title')).toBe(`유입 ${expected}`);
 expect(host.querySelector('button')).toBeNull();expect(host.querySelector('[role=alert]')).toBeNull();expect(persist).not.toHaveBeenCalled();
});
it('preserves the base unknown editor disable and persistence guard without coercing it to OFF',()=>{
 const persist=vi.fn(async()=>{}),row={...blank(),inflowStatus:{state:'unknown',count:0}} as ReturnType<typeof blank>;
 act(()=>root.render(createElement(InflowStatusCell,{row,onToggle:persist})));
 const buttons=Array.from(host.querySelectorAll<HTMLButtonElement>('[role=radio]'));
 expect(buttons).toHaveLength(2);expect(buttons.every(b=>b.disabled&&b.getAttribute('aria-checked')==='false')).toBe(true);
 expect(host.textContent).toContain('확인 필요 · 기존 유입 기록을 확인해 주세요.');
 act(()=>buttons[0]!.click());expect(persist).not.toHaveBeenCalled();
});

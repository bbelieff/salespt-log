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
it.each(['recorded','excluded'] as const)('keeps %s projection meaning in a non-interactive icon',state=>{
 const inflowStatus={state,count:state==='recorded'?1:0};
 const row={...blank(),company:'합성 업체',inflowStatus} as ReturnType<typeof blank>,persist=vi.fn(async()=>{});
 act(()=>root.render(createElement(InflowStatusCell,{row,compact:true,iconOnly:true,onToggle:persist})));
 const expected=state==='recorded'?'반영됨':'미반영',icon=host.querySelector('[role=img]')!;
 expect(icon.getAttribute('aria-label')).toBe(`유입 ${expected}`);expect(icon.getAttribute('title')).toBe(`유입 ${expected}`);
 expect(host.querySelector('button')).toBeNull();expect(host.querySelector('[role=alert]')).toBeNull();expect(persist).not.toHaveBeenCalled();
});
it.each([undefined,null,{state:'unknown',count:0},{state:'recorded',count:0},{state:'excluded',count:1}])('rejects invalid projection %j in both icon and editor without persistence',inflowStatus=>{
 const persist=vi.fn(async()=>{}),row={...blank(),inflowStatus} as ReturnType<typeof blank>;
 for(const compact of [true,false]){
  act(()=>root.render(createElement(InflowStatusCell,{row,compact,iconOnly:true,onToggle:persist})));
  expect(host.querySelectorAll('[role=radio],button,[role=img]')).toHaveLength(0);
  const alert=host.querySelector('[role=alert]')!;
  if(compact){expect(alert.textContent).toBe('오류');expect(alert.getAttribute('aria-label')).toContain('유입 표시를 불러오지 못했습니다');expect(alert.getAttribute('title')).toContain('새로고침해 주세요');expect(alert.classList.contains('sheet-inflow-icon')).toBe(true);}
  else expect(alert.textContent).toContain('유입 표시를 불러오지 못했습니다');
  expect(host.textContent).not.toMatch(/확인 필요|반영됨|미반영/);
  act(()=>host.click());expect(persist).not.toHaveBeenCalled();
 }
});
it('keeps the good row usable beside an isolated error row',async()=>{
 const persist=vi.fn(async()=>{}),bad={...blank(),company:'합성 오류'},good={...blank(),company:'합성 정상',inflowStatus:{state:'recorded' as const,count:1 as const}};
 act(()=>root.render(createElement(React.Fragment,null,createElement(InflowStatusCell,{row:bad,onToggle:persist}),createElement(InflowStatusCell,{row:good,onToggle:persist}))));
 expect(host.querySelectorAll('[role=alert]')).toHaveLength(1);
 const choices=host.querySelectorAll<HTMLButtonElement>('[role=radio]');expect(choices).toHaveLength(2);expect(choices[0]!.getAttribute('aria-checked')).toBe('true');
 await act(async()=>choices[1]!.click());expect(persist).toHaveBeenCalledOnce();expect(persist).toHaveBeenCalledWith(false);
});
it('keeps an invalid PC table projection bounded with the full error accessible and no editor/persistence',()=>{
 const row={...blank(),company:'합성 오류'},open=vi.fn();
 act(()=>root.render(createElement(InflowStatusCell,{row,onOpen:open})));
 const alert=host.querySelector('[role=alert]')!;expect(alert.textContent).toBe('오류');expect(alert.classList.contains('dbs-inflow-badge')).toBe(true);expect(alert.classList.contains('sheet-error')).toBe(false);
 expect(alert.getAttribute('aria-label')).toContain('유입 표시를 불러오지 못했습니다');expect(alert.getAttribute('title')).toContain('새로고침해 주세요');expect(alert.getAttribute('tabindex')).toBe('0');
 expect(host.querySelectorAll('button,[role=radio],[role=img]')).toHaveLength(0);act(()=>host.click());expect(open).not.toHaveBeenCalled();
});

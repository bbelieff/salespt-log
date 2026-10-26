// @vitest-environment jsdom
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {RecordingDialog} from '@/app/(app)/db-sheet/_components/RecordingDialog';
import InflowStatusCell from '@/app/(app)/db-sheet/_components/InflowStatusCell';
import {blank,outcomes} from '@/app/(app)/db-sheet/_components/model';
import {contactDraft} from '@/app/(app)/db-sheet/_components/ContactPanel';
import {DbContactActions} from '@/app/(app)/db-sheet/_components/DbContactActions';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
it('reports a missing projection as an error and preserves both authoritative inflow states',async()=>{
 const row={...blank(),company:'합성 업체'},open=vi.fn(),persist=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(InflowStatusCell,{row,onOpen:open})));
 expect(host.querySelector('[role=alert]')!.textContent).toBe('오류');expect(host.querySelector('[role=alert]')!.getAttribute('aria-label')).toContain('유입 표시를 불러오지 못했습니다');expect(host.querySelector('[role=alert]')!.getAttribute('title')).toContain('새로고침해 주세요');expect(host.querySelector('button')).toBeNull();expect(open).not.toHaveBeenCalled();expect(host.querySelector('dialog')).toBeNull();expect(host.textContent).not.toContain('유입 1건');
 await act(async()=>root.render(createElement(InflowStatusCell,{row,onToggle:persist})));
 expect(host.querySelector('[role=alert]')!.textContent).toContain('새로고침해 주세요');expect(host.textContent).not.toMatch(/확인 필요|유입\?/);
 expect(host.querySelectorAll('[role=radio]')).toHaveLength(0);expect(persist).not.toHaveBeenCalled();expect(host.textContent).not.toContain('유입 1건');
 for(const state of ['recorded','excluded'] as const){
  const known={...row,inflowStatus:{state,count:state==='recorded'?1 as const:0 as const}};
  await act(async()=>root.render(createElement(InflowStatusCell,{row:known,onOpen:open})));
  expect(host.querySelector('[role=alert]')).toBeNull();act(()=>button(state==='recorded'?'반영됨':'미반영').click());expect(host.querySelector('dialog')).toBeNull();
  await act(async()=>root.render(createElement(InflowStatusCell,{row:known,onToggle:persist})));
  const choices=[...host.querySelectorAll<HTMLButtonElement>('[role=radio]')];expect(choices).toHaveLength(2);expect(choices.every(choice=>!choice.disabled)).toBe(true);expect(choices[state==='recorded'?0:1]!.getAttribute('aria-checked')).toBe('true');
  await act(async()=>choices[state==='recorded'?1:0]!.click());expect(persist).toHaveBeenLastCalledWith(state==='excluded');
 }
 expect(open).toHaveBeenCalledTimes(2);expect(persist).toHaveBeenCalledTimes(2);
});
it('영구삭제 창에는 STEP 2 기록 설정 스위치가 없다(2026-10-25 belie: 상담·미팅 반영 설정 제거)',async()=>{
 await act(async()=>root.render(createElement(RecordingDialog,{row:blank(),deleting:true,onPreview:async()=>({inflow:0,contacts:0,meetings:0,rows:[]}),onConfirm:vi.fn(async()=>{}),onClose:vi.fn()})));
 expect(host.querySelector('input[type=checkbox]')).toBeNull();expect(host.textContent).toContain('휴지통에서 되돌릴 수 있어요');
});
it('prevents permanent deletion when the server reports an active linked record',async()=>{
 const confirm=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(RecordingDialog,{row:blank(),deleting:true,onPreview:async()=>({inflow:0,contacts:0,meetings:0,rows:[],blockedReason:'진행 중 미팅은 STEP 3에서 확인하세요.'}),onConfirm:confirm,onClose:vi.fn()})));
 await act(async()=>button('변경 내용 확인').click());expect(button('휴지통으로').disabled).toBe(true);expect(confirm).not.toHaveBeenCalled();expect(host.textContent).toContain('진행 중 미팅');
});
it('imports selected rows independently from all/partial inflow choices and passes row-level policy',async()=>{
 const apply=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(ImportDialog,{rows:[],onApply:apply,onClose:vi.fn(),onExisting:vi.fn()})));
 const area=host.querySelector('textarea')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(area,'사업자명,전화번호,유입일,공급처\n합성 A,010-0000-1201,2026-10-15,합성공급\n합성 B,010-0000-1202,2026-10-15,합성공급');area.dispatchEvent(new Event('input',{bubbles:true}));});
 act(()=>button('자동 배치').click());
 const check=(label:string)=>host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
 expect(check('유입 기록 전체 선택').checked).toBe(true);
 act(()=>check('1번 유입 기록').click());
 expect(check('유입 기록 전체 선택').indeterminate).toBe(true);
 expect(check('1번 추가 선택').checked).toBe(true);
 await act(async()=>button('선택한 2건 추가').click());
 expect(apply).toHaveBeenCalledWith([expect.objectContaining({company:'합성 A',recording:{inflow:false,activities:true}}),expect.objectContaining({company:'합성 B',recording:{inflow:true,activities:true}})],[]);
});

it('explains contact counting without changing saved outcome values, including recording off',async()=>{
 const row={...blank(),company:'합성 업체'},onResult=vi.fn();
 const render=async(activities:boolean)=>act(async()=>root.render(createElement(DbContactActions,{row:{...row,recording:{inflow:true,activities}},date:contactDraft(row).date,contact:false,onResult,onAsInfo:vi.fn(),onToggleContact:vi.fn()})));
 await render(true);
 const select=()=>host.querySelector<HTMLSelectElement>('select[aria-label="DB정보 컨택결과"]')!;
 expect([...select().options].map(o=>o.value)).toEqual(outcomes);
 expect([...select().options].find(o=>o.value==='AS예정')?.textContent).toContain('집계 제외');
 expect([...select().options].slice(0,4).every(o=>o.textContent?.endsWith('집계 제외'))).toBe(true);
 expect([...select().options].filter(o=>['컨택진행','상담 후 거절'].includes(o.value)).every(o=>o.textContent?.endsWith('STEP 2 컨택진행 +1'))).toBe(true);
 act(()=>{select().value='컨택진행';select().dispatchEvent(new Event('change',{bubbles:true}));});
 expect(onResult).toHaveBeenCalledWith('컨택진행',contactDraft(row).date);
 expect(host.textContent).toContain('업체별 하루 1건');
 await render(false);
 expect([...select().options].filter(o=>['컨택진행','상담 후 거절'].includes(o.value)).every(o=>o.textContent?.endsWith('STEP 2 기록 꺼짐'))).toBe(true);
 expect(host.textContent).not.toContain('+1');
});

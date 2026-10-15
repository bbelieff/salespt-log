// @vitest-environment jsdom
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {RecordingDialog} from '@/app/(app)/db-sheet/_components/RecordingDialog';
import InflowStatusCell from '@/app/(app)/db-sheet/_components/InflowStatusCell';
import {blank,outcomes} from '@/app/(app)/db-sheet/_components/model';
import {ContactFields,contactDraft} from '@/app/(app)/db-sheet/_components/ContactPanel';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
it('shows unknown for an unlinked historical row instead of claiming it was counted',async()=>{
 await act(async()=>root.render(createElement(InflowStatusCell,{row:{...blank(),company:'합성 업체'}})));
 expect(host.textContent).toBe('확인 필요');act(()=>button('확인 필요').click());expect(host.textContent).toContain('이전 유입 집계와 연결된 기록이 없어요');expect(host.textContent).not.toContain('유입 1건');
});
it('previews a retrospective change before confirming, and invalidates preview when settings change',async()=>{
 const preview=vi.fn(async()=>({inflow:1,contacts:2,meetings:0,rows:[]})),confirm=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(RecordingDialog,{row:{...blank(),recording:{inflow:false,activities:false}},onPreview:preview,onConfirm:confirm,onClose:vi.fn()})));
 act(()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
 await act(async()=>button('변경 내용 확인').click());expect(preview).toHaveBeenCalledWith({inflow:true,activities:true});expect(confirm).not.toHaveBeenCalled();expect(host.textContent).toContain('유입 1건 · 상담 2건');
 act(()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());expect(button('확인하고 반영')).toBeUndefined();
 await act(async()=>button('변경 내용 확인').click());await act(async()=>button('확인하고 반영').click());expect(confirm).toHaveBeenCalledWith({inflow:false,activities:false});
});
it('prevents permanent deletion when the server reports an active linked record',async()=>{
 const confirm=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(RecordingDialog,{row:blank(),deleting:true,onPreview:async()=>({inflow:0,contacts:0,meetings:0,rows:[],blockedReason:'진행 중 미팅은 STEP 3에서 확인하세요.'}),onConfirm:confirm,onClose:vi.fn()})));
 await act(async()=>button('변경 내용 확인').click());expect(button('영구삭제').disabled).toBe(true);expect(confirm).not.toHaveBeenCalled();expect(host.textContent).toContain('진행 중 미팅');
});
it('imports selected rows independently from all/partial inflow choices and passes row-level policy',async()=>{
 const apply=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(ImportDialog,{rows:[],onApply:apply,onClose:vi.fn(),onExisting:vi.fn()})));
 const area=host.querySelector('textarea')!;
 act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(area,'사업자명,전화번호,유입일,공급처\n합성 A,010-0000-1201,2026-10-15,합성공급\n합성 B,010-0000-1202,2026-10-15,합성공급');area.dispatchEvent(new Event('input',{bubbles:true}));});
 act(()=>button('내용 확인하기').click());
 const check=(label:string)=>host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
 expect(check('전체 STEP 2 유입에 기록').checked).toBe(true);
 act(()=>check('가져오기 1 유입 기록').click());
 expect(check('전체 STEP 2 유입에 기록').indeterminate).toBe(true);
 expect(check('가져오기 1 선택').checked).toBe(true);
 await act(async()=>button('확인한 2건 추가').click());
 expect(apply).toHaveBeenCalledWith([expect.objectContaining({company:'합성 A',recording:{inflow:false,activities:true}}),expect.objectContaining({company:'합성 B',recording:{inflow:true,activities:true}})],[]);
});

it('explains contact counting without changing saved outcome values, including recording off',async()=>{
 const row={...blank(),company:'합성 업체'},onResult=vi.fn();
 const render=async(activities:boolean)=>act(async()=>root.render(createElement(ContactFields,{row:{...row,recording:{inflow:true,activities}},draft:contactDraft(row),onChange:vi.fn(),onResult})));
 await render(true);
 const select=()=>host.querySelector<HTMLSelectElement>('select[aria-label="컨택내용 결과"]')!;
 expect([...select().options].map(o=>o.value)).toEqual(outcomes);
 expect([...select().options].slice(0,4).every(o=>o.textContent?.endsWith('집계 제외'))).toBe(true);
 expect([...select().options].slice(4).every(o=>o.textContent?.endsWith('STEP 2 컨택진행 +1'))).toBe(true);
 act(()=>{select().value='컨택진행';select().dispatchEvent(new Event('change',{bubbles:true}));});
 expect(onResult).toHaveBeenCalledWith('컨택진행',contactDraft(row).date);
 expect(host.textContent).toContain('업체별 하루 1건');
 await render(false);
 expect([...select().options].slice(4).every(o=>o.textContent?.endsWith('STEP 2 기록 꺼짐'))).toBe(true);
 expect(host.textContent).not.toContain('+1');
});

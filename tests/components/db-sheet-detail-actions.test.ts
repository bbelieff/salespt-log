// @vitest-environment jsdom
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {InflowRecordingDialog} from '@/app/(app)/db-sheet/_components/InflowRecordingDialog';
import {DbContactActions} from '@/app/(app)/db-sheet/_components/DbContactActions';
import {todayKST} from '@/util/week';
import InflowStatusCell from '@/app/(app)/db-sheet/_components/InflowStatusCell';
import {blank} from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLDialogElement.prototype.showModal=vi.fn();HTMLDialogElement.prototype.close=vi.fn();});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
it('opens DB information directly from the inflow status without another popup',async()=>{
 const open=vi.fn();await act(async()=>root.render(createElement(InflowStatusCell,{row:{...blank(),inflowStatus:{state:'recorded',count:1}},onOpen:open})));
 expect(button('반영 변경')).toBeUndefined();act(()=>button('반영됨').click());expect(open).toHaveBeenCalledOnce();expect(host.querySelector('dialog')).toBeNull();expect(host.querySelector('[role=radio]')).toBeNull();
});
it('previews removal and requires another preview after changing the choice',async()=>{
 const preview=vi.fn(async()=>({inflow:-1,contacts:0,meetings:0,rows:[]})),confirm=vi.fn(async()=>{});
 await act(async()=>root.render(createElement(InflowRecordingDialog,{row:{...blank(),inflowStatus:{state:'recorded',count:1}},onPreview:preview,onConfirm:confirm,onClose:vi.fn()})));
 act(()=>button('유입 미반영').click());await act(async()=>button('변경 내용 확인').click());expect(preview).toHaveBeenCalledWith(false);expect(confirm).not.toHaveBeenCalled();expect(host.textContent).toContain('이 DB의 유입 1건 반영 취소');
 act(()=>button('유입 반영').click());expect(button('확인하고 변경')).toBeUndefined();await act(async()=>button('변경 내용 확인').click());await act(async()=>button('확인하고 변경').click());expect(confirm).toHaveBeenCalledWith(true);
});
it('keeps failed or blocked changes open without claiming success',async()=>{
 const close=vi.fn(),confirm=vi.fn(async()=>{throw new Error('동시 수정 충돌');});const preview=vi.fn(async()=>({inflow:0,contacts:0,meetings:0,rows:[]}));
 await act(async()=>root.render(createElement(InflowRecordingDialog,{row:blank(),onPreview:preview,onConfirm:confirm,onClose:close})));
 await act(async()=>button('변경 내용 확인').click());await act(async()=>button('확인하고 변경').click());expect(host.textContent).toContain('동시 수정 충돌');expect(close).not.toHaveBeenCalled();expect(button('변경 내용 확인')).toBeDefined();
 act(()=>root.unmount());root=createRoot(host);await act(async()=>root.render(createElement(InflowRecordingDialog,{row:blank(),onPreview:async()=>({inflow:0,contacts:0,meetings:0,rows:[],blockedReason:'연결 근거 확인 필요'}),onConfirm:confirm,onClose:close})));
 await act(async()=>button('변경 내용 확인').click());expect(button('확인하고 변경').disabled).toBe(true);
});
it('sends AS completion independently and records the result on today (2026-10-26 — 컨택일 칸 제거)',async()=>{
 const result=vi.fn(),asInfo=vi.fn(),toggle=vi.fn();await act(async()=>root.render(createElement(DbContactActions,{row:{...blank(),result:'AS예정'},date:'2026-10-16',contact:false,onResult:result,onAsInfo:asInfo,onToggleContact:toggle})));
 act(()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());expect(asInfo).toHaveBeenCalledWith({asReceived:true});expect(result).not.toHaveBeenCalled();
 const select=host.querySelector('select')!;act(()=>{select.value='컨택진행';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(result).toHaveBeenCalledWith('컨택진행',todayKST());act(()=>button('컨택내용').click());expect(toggle).toHaveBeenCalledOnce();
});

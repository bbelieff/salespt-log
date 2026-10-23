// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import MobileViewOptions from '@/app/(app)/db-sheet/_components/MobileViewOptions';
import MobileFilterMenu from '@/app/(app)/db-sheet/_components/MobileFilterMenu';
import {Grid} from '@/app/(app)/db-sheet/_components/Grid';
import InflowStatusCell from '@/app/(app)/db-sheet/_components/InflowStatusCell';
import {blank} from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:1,height:1}] as unknown as DOMRectList);
});
afterEach(()=>{act(()=>root.unmount());host.remove();document.querySelectorAll('[data-test-extra]').forEach(el=>el.remove());vi.restoreAllMocks();vi.unstubAllGlobals();});
it('traps options focus, defers Escape to nested portals, then restores trigger focus',()=>{
 const trigger=document.createElement('button');trigger.dataset.testExtra='';document.body.append(trigger);trigger.focus();
 const close=vi.fn(),reset=vi.fn();
 const render=(open:boolean)=>act(()=>root.render(React.createElement(MobileViewOptions,{open,count:6,onClose:close,onReset:reset},React.createElement('button',null,'합성 옵션'))));
 render(true);const panel=document.querySelector('[role=dialog]')!,buttons=panel.querySelectorAll<HTMLButtonElement>('button');
 expect(document.activeElement).toBe(buttons[0]);buttons[buttons.length-1]!.focus();
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));expect(document.activeElement).toBe(buttons[0]);
 const nested=document.createElement('div');nested.className='sheet-filter-popover';nested.dataset.testExtra='';document.body.append(nested);
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(close).not.toHaveBeenCalled();nested.remove();
 act(()=>[...panel.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='필터 초기화')!.click());expect(reset).toHaveBeenCalledOnce();
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(close).toHaveBeenCalledOnce();
 render(false);expect(document.activeElement).toBe(trigger);
});
it('moves existing sort/table controls without remounting or duplicating Grid state',()=>{
 const target=document.createElement('div');target.dataset.testExtra='';document.body.append(target);
 const a={...blank(),id:'a',company:'합성 회사 가',owner:'합성 대표',phone:'000-0000-0000',date:'2026-10-01'},b={...a,id:'b',company:'합성 회사 나',date:'2026-10-02'};
 const onDetail=vi.fn(),onChange=vi.fn(),render=(mobileToolsTarget:HTMLElement|null)=>act(()=>root.render(React.createElement(Grid,{rows:[a,b],visible:['company'],fail:false,onChange,onDetail,mobileToolsTarget})));
 render(target);expect(host.querySelector('.sheet-mobile-switch')).toBeNull();
 const select=target.querySelector('select')!;
 act(()=>{select.value='date';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.querySelector('strong')!.textContent).toBe(b.company);
 render(null);expect(target.children).toHaveLength(0);expect(host.querySelector('.sheet-mobile-switch')).toBeNull();
 render(target);expect(target.querySelector('select')!.value).toBe('date');expect(host.querySelector('strong')!.textContent).toBe(b.company);
 const card=host.querySelector<HTMLButtonElement>('.sheet-mobile-card')!;expect(card.getAttribute('aria-label')).toContain(a.phone);
 act(()=>card.click());expect(onDetail).toHaveBeenCalledWith('b');expect(onChange).not.toHaveBeenCalled();
});
it('keeps an anchored filter open for nested portals and restores its own trigger after Escape',()=>{
 const anchor=document.createElement('button');anchor.dataset.testExtra='';document.body.append(anchor);anchor.focus();const close=vi.fn();
 act(()=>root.render(React.createElement(MobileFilterMenu,{title:'상태',anchor,onClose:close},React.createElement('button',null,'합성 상태'))));
 const menu=document.querySelector('[aria-label="상태 필터 선택"]')!;expect(document.activeElement).toBe(menu.querySelector('button'));
 const nested=document.createElement('div');nested.className='sheet-filter-popover';nested.dataset.testExtra='';document.body.append(nested);
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(close).not.toHaveBeenCalled();nested.remove();
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(close).toHaveBeenCalledOnce();
 act(()=>root.render(null));expect(document.activeElement).toBe(anchor);
 const outside=document.createElement('input');outside.dataset.testExtra='';document.body.append(outside);
 act(()=>root.render(React.createElement(MobileFilterMenu,{title:'상태',anchor,onClose:close},React.createElement('button',null,'합성 상태'))));outside.focus();
 act(()=>outside.dispatchEvent(new Event('pointerdown',{bubbles:true})));act(()=>root.render(null));expect(document.activeElement).toBe(outside);
});
it.each(['recorded','excluded'] as const)('preserves %s meaning in optional compact icons without editors',state=>{
 const row={...blank(),inflowStatus:{state,count:state==='recorded'?1:0}} as ReturnType<typeof blank>;
 act(()=>root.render(React.createElement(InflowStatusCell,{row,compact:true,iconOnly:true})));
 const icon=host.querySelector('[role=img]')!;expect(icon.getAttribute('aria-label')).toBe(`유입 ${state==='recorded'?'반영됨':'미반영'}`);
 expect(icon.getAttribute('title')).toBe(icon.getAttribute('aria-label'));expect(host.querySelector('button')).toBeNull();
});
it('retains full long identifiers and status in titles, accessible name and the original detail route',()=>{
 const row={...blank(),company:'합성 긴 업체명 '.repeat(12),owner:'합성 대표자명 '.repeat(5),phone:'000-0000-0000 / 내선 0000 '.repeat(4),result:'합성 긴 상태 '.repeat(8)},detail=vi.fn();
 act(()=>root.render(React.createElement(Grid,{rows:[row],visible:['company'],fail:false,onChange:vi.fn(),onDetail:detail,mobileToolsTarget:null})));
 const card=host.querySelector<HTMLButtonElement>('.sheet-mobile-card')!;
 for(const value of [row.company,row.phone,row.result])expect(card.getAttribute('aria-label')).toContain(value);
 expect(card.querySelector('strong')!.getAttribute('title')).toBe(row.company);expect(card.querySelector('.sheet-row-identity')!.getAttribute('title')).toContain(row.phone);expect(card.querySelector('.sheet-badge')!.getAttribute('title')).toBe(row.result);
 act(()=>card.click());expect(detail).toHaveBeenCalledWith(row.id);
});

// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import MobileViewOptions from '@/app/(app)/db-sheet/_components/MobileViewOptions';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,host:HTMLDivElement,frame:HTMLDivElement,trigger:HTMLButtonElement;
const close=vi.fn(),reset=vi.fn();
const render=(open=true,count=14)=>act(()=>root.render(React.createElement(MobileViewOptions,{open,count,onClose:close,onReset:reset},React.createElement('select',{'aria-label':'합성 정렬'},React.createElement('option',null,'기본')))));
beforeEach(()=>{host=document.createElement('div');frame=document.createElement('div');frame.dataset.dbSheetFrame='';frame.inert=false;trigger=document.createElement('button');trigger.className='sheet-view-options-trigger';frame.append(trigger);document.body.append(frame,host);trigger.focus();root=createRoot(host);vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:1,height:1}] as unknown as DOMRectList);});
afterEach(()=>{act(()=>root.unmount());host.remove();frame.remove();document.querySelectorAll('.sheet-filter-popover').forEach(e=>e.remove());vi.restoreAllMocks();vi.clearAllMocks();});
it('removes redundant apply action and keeps a visible count and immediate reset without closing',()=>{
 render();const dialog=document.querySelector('[role=dialog]')!;
 expect(dialog.querySelector('.sheet-options-apply')).toBeNull();expect(dialog.querySelector('.sheet-options-count')!.textContent).toBe('14건');
 const footer=dialog.querySelector('footer')!;expect(footer.querySelectorAll('button')).toHaveLength(1);expect(footer.textContent).toBe('필터 초기화');
 act(()=>footer.querySelector('button')!.click());expect(reset).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();render(true,3);expect(dialog.querySelector('.sheet-options-count')!.textContent).toBe('3건');
});
it('preserves inert, focus trap, nested Escape priority, outside closing and trigger restoration',()=>{
 render();expect(frame.inert).toBe(true);const dialog=document.querySelector('[role=dialog]')!,buttons=dialog.querySelectorAll<HTMLButtonElement>('button');
 // JSDOM groups comma-selector results; exercise its actual boundary inventory here.
 // Chromium's real footer→first Tab order is verified separately in the synthetic UI.
 const focusables=dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]');
 expect(document.activeElement).toBe(buttons[0]);focusables[focusables.length-1]!.focus();act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));expect(document.activeElement).toBe(buttons[0]);
 const child=document.createElement('div');child.className='sheet-filter-popover';document.body.append(child);act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(close).not.toHaveBeenCalled();child.remove();
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(close).toHaveBeenCalledOnce();render(false);expect(frame.inert).toBe(false);expect(document.activeElement).toBe(trigger);
 render();const backdrop=document.querySelector('.sheet-options-backdrop')!;act(()=>document.querySelector('[role=dialog]')!.dispatchEvent(new Event('pointerdown',{bubbles:true})));expect(close).toHaveBeenCalledTimes(1);const outside=new Event('pointerdown',{bubbles:true,cancelable:true});act(()=>backdrop.dispatchEvent(outside));expect(close).toHaveBeenCalledTimes(2);expect(outside.defaultPrevented).toBe(true);
});
it('scopes centered bounded popup and dense two-row controls without changing the page toolbar',()=>{
 const css=readFileSync('app/(app)/db-sheet/compact.css','utf8');expect(css).toContain('align-items:center;justify-content:center;padding:12px');expect(css).toContain('border-radius:16px');
 expect(css).toContain('.sheet-options-body{min-height:0;overflow:auto');expect(css).toContain('.sheet-mobile-switch{display:grid;grid-template-columns:minmax(0,1fr) auto');expect(css).toContain('.sheet-table-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))');
 expect(css).toContain('.sheet-filters :is(.search,.sheet-mobile-date-trigger,.sheet-mobile-status-trigger){height:34px;min-height:34px');
});

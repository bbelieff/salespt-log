// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Grid} from '@/app/(app)/db-sheet/_components/Grid';
import {blank,type Row} from '@/app/(app)/db-sheet/_components/model';
import {columnText,fitColumnWidth} from '@/app/(app)/db-sheet/_components/column-widths';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
const row=(company:string):Row=>({...blank(),company,id:company,inflowStatus:{state:'recorded',count:1}});
beforeEach(()=>{
 localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const width=this.parentElement?.className==='sheet-column-measure'?[...(this.textContent||'')].reduce((sum,c)=>sum+(c==='W'?16:c==='i'?3:12),0):0;return DOMRect.fromRect({width});});
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const handle=(name:string)=>host.querySelector<HTMLElement>(`[aria-label="${name} 너비 조절"]`)!;
const width=(name:string)=>Number(handle(name).getAttribute('aria-valuenow'));
const noop=()=>{};
function render(rows:Row[],sizingRows=rows){act(()=>root.render(React.createElement(Grid,{rows,sizingRows,visible:['inflow','company','owner'],onChange:noop,onDetail:noop,fail:false})));}

it('fits the widest rendered text rather than the text with most characters',()=>{
 const rows=[row('iiiiiiii'),row('WWW')];
 expect(fitColumnWidth('company',rows,42,text=>text==='WWW'?48:24,24)).toBe(72);
 expect(fitColumnWidth('owner',[],65,()=>0,24)).toBe(65);
});
it('sizes inflow using its visible state, including unknown, and formats displayed results',()=>{
 expect(columnText(row('가'),'inflow')).toBe('반영됨');
 expect(columnText({...row('나'),inflowStatus:undefined},'inflow')).toBe('확인 필요');
 expect(columnText({...row('다'),result:'AS예정'},'result')).toBe('AS신청');
 expect(columnText(row('가상\n긴 사업자명'),'company')).toBe('가상 긴 사업자명');
});
it('uses compact inflow width and grows company defaults with the longest saved value',()=>{
 render([row('짧음')]);const short=width('사업자명');
 expect(width('유입 반영')).toBeLessThan(122);
 render([row('짧음'),row('가상 긴 사업자 이름 주식회사')]);
 expect(width('사업자명')).toBeGreaterThan(short);
 expect(JSON.parse(localStorage.getItem('db-sheet-column-widths')!)).toEqual({});
});
it('keeps full-dataset sizing while filtering and preserves manual widths until double click',()=>{
 localStorage.setItem('db-sheet-column-widths',JSON.stringify({company:400}));
 const all=[row('짧음'),row('가상테스트긴이름사업자주식회사')];render(all);
 expect(width('사업자명')).toBe(400);
 render([all[0]!],all);expect(width('사업자명')).toBe(400);
 act(()=>handle('사업자명').dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
 const fitted=width('사업자명');expect(fitted).toBeLessThan(400);expect(fitted).toBeGreaterThan(100);
 expect(JSON.parse(localStorage.getItem('db-sheet-column-widths')!)).not.toHaveProperty('company');
 render([all[0]!],all);expect(width('사업자명')).toBe(fitted);
});
it('Home fits width without changing data or resetting row height',()=>{
 localStorage.setItem('db-sheet-column-widths',JSON.stringify({inflow:300}));
 localStorage.setItem('db-sheet-row-height-v20','60');render([row('회사')]);
 act(()=>handle('유입 반영').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})));
 expect(width('유입 반영')).toBeLessThan(122);
 expect(localStorage.getItem('db-sheet-row-height-v20')).toBe('60');
});
it('ignores malformed stored widths and keeps the existing resizing bounds',()=>{
 localStorage.setItem('db-sheet-column-widths','null');expect(()=>render([row('회사')])).not.toThrow();
 expect(fitColumnWidth('company',[row('가')],0,()=>5000,0)).toBe(800);
});

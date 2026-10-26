// @vitest-environment jsdom
/** 표 줄 선택·줄 누르면 DB정보·바로 고치는 두 칸·재통화 안내 줄·여러 줄 작업 줄·현재상태 버튼(2026-10-23 belie). 합성값. */
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Grid} from '@/app/(app)/db-sheet/_components/Grid';
import {BulkBar,DeleteUndoBar} from '@/app/(app)/db-sheet/_components/BulkBar';
import {StageControls} from '@/app/(app)/db-sheet/_components/StageControls';
import {blank,type Key} from '@/app/(app)/db-sheet/_components/model';
import {restoreVisibleColumns} from '@/app/(app)/db-sheet/_components/visible-columns';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const a={...blank(),id:'a',company:'예시상사',owner:'가상',phone:'010-0000-0001',date:'2026-10-20',result:'부재'},b={...a,id:'b',company:'샘플전기',phone:'010-0000-0002'};
const visible:Key[]=['company','owner','result','next','stage'];
function renderGrid(props:Partial<Parameters<typeof Grid>[0]>={}){
 const onDetail=vi.fn(),onChange=vi.fn(),onSelect=vi.fn();
 const view=(over:Partial<Parameters<typeof Grid>[0]>={})=>act(()=>root.render(createElement(Grid,{rows:[a,b],visible,fail:false,onChange,onDetail,onSelect,...props,...over})));
 view();return {onDetail,onChange,onSelect,view};
}
const byLabel=(label:string)=>host.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;

it('opens DB정보 from any non-quick cell instead of an inline editor',()=>{
 const {onDetail}=renderGrid();
 act(()=>byLabel('예시상사 사업자명 · DB정보 열기').click());
 act(()=>byLabel('예시상사 대표자 · DB정보 열기').click());
 expect(onDetail).toHaveBeenCalledTimes(2);expect(onDetail).toHaveBeenCalledWith('a');
 expect(host.querySelector('.sheet-editor')).toBeNull();
});
it('keeps 컨택결과 and 다음 연락일 editable inline',()=>{
 const {onChange,onDetail}=renderGrid();
 act(()=>byLabel('예시상사 컨택결과 바로 고치기').click());
 const select=host.querySelector<HTMLSelectElement>('select.sheet-editor')!;
 act(()=>{select.value='단순거절';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(onChange).toHaveBeenCalledWith('a','result','단순거절');
 act(()=>byLabel('예시상사 다음 연락일 바로 고치기').click());
 expect(host.querySelector<HTMLInputElement>('input.sheet-editor')!.type).toBe('date');
 expect(onDetail).not.toHaveBeenCalled();
});
it('shows the recall guidance under the row after an inline 재통화 with no 다음 연락일',()=>{
 const {view}=renderGrid();
 act(()=>byLabel('예시상사 컨택결과 바로 고치기').click());
 const select=host.querySelector<HTMLSelectElement>('select.sheet-editor')!;
 act(()=>{select.value='재통화';select.dispatchEvent(new Event('change',{bubbles:true}));});
 view({rows:[{...a,result:'재통화'},b]});
 const notice=host.querySelector('.sheet-recall-row')!;
 expect(notice.textContent).toContain('재통화 일정을 정해 주세요');
 act(()=>[...notice.querySelectorAll('button')].find(x=>x.textContent?.includes('다음 연락일 정하기'))!.click());
 expect(host.querySelector<HTMLInputElement>('input.sheet-editor')!.type).toBe('date');
 view({rows:[{...a,result:'재통화',next:'2026-10-27'},b]});
 expect(host.querySelector('.sheet-recall-row')).toBeNull();
});
it('does not show the guidance for rows that were already 재통화 when loaded',()=>{
 renderGrid({rows:[{...a,result:'재통화'},b]});
 expect(host.querySelector('.sheet-recall-row')).toBeNull();
});
it('selects rows by checkbox without opening DB정보 and selects all visible rows',()=>{
 const {onDetail,onSelect,view}=renderGrid();
 act(()=>byLabel('예시상사 선택').click());
 expect(onSelect).toHaveBeenLastCalledWith(['a'],true);expect(onDetail).not.toHaveBeenCalled();
 act(()=>byLabel('보이는 줄 전체 선택').click());
 expect(onSelect).toHaveBeenLastCalledWith(['a','b'],true);
 view({selected:new Set(['a'])});
 const all=byLabel('보이는 줄 전체 선택') as HTMLInputElement;
 expect(all.indeterminate).toBe(true);expect(all.checked).toBe(false);
 expect(host.querySelector('tr[data-selected]')).not.toBeNull();
 view({selected:new Set(['a','b'])});expect(all.checked).toBe(true);
});
it('renders the bulk bar above the table and disables actions until something is selected',()=>{
 const onInflow=vi.fn(),onDelete=vi.fn(),onClear=vi.fn();
 const bar=(count:number)=>createElement(BulkBar,{count,busy:false,message:'',onInflow,onDelete,onClear});
 renderGrid({bulkBar:bar(0)});
 const btn=(t:string)=>[...host.querySelectorAll<HTMLButtonElement>('.sheet-bulk-bar button')].find(x=>x.textContent===t);
 expect(btn('유입 반영')!.disabled).toBe(true);expect(btn('삭제')!.disabled).toBe(true);
 renderGrid({bulkBar:bar(2)});
 expect(host.querySelector('.sheet-bulk-bar')!.textContent).toContain('2줄 선택됨');
 act(()=>btn('유입 반영')!.click());act(()=>btn('유입 미반영')!.click());act(()=>btn('삭제')!.click());act(()=>btn('선택 해제')!.click());
 expect(onInflow.mock.calls).toEqual([[true],[false]]);expect(onDelete).toHaveBeenCalledOnce();expect(onClear).toHaveBeenCalledOnce();
});
it('undo bar shows the STEP 2 cleanup and calls undo',()=>{
 const onUndo=vi.fn();
 act(()=>root.render(createElement(DeleteUndoBar,{deleting:{count:3,inflow:2,contacts:1,meetings:0},onUndo})));
 expect(host.textContent).toContain('3건을 삭제했어요 · STEP 2 유입 2건·상담 1건도 함께 정리돼요');
 act(()=>[...host.querySelectorAll('button')].find(x=>x.textContent==='되돌리기')!.click());expect(onUndo).toHaveBeenCalledOnce();
});
it('stage controls: two end buttons, a return button when parked, nothing for meeting-linked rows',async()=>{
 const onStage=vi.fn(async()=>{});
 const render=(row:Parameters<typeof StageControls>[0]['row'])=>act(()=>root.render(createElement(StageControls,{row,onStage})));
 render({stage:'미컨택',meetingId:null,result:'부재'});
 const click=async(t:string)=>act(async()=>[...host.querySelectorAll('button')].find(x=>x.textContent===t)!.click());
 await click('장기관리로 넘기기');await click('진행종료');
 expect(onStage.mock.calls).toEqual([['장기관리'],['진행종료']]);
 render({stage:'장기관리',manualStage:'장기관리',meetingId:null,result:'부재'});
 expect(host.textContent).toContain('오늘 챙길 일에서 빠져 있어요');await click('다시 챙기기');expect(onStage).toHaveBeenLastCalledWith('DB컨택중');
 render({stage:'미팅예약',meetingId:'m1',result:'컨택진행'});expect(host.textContent).toBe('');
 render({stage:'진행종료',meetingId:null,result:'AS예정'});expect(host.textContent).toBe('');
});
it('shows a save failure from the stage buttons',async()=>{
 act(()=>root.render(createElement(StageControls,{row:{stage:'미컨택',meetingId:null,result:'부재'},onStage:async()=>{throw new Error('다른 화면에서 변경되었습니다.');}})));
 await act(async()=>[...host.querySelectorAll('button')].find(x=>x.textContent==='진행종료')!.click());
 expect(host.querySelector('[role=alert]')!.textContent).toBe('다른 화면에서 변경되었습니다.');
});
it('adds 다음 연락일·진행 단계 once to an older saved column choice',()=>{
 const store=(v:Record<string,string>)=>(k:string)=>v[k]??null;
 expect(restoreVisibleColumns(store({'db-sheet-v5-columns':JSON.stringify(['company','result','stage'])}))).toEqual(['company','result','step','next']); // 현재상태 칸은 2026-10-25 제거
 expect(restoreVisibleColumns(store({'db-sheet-v6-columns':JSON.stringify(['company','result'])}))).toEqual(['company','result','step']);
 expect(restoreVisibleColumns(store({'db-sheet-v7-columns':JSON.stringify(['company','result'])}))).toEqual(['company','result']); // v7 에서 끈 선택은 존중
 expect(restoreVisibleColumns(store({'db-sheet-v3-columns':JSON.stringify(['supplier','date','result'])}))).toEqual(['channel','supplier','date','inflow','result','step','next']);
 expect(restoreVisibleColumns(store({}))).toBeNull();
});

it('컨택결과 꼬리표는 장기관리·진행종료만, 미팅 뒤는 진행 단계 바로가기(2026-10-25)',async()=>{
 const {resultTag,stepShortcut}=await import('@/app/(app)/db-sheet/_components/model');
 expect(resultTag({stage:'DB컨택중',result:'재통화',meetingId:null})).toBe('');
 expect(resultTag({stage:'계약',result:'컨택진행',meetingId:'m1'})).toBe('');
 expect(resultTag({stage:'장기관리',result:'단순거절',meetingId:null})).toBe('장기관리');
 expect(resultTag({stage:'진행종료',result:'AS예정',meetingId:null})).toBe('');
 expect(stepShortcut({stage:'DB컨택중',meetingId:null})).toBeNull();
 expect(stepShortcut({stage:'미팅예약',meetingId:'m1',contact:{meetingDate:'2026-10-23'}})).toEqual({label:'STEP 3 일정',href:'/schedule?date=2026-10-23&focus=m1',state:'미팅예약'});
 expect(stepShortcut({stage:'미팅변경',meetingId:'m1',effectiveMeetingId:'m2'})?.href).toBe('/schedule?focus=m2');
 expect(stepShortcut({stage:'수납대기',meetingId:'m1',contractRow:7})).toEqual({label:'STEP 4 실무/수납',href:'/payment?row=7',state:'수납대기'});
 expect(stepShortcut({stage:'미팅 삭제됨',meetingId:'m1'})).toBeNull();
});
it('진행 단계 분류 — 재통화 이하 STEP 1.5 · 미팅예약/컨택 후 거절 STEP 2 · 미팅 STEP 3 · 계약 STEP 4, 정렬은 그 순서', async () => {
 const {stepStage}=await import('@/app/(app)/db-sheet/_components/model');
 const base={stage:'',meetingId:null as string|null};
 for(const result of ['미컨택','부재','단순거절','재통화','AS예정'])expect(stepStage({...base,result})).toMatchObject({step:'1.5',label:'STEP 1.5 DB관리시트',href:null});
 expect(stepStage({...base,result:'컨택진행'})).toMatchObject({step:'2',name:'컨택관리',label:'STEP 2 컨택관리',href:'/contact',state:'미팅예약'});
 expect(stepStage({...base,result:'상담 후 거절'})).toMatchObject({step:'2',state:'컨택 후 거절'});
 expect(stepStage({result:'컨택진행',stage:'미팅예약',meetingId:'m1'})).toMatchObject({step:'3',name:'일정·계약',label:'STEP 3 일정·계약'});
 expect(stepStage({result:'컨택진행',stage:'수납대기',meetingId:'m1',contractRow:7})).toMatchObject({step:'4'});
 const ranks=[stepStage({...base,result:'미컨택'}),stepStage({...base,result:'재통화'}),stepStage({...base,result:'컨택진행'}),stepStage({...base,result:'상담 후 거절'}),stepStage({result:'컨택진행',stage:'미팅예약',meetingId:'m1'}),stepStage({result:'컨택진행',stage:'계약',meetingId:'m1',contractRow:3})].map(s=>s.rank);
 expect([...ranks].sort((x,y)=>x-y)).toEqual(ranks);
});

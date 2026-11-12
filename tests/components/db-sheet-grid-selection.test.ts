// @vitest-environment jsdom
/** 표 줄 선택·줄 누르면 DB정보·바로 고치는 두 칸·재통화 안내 줄·여러 줄 작업 줄·현재상태 버튼(2026-10-23 belie). 합성값. */
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Grid} from '@/app/(app)/db-sheet/_components/Grid';
import {BulkBar,TrashNoticeBar} from '@/app/(app)/db-sheet/_components/BulkBar';
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
 expect(host.querySelector('button.sheet-editor.custom-date-wrapper')).not.toBeNull();expect(document.querySelector('.date-pop')).not.toBeNull();
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
 expect(host.querySelector('button.sheet-editor.custom-date-wrapper')).not.toBeNull();expect(document.querySelector('.date-pop')).not.toBeNull();
 view({rows:[{...a,result:'재통화',next:'2026-10-27'},b]});
 expect(host.querySelector('.sheet-recall-row')).toBeNull();
});
it('다음 연락일 셀 편집기 = 요일 달력 — 고르면 바로 저장, 지우기는 빈 값 저장, Esc 는 달력 먼저·다음 Esc 는 취소',()=>{
 const {onChange}=renderGrid();
 act(()=>byLabel('예시상사 다음 연락일 바로 고치기').click());
 const day=document.querySelector<HTMLButtonElement>('.date-pop-day:not(.is-out)')!;
 act(()=>day.click());
 expect(onChange).toHaveBeenCalledWith('a','next',day.getAttribute('aria-label'));
 expect(host.querySelector('.sheet-editor')).toBeNull();
 act(()=>byLabel('예시상사 다음 연락일 바로 고치기').click());
 const clear=document.querySelector<HTMLButtonElement>('.date-pop-clear')!;
 expect(clear.disabled).toBe(true); // 값이 없으면 지울 것도 없다
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(document.querySelector('.date-pop')).toBeNull();
 expect(host.querySelector('.sheet-editor')).not.toBeNull(); // 첫 Esc 는 달력만 닫는다
 act(()=>host.querySelector('.sheet-editor')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(host.querySelector('.sheet-editor')).toBeNull();
 expect(onChange).toHaveBeenCalledTimes(1);
});
it('다음 연락일 편집기 — 값이 있으면 지우기로 빈 값 저장, Enter 는 현재 값 저장(달력을 다시 열지 않음)',()=>{
 const {onChange}=renderGrid({rows:[{...a,next:'2026-10-27'},b]});
 act(()=>byLabel('예시상사 다음 연락일 바로 고치기').click());
 expect(host.querySelector('.sheet-editor')!.textContent).toContain('2026-10-27 (화)');
 act(()=>document.querySelector<HTMLButtonElement>('.date-pop-clear')!.click());
 expect(onChange).toHaveBeenLastCalledWith('a','next','');
 act(()=>byLabel('예시상사 다음 연락일 바로 고치기').click());
 act(()=>host.querySelector('.sheet-editor')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 expect(onChange).toHaveBeenLastCalledWith('a','next','2026-10-27');
 expect(host.querySelector('.sheet-editor')).toBeNull();
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
 const onInflow=vi.fn(),onDelete=vi.fn(),onClear=vi.fn(),onSupplier=vi.fn();
 const bar=(count:number)=>createElement(BulkBar,{count,busy:false,message:'',onInflow,onSupplier,onDelete,onClear});
 renderGrid({bulkBar:bar(0)});
 const btn=(t:string)=>[...host.querySelectorAll<HTMLButtonElement>('.sheet-bulk-bar button')].find(x=>x.textContent===t);
 expect(btn('유입 반영')!.disabled).toBe(true);expect(btn('삭제')!.disabled).toBe(true);
 renderGrid({bulkBar:bar(2)});
 expect(host.querySelector('.sheet-bulk-bar')!.textContent).toContain('2줄 선택됨');
 act(()=>btn('유입 반영')!.click());act(()=>btn('유입 미반영')!.click());act(()=>btn('공급처 바꾸기')!.click());act(()=>btn('삭제')!.click());act(()=>btn('선택 해제')!.click());
 expect(onInflow.mock.calls).toEqual([[true],[false]]);expect(onSupplier).toHaveBeenCalledOnce();expect(onDelete).toHaveBeenCalledOnce();expect(onClear).toHaveBeenCalledOnce();
});
it('trash notice shows the STEP 2 cleanup and opens the trash (2026-10-26)',()=>{
 const onOpen=vi.fn(),onClose=vi.fn();
 act(()=>root.render(createElement(TrashNoticeBar,{deleting:{count:3,inflow:2,contacts:1,meetings:0},onOpen,onClose})));
 expect(host.textContent).toContain('3건을 휴지통으로 옮겼어요 · 일별 기록 유입 2건·상담 1건도 함께 정리돼요');
 act(()=>[...host.querySelectorAll('button')].find(x=>x.textContent==='휴지통 열기')!.click());expect(onOpen).toHaveBeenCalledOnce();
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
it('진행 단계 분류 — 재통화 이하 「STEP 2 컨택 전」 · 미팅예약/컨택 후 거절 「STEP 2 컨택 완료」 · 미팅 STEP 3 · 계약 STEP 4, 정렬은 그 순서(2026-11-07 1.5·2 통합)', async () => {
 const {stepStage}=await import('@/app/(app)/db-sheet/_components/model');
 const base={stage:'',meetingId:null as string|null};
 for(const result of ['미컨택','부재','단순거절','재통화','AS예정'])expect(stepStage({...base,result})).toMatchObject({step:'1.5',name:'컨택 전',label:'STEP 2 컨택 전',href:null});
 expect(stepStage({...base,result:'컨택진행'})).toMatchObject({step:'2',name:'컨택 완료',label:'STEP 2 컨택 완료',href:null,state:'일정 미등록'});
 expect(stepStage({...base,result:'상담 후 거절'})).toMatchObject({step:'2',state:'컨택 후 거절'});
 expect(stepStage({result:'컨택진행',stage:'미팅예약',meetingId:'m1'})).toMatchObject({step:'3',name:'일정·계약',label:'STEP 3 일정·계약'});
 expect(stepStage({result:'컨택진행',stage:'수납대기',meetingId:'m1',contractRow:7})).toMatchObject({step:'4'});
 const ranks=[stepStage({...base,result:'미컨택'}),stepStage({...base,result:'재통화'}),stepStage({...base,result:'컨택진행'}),stepStage({...base,result:'상담 후 거절'}),stepStage({result:'컨택진행',stage:'미팅예약',meetingId:'m1'}),stepStage({result:'컨택진행',stage:'계약',meetingId:'m1',contractRow:3})].map(s=>s.rank);
 expect([...ranks].sort((x,y)=>x-y)).toEqual(ranks);
});

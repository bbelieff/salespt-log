// @vitest-environment jsdom
/** DB 목록 빈 칸 안내(2026-11-10 UI 점검): 불러오는 중 / DB 0건(첫 DB 추가) / 조건에 안 맞음을 나눠 보여 준다. 합성값. */
import React,{act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Grid} from '@/app/(app)/db-sheet/_components/Grid';
import type {Key} from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
const visible:Key[]=['company','owner'];
const render=(p:Partial<Parameters<typeof Grid>[0]>)=>act(()=>root.render(createElement(Grid,{rows:[],visible,fail:false,onChange:vi.fn(),onDetail:vi.fn(),...p})));

it('★불러오는 중엔 「조건에 맞는 업체가 없습니다」를 띄우지 않는다',()=>{
 render({loading:true,total:0});
 expect(host.textContent).toContain('DB 목록을 불러오고 있어요');
 expect(host.textContent).not.toContain('조건에 맞는');
});
it('★DB가 하나도 없으면 첫 DB 추가를 안내하고 버튼을 준다',()=>{
 const onAdd=vi.fn();render({total:0,onAdd});
 expect(host.textContent).toContain('아직 DB가 없어요');
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='＋ DB 추가')!.click());
 expect(onAdd).toHaveBeenCalledTimes(1);
});
it('DB는 있는데 걸러져 0건이면 지금 안내 그대로',()=>{
 render({total:5});
 expect(host.textContent).toContain('조건에 맞는 업체가 없습니다');
});
it('DB 목록 화면이 불러오는 상태·전체 건수·추가를 넘긴다',()=>{
 const page=readFileSync('app/(app)/db-sheet/page.tsx','utf8');
 expect(page).toContain('loading={data.loading} total={rows.length} onAdd={()=>setImporting(true)}');
});

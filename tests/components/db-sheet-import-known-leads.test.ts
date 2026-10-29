// @vitest-environment jsdom
/**
 * 같은 구글시트를 다시 가져와도 새 DB만(belie 2026-10-29). 값은 모두 가상.
 * 목록·휴지통에 이미 있는 업체는 표·확인 칸에서 빠지고 「이미 있는 N건 제외」로 접힌다.
 */
import React, {act, createElement as h} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
import {blank, type Row} from '@/app/(app)/db-sheet/_components/model';
import type {DbSheetTrashItem} from '@/types/db-sheet';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
beforeEach(()=>{localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===name)!;
function fill(selector:string,value:string){
 const el=host.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector)!;
 act(()=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
}
const HEAD=['접수시간','국세체납','사업자번호','이름','전화번호'].join('\t');
const line=(day:string,biz:string,name:string,phone:string)=>[`2026-10-${day} 10:00`,'정상',biz,name,phone].join('\t');
const sheet=[ '가상님 디비', HEAD,
 line('27','100-00-00001','가상일','010-0000-0001'),
 line('28','100-00-00002','가상이','010-0000-0002'),
 line('29','100-00-00003','가상삼','010-0000-0003'),
].join('\n');
const existing:Row[]=[{...blank(),id:'row-1',owner:'가상일',phone:'010-0000-0001',biz:'100-00-00001'}];
const trash:DbSheetTrashItem[]=[{id:'trash-2',company:'',owner:'가상이',phone:'010-0000-0002',channel:'매입DB',supplier:'가상 공급처',date:'2026-10-28',deletedAt:'2026-10-29T00:00:00Z'}];

async function open(rows:Row[]=existing,listTrash=vi.fn(async()=>trash)){
 const apply=vi.fn(async(_rows:Row[])=>{});
 await act(async()=>root.render(h(ImportDialog,{accountKey:'synthetic-account',rows,onApply:apply,onClose:vi.fn(),onExisting:vi.fn(),onListTrash:listTrash})));
 fill('#ai-source',sheet);act(()=>button('자동 배치').click());
 return {apply,listTrash};
}

it('목록·휴지통에 있는 업체는 빼고 새 DB만 표에 남긴다',async()=>{
 const {apply,listTrash}=await open();
 expect(listTrash).toHaveBeenCalledTimes(1);
 expect(host.textContent).toContain('새 DB 1건');
 expect(host.textContent).toContain('이미 있는 2건 제외');
 const names=[...host.querySelectorAll<HTMLInputElement>('input[aria-label$=" owner"]')].map(i=>i.value);
 expect(names).toEqual(['가상삼']);
 fill('[aria-label="가져오기 공급처"]','가상 공급처');
 act(()=>{const s=host.querySelector<HTMLSelectElement>('[aria-label="가져오기 유형"]')!;s.value='매입DB';s.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(button('선택한 1건 추가').disabled).toBe(false);
 await act(async()=>button('선택한 1건 추가').click());
 expect(apply.mock.calls[0]![0]).toMatchObject([{owner:'가상삼',phone:'010-0000-0003'}]);
});

it('「보기」로 제외한 업체를 펼쳐 볼 수 있고, 모두 있으면 「새 DB가 없어요」',async()=>{
 await open();
 act(()=>button('보기').click());
 expect([...host.querySelectorAll<HTMLInputElement>('input[aria-label$=" owner"]')].map(i=>i.value)).toEqual(['가상일','가상이','가상삼']);
 act(()=>root.unmount());root=createRoot(host);
 const all:Row[]=[...existing,{...blank(),id:'row-3',owner:'가상삼',phone:'010-0000-0003'}];
 await open(all);
 expect(host.textContent).toContain('새 DB가 없어요');
 expect(button('선택한 0건 추가').disabled).toBe(true);
});

// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { readImportFile } from '@/app/(app)/db-sheet/_components/import-file';
import { ImportDialog } from '@/app/(app)/db-sheet/_components/ImportDialog';
import { parse } from '@/app/(app)/db-sheet/_components/model';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock('@/app/(app)/db-sheet/_components/SupplierInput', () => ({ default: ({onValueChange,...props}: {onValueChange:(v:string)=>void}) => createElement('input', {...props,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onValueChange(e.target.value)}) }));

function fixture(bookType: 'xlsx' | 'biff8', date1904 = false) {
  const book = XLSX.utils.book_new();
  book.Workbook = { WBProps: { date1904 } };
  const sheet = XLSX.utils.aoa_to_sheet([
    ['사업자명', '대표자', '전화번호', '유입일', '공급처', '채널', '메모'],
    ['합성 엑셀상사', '김샘플', 1000001234, date1904 ? 44848 : 46310, '합성 공급', '직접생산', '첫 줄\n"상담"\t메모'],
  ]);
  sheet.C2.z = '000-0000-0000';
  sheet.D2.z = 'yyyy-mm-dd';
  XLSX.utils.book_append_sheet(book, sheet, 'DB목록');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['사업자명'], ['가져오지 않을 두 번째 시트']]), '참고');
  const buffer = XLSX.write(book, { bookType, type: 'array', compression: false }) as ArrayBuffer;
  return { name: bookType === 'xlsx' ? '합성.XLSX' : '합성.XLS', size: buffer.byteLength, arrayBuffer: async () => buffer };
}

it.each(['xlsx','biff8'] as const)('%s reads the first sheet and preserves Korean, telephone, date and quoted cells', async type => {
  const rows = parse(await readImportFile(fixture(type)));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ company: '합성 엑셀상사', owner: '김샘플', phone: '010-0000-1234', date:'2026-10-15', channel:'직접생산' });
  expect(rows[0]!.memo).toContain('상담');
});
it.each(['xlsx','biff8'] as const)('%s reads Excel 1904 dates', async type=>{
  expect(parse(await readImportFile(fixture(type,true)))[0]!.date).toBe('2026-10-15');
});
it('rejects oversized / unsupported / corrupt files without treating them as text', async()=>{
  const file=fixture('biff8'); const read=vi.fn(file.arrayBuffer);
  await expect(readImportFile({...file,size:5*1024*1024+1,arrayBuffer:read})).rejects.toThrow('5MB');
  expect(read).not.toHaveBeenCalled();
  await expect(readImportFile({...file,name:'file.exe'})).rejects.toThrow('지원');
  for(const extension of ['xls','xlsx']) await expect(readImportFile({name:`bad.${extension}`,size:4,arrayBuffer:async()=>new ArrayBuffer(4)})).rejects.toThrow('엑셀');
});
it('keeps CSV / TSV / TXT and empty file feedback',async()=>{
  const buffer=new TextEncoder().encode('사업자명\t전화번호\n합성 회사\t01000001234').buffer;
  for(const ext of ['csv','tsv','txt']) expect(parse(await readImportFile({name:`sample.${ext}`,size:buffer.byteLength,arrayBuffer:async()=>buffer}))[0]!.company).toBe('합성 회사');
  await expect(readImportFile({name:'empty.txt',size:0,arrayBuffer:async()=>new ArrayBuffer(0)})).rejects.toThrow('빈 파일');
});

let host:HTMLDivElement, root:Root;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===name)!;
it.each([['xlsx','change'],['biff8','drop']] as const)('%s %s reaches preview without saving and preserves inflow selection',async(type,method)=>{
  const apply=vi.fn(async()=>{});
  await act(async()=>root.render(createElement(ImportDialog,{rows:[],onApply:apply,onClose:vi.fn(),onExisting:vi.fn()})));
  expect(host.querySelector('input[type=file]')!.getAttribute('accept')).toContain('.xls,');
  const file=fixture(type);
  await act(async()=>{
    const event=new Event(method,{bubbles:true,cancelable:true});
    const target=method==='drop'?host.querySelector('.sheet-file-drop')!:host.querySelector('input[type=file]')!;
    if(method==='drop') Object.defineProperty(event,'dataTransfer',{value:{files:[file],types:['Files']}});
    else Object.defineProperty(target,'files',{value:[file],configurable:true});
    target.dispatchEvent(event);
  });
  await act(async()=>{await vi.waitFor(()=>expect(host.querySelector('textarea')!.value).toContain('합성 엑셀상사'));});
  act(()=>button('내용 확인하기').click());
  expect(host.textContent).toContain('목록 1건 추가 · 유입 +1');
  expect(apply).not.toHaveBeenCalled();
  act(()=>host.querySelector<HTMLInputElement>('input[aria-label="전체 STEP 2 유입에 기록"]')!.click());
  expect(host.textContent).toContain('목록 1건 추가 · 유입 +0');
  await act(async()=>button('확인한 1건 추가').click());
  expect(apply).toHaveBeenCalledWith([expect.objectContaining({company:'합성 엑셀상사',recording:{inflow:false,activities:true}})],[]);
});

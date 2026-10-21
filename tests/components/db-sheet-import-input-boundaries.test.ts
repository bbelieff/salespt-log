// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {analyzeImport} from '@/app/(app)/db-sheet/_components/adaptive-import';
import {readImportFile} from '@/app/(app)/db-sheet/_components/import-file';
const header=['사업자명','대표자','전화번호','유입일'];
const customer=['합성달빛공방','김가상','01000002001','2026-10-21'];
const expected={company:'합성달빛공방',owner:'김가상',phone:'010-0000-2001',date:'2026-10-21'};
const blankPrefixes=['\n','\r\n',' \t \n','\u00a0\n','\u3000\n','\u200b\n','\uFEFF\n'];
describe('first actual content and import boundary acceptance (synthetic)',()=>{
 it.each([',','\t',';'].flatMap(sep=>blankPrefixes.map(prefix=>({sep,prefix}))))('skips blank prefix $prefix before $sep heading without losing the first customer',({sep,prefix})=>{
  const result=analyzeImport(prefix+header.join(sep)+'\n'+customer.join(sep));
  expect(result.header).toBe(true);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead).toMatchObject(expected);expect(result.items[0]!.questions).toHaveLength(0);
 });
 it.each(['\n','\r\n','\r'])('understands %j row endings in TSV, including CR-only files',ending=>{
  const result=analyzeImport([header.join('\t'),customer.join('\t'),customer.join('\t').replace('합성달빛공방','합성온유상사')].join(ending));
  expect(result.items).toHaveLength(2);expect(result.items[0]!.lead).toMatchObject(expected);expect(result.items[1]!.lead.company).toBe('합성온유상사');
 });
 it('keeps a newline inside a quoted memo within the same CSV customer',()=>{
  const raw=header.join(',')+',메모\n'+customer.join(',')+',"첫 줄\n\n둘째 줄"';
  const result=analyzeImport(raw);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead.memo).toContain('첫 줄\n\n둘째 줄');
 });
 it.each(['\n','\u00a0\n','\u200b\n'])('keeps the first headerless customer after blank prefix %j',prefix=>{
  const result=analyzeImport(prefix+customer.join('\t'));expect(result.header).toBe(false);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead).toMatchObject(expected);
 });
 it.each([true,false])('keeps labeled-looking lines inside a quoted CSV memo (header=%j)',hasHeader=>{
  const raw=(hasHeader?header.join(',')+',메모\n':'')+customer.join(',')+',"첫 줄\n대표자: 다른 이름이 아닌 메모\n마지막 줄"';
  const result=analyzeImport(raw);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead).toMatchObject(expected);expect(result.items[0]!.lead.memo).toContain('대표자: 다른 이름이 아닌 메모');
 });
 it.each([',',';'])('ignores delimiter characters inside a quoted heading (%s)',sep=>{
  const other=sep===','?'\t':',';
  const raw=['사업자명',`"원본${other}분류"`,'대표자','전화번호','유입일'].join(sep)+'\n'+[customer[0],'합성 업종',...customer.slice(1)].join(sep);
  const result=analyzeImport(raw);expect(result.header).toBe(true);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead).toMatchObject(expected);expect(result.items[0]!.lead.memo).toContain('합성 업종');
 });
 it.each([true,false])('decodes UTF16 with blank first lines before analysis (little endian=%j)',little=>{
  const text='\uFEFF\u3000\r\n'+header.join('\t')+'\r\n'+customer.join('\t');
  const bytes=new Uint8Array(text.length*2);for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);bytes[i*2]=little?n&255:n>>8;bytes[i*2+1]=little?n>>8:n&255;}
  return readImportFile({name:'synthetic.txt',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer}).then(raw=>expect(analyzeImport(raw).items[0]!.lead).toMatchObject(expected));
 });
 it.each(['""\n',',,,\n','\t\t\n',';;;\n'].flatMap(prefix=>[',','\t',';'].map(sep=>({prefix,sep}))))('skips logically empty records before the first heading ($prefix/$sep)',({prefix,sep})=>{
  const result=analyzeImport(prefix+header.join(sep)+'\n'+customer.join(sep));expect(result.header).toBe(true);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead).toMatchObject(expected);
 });
 it('understands a quoted multiline first heading',()=>{
  const result=analyzeImport('"기타\n사항",'+header.join(',')+'\n합성메모,'+customer.join(','));
  expect(result.header).toBe(true);expect(result.items).toHaveLength(1);expect(result.items[0]!.lead).toMatchObject(expected);expect(result.items[0]!.lead.memo).toContain('합성메모');
 });
 it('rejects an unterminated quoted first CSV record instead of guessing fields',()=>{
  expect(()=>analyzeImport('"합성달빛공방,김가상,01000002001')).toThrow('따옴표');
 });
 it('skips invisible blank rows in the middle but preserves meaningful cell contents',()=>{
  const result=analyzeImport(header.join('\t')+'\n'+customer.join('\t')+'\n\u200b\t\u2060\t\n'+customer.join('\t').replace('합성달빛공방','합성\u200b온유상사'));
  expect(result.items).toHaveLength(2);expect(result.items[1]!.lead.company).toBe('합성\u200b온유상사');
 });
 it('keeps CRLF, escaped quotes and blank lines inside a memo',()=>{
  const result=analyzeImport(header.join(',')+',메모\r\n'+customer.join(',')+',"첫 줄\r\n\r\n""상담"" 메모"');
  expect(result.items).toHaveLength(1);expect(result.items[0]!.lead.memo).toContain('첫 줄\n\n"상담" 메모');
 });
 it('uses the same first-content recognition for a CSV file as pasted text',async()=>{
  const bytes=new TextEncoder().encode('\u00a0\n'+header.join(',')+'\n'+customer.join(','));
  const raw=await readImportFile({name:'synthetic.csv',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer});
  expect(analyzeImport(raw).items[0]!.lead).toMatchObject(expected);
 });
});

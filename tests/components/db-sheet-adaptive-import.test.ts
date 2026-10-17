// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {analyzeImport,resolveImportQuestion,normalizeImportPhone} from '@/app/(app)/db-sheet/_components/adaptive-import';
import {loadImportRules,saveImportRules} from '@/app/(app)/db-sheet/_components/adaptive-import-profiles';
import {metaSample} from '@/app/(app)/db-sheet/_components/model';

describe('adaptive import production parser',()=>{
 it('keeps first customer without a header and normalizes +82 and 010',()=>{
  const a=analyzeImport('달빛공방,김가상,+82 10 0000 2001,2026-10-17\n새봄식품,박가상,01000002002,2026-10-18');
  expect(a.header).toBe(false);expect(a.items).toHaveLength(2);
  expect(a.items[0]!.lead).toMatchObject({company:'달빛공방',owner:'김가상',phone:'010-0000-2001',date:'2026-10-17'});
  expect(a.items[0]!.lead.memo).toContain('+82 10 0000 2001');
 });
 it('rejects more than the API limit before sending customer rows',()=>{
  expect(()=>analyzeImport(Array.from({length:501},()=> '달빛공방,01000002001').join('\n'))).toThrow('500건 이하');
 });
 it('imports a single headerless two-column record',()=>{
  const a=analyzeImport('달빛 공방,01000002001');expect(a.tabular).toBe(true);expect(a.items).toHaveLength(1);expect(a.items[0]!.lead.phone).toBe('010-0000-2001');
 });
 it('does not confuse a 10-digit business number with a mobile number',()=>{
  const a=analyzeImport('달빛공방,1000002001,2026-10-17').items[0]!;
  expect(a.lead.phone).toBe('');expect(a.questions[0]!.choices.map(c=>c.key)).toEqual(['phone','biz','keep']);
  expect(resolveImportQuestion(a,a.questions[0]!.id,'phone').lead.phone).toBe('010-0000-2001');
  expect(resolveImportQuestion(a,a.questions[0]!.id,'phone').adjusted).toBe(false);
  expect(resolveImportQuestion(a,a.questions[0]!.id,'biz').lead.biz).toBe('1000002001');
 });
 it('preserves Meta source/channel, dates, names and unknown original columns',()=>{
  const a=analyzeImport(metaSample);
  expect(a.header).toBe(true);expect(a.items).toHaveLength(2);
  expect(a.items[0]!.lead).toMatchObject({supplier:'메타 광고',channel:'직접생산',date:'2026-10-11',phone:'010-0000-4001',funds:'5000만원'});
  expect(a.items[0]!.lead.memo).toContain('ad_sample');expect(a.items.every(item=>item.questions.length===0)).toBe(true);
 });
 it('parses free text and keeps unrelated words',()=>{
  const a=analyzeImport('달빛공방 김가상 +82 10 0000 3001 2026-10-17\n새봄식품 박가상 010-0000-3004 2026-10-17 5천만원');
  expect(a.items).toHaveLength(2);expect(a.items[0]!.lead.phone).toBe('010-0000-3001');
  expect(a.items[1]!.questions[0]!.choices.map(v=>v.key)).toEqual(['funds','sales','keep']);
 });
 it('preserves labeled messages and explicit fields even with comma amounts',()=>{
  const a=analyzeImport('사업자명: 달빛공방\n대표자: 김가상\n연락처: +82 10 0000 2001\n필요자금: 5,000만원\n추가 요청: 오후 전화');
  expect(a.items[0]!.lead).toMatchObject({company:'달빛공방',owner:'김가상',phone:'010-0000-2001',funds:'5,000만원'});
  expect(a.items[0]!.lead.memo).toContain('오후 전화');
 });
 it('keeps CSV quoted newlines and rejects broken quotes',()=>{
  expect(analyzeImport('사업자명,전화번호,메모\n달빛공방,01000002001,"첫줄\n다음줄"').items[0]!.lead.memo).toContain('첫줄\n다음줄');
  expect(()=>analyzeImport('사업자명,전화번호\n"닫히지 않음,01000002001')).toThrow('따옴표');
 });
 it('never silently replaces a known field with an uncertain value',()=>{
  const a=analyzeImport('달빛공방,온유상사,01000002001').items[0]!;
  expect(a.lead.company).toBe('달빛공방');expect(a.questions).toHaveLength(1);
  expect(()=>resolveImportQuestion(a,a.questions[0]!.id,'company')).toThrow('이미 값');
 });
 it('supports explicit column mapping and rejects duplicate field mappings',()=>{
  const a=analyzeImport('푸른숲,1000002001,2026-10-17','no',{0:'company',1:'phone'});
  expect(a.items[0]!.lead).toMatchObject({company:'푸른숲',phone:'010-0000-2001'});
  expect(()=>analyzeImport('푸른숲,달빛공방,01000002001','no',{0:'company',1:'company'})).toThrow('여러 열');
 });
 it('does not persist any actual source values in a signature',()=>{
  const a=analyzeImport('달빛공방,01000002001,2026-10-17');
  expect(a.signature).toMatch(/^v1-[a-f0-9]+$/);
  expect(analyzeImport('다른상사,01000002009,2026-10-19').signature).toBe(a.signature);
  expect(analyzeImport('01000002009,다른상사,2026-10-19').signature).not.toBe(a.signature);
 });
 it('normalizes only plausible phone formats and preserves invalid values for review',()=>{
  expect(normalizeImportPhone('p:+821000002001')).toBe('010-0000-2001');
  expect(normalizeImportPhone('1000002001')).toBe('010-0000-2001');
  expect(normalizeImportPhone('확인 필요')).toBe('확인 필요');
 });
});
describe('browser account-scoped field rules',()=>{
 beforeEach(()=>localStorage.clear());
 it('isolates accounts and shapes without storing customer values',()=>{
  expect(saveImportRules('account-a','v1-abc',{0:'company',1:'phone'})).toBe(true);
  expect(loadImportRules('account-a','v1-abc')).toEqual({0:'company',1:'phone'});
  expect(loadImportRules('account-b','v1-abc')).toBeNull();
  expect(loadImportRules('account-a','v1-other')).toBeNull();
  expect(localStorage.key(0)).not.toContain('account-a');
 });
 it('does not enable remembered rules before account identity is known',()=>{
  expect(saveImportRules('','v1-abc',{0:'phone'})).toBe(false);expect(loadImportRules('','v1-abc')).toBeNull();
 });
 it('ignores corrupted saved payloads',()=>{
  saveImportRules('account-a','v1-abc',{0:'phone'});localStorage.setItem(localStorage.key(0)!,'{"0":"unknown"}');
  expect(loadImportRules('account-a','v1-abc')).toBeNull();
 });
});

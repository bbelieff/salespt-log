// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { analyzeImport } from '@/app/(app)/db-sheet/_components/adaptive-import';

const header = ['', '', '', '', '사업자명', '대표자', '전화번호', '업종', '지역', '사업자등록번호', '유입일'].join('\t');
const customer = ['합성 업종', '샘플지역', '1234500001', '2026-10-21', '합성달빛공방', '김가상', '01000002001'].join('\t');
describe('pasted spreadsheet alignment regressions (synthetic)', () => {
  it('preserves empty leading heading columns instead of shifting industry/region/biz into company/owner/phone', () => {
    const result = analyzeImport(`${header}\n${customer}`);
    expect(result.header).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.lead).toMatchObject({company:'합성달빛공방', owner:'김가상', phone:'010-0000-2001', date:'2026-10-21'});
    expect(result.headings).toHaveLength(11);
    expect(result.items[0]!.lead.memo).toContain('합성 업종');
    expect(result.items[0]!.lead.memo).toContain('1234500001');
    expect(result.items[0]!.questions).toHaveLength(1); // only unknown 10-digit biz is ambiguous
  });
  it.each(['', '\r\n', '\n\n'])('handles surrounding blank lines without trimming the first TSV columns (%j)', padding => {
    const result = analyzeImport(`\uFEFF${padding}${header}\r\n${customer}\r\n${padding}`);
    expect(result.items).toHaveLength(1); expect(result.items[0]!.lead.company).toBe('합성달빛공방');
    expect(result.items[0]!.lead.phone).toBe('010-0000-2001');
  });
  it('does not select placeholder-only rows as customers', () => {
    const result = analyzeImport('사업자명\t대표자\t전화번호\n합성달빛공방\t김가상\t01000002001\n—\t—\t—\n-\t-\t-\n합성온유상사\t이가상\t01000002002');
    expect(result.items).toHaveLength(2);
    expect(result.items.map(x=>x.lead.company)).toEqual(['합성달빛공방','합성온유상사']);
  });
  it('rejects placeholder-only input with a useful explanation', () => {
    expect(()=>analyzeImport('사업자명\t대표자\t전화번호\n—\t—\t—\n-\t-\t-')).toThrow('실제 업체 내용을');
  });
  it('preserves empty columns at both ends of headerless TSV', () => {
    const result=analyzeImport('\t합성달빛공방\t김가상\t01000002001\t', 'no');
    expect(result.items[0]!.raw).toEqual(['','합성달빛공방','김가상','01000002001','']);
    expect(result.items[0]!.lead).toMatchObject({company:'합성달빛공방',owner:'김가상',phone:'010-0000-2001'});
  });
  it('keeps explicit column rules aligned after a middle placeholder row', () => {
    const next=customer.replace('합성달빛공방','합성온유상사').replace('김가상','이가상').replace('01000002001','01000002002');
    const result=analyzeImport(`${header}\n${customer}\n—\t—\t—\n${next}`, 'auto', {0:'industry',1:'address',2:'biz',3:'date',7:'keep',8:'keep',9:'keep',10:'keep'});
    expect(result.items).toHaveLength(2);
    expect(result.items.map(x=>x.lead.company)).toEqual(['합성달빛공방','합성온유상사']);
    expect(result.items[1]!.lead).toMatchObject({owner:'이가상',phone:'010-0000-2002',biz:'1234500001',date:'2026-10-21',industry:'합성 업종',address:'샘플지역'});
    expect(result.items.every(x=>x.questions.length===0)).toBe(true);
  });
});

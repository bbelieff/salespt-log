// @vitest-environment jsdom
/** ECC product eval: cross-format field placement, with fixed expected synthetic values. */
import { describe, expect, it } from 'vitest';
import { analyzeImport } from '@/app/(app)/db-sheet/_components/adaptive-import';

const fields = { company: '합성테크', owner: '김가상', phone: '010-0000-2001', date: '2026-10-17' };
const headings = { company: '사업자명', owner: '대표자', phone: '전화번호', date: '유입일' };
const orders = [ ['company','owner','phone','date'], ['phone','date','owner','company'] ] as const;
const cases = orders.flatMap((order, orderIndex) => [',','\t'].flatMap(delimiter =>
  ['01000002001','p:+821000002001','+82 010-0000-2001'].flatMap(phone => [false,true].map(header => ({
    label: `${orderIndex}/${delimiter === ',' ? 'CSV' : 'TSV'}/${phone}/${header ? 'header' : 'no header'}`,
    header,
    raw: [ ...(header ? [order.map(key => headings[key]).join(delimiter)] : []), order.map(key => key === 'phone' ? phone : fields[key]).join(delimiter) ].join('\r\n'),
  }))),
));

describe('import acceptance matrix (not a model reliability benchmark)', () => {
  it.each(cases)('$label places fields without losing the first customer', ({ raw, header }) => {
    const result = analyzeImport(`\uFEFF${raw}`);
    expect(result.header).toBe(header); expect(result.items).toHaveLength(1);
    expect(result.items[0]!.lead).toMatchObject(fields);
    expect(result.items[0]!.questions).toHaveLength(0);
    expect(result.items[0]!.inflow).toBe(true);
  });
  it('keeps malicious-looking customer text as plain data', () => {
    const value = '<img src=x onerror="alert(1)">';
    const result = analyzeImport(`사업자명\t전화번호\t메모\n합성테크\t01000002001\t${value}`);
    expect(result.items[0]!.lead.company).toBe('합성테크');
    expect(result.items[0]!.lead.memo).toContain(value);
    expect(document.querySelector('[onerror]')).toBeNull();
  });
});

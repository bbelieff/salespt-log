// @vitest-environment jsdom
/** ECC security-review/eval-harness: synthetic malformed workbooks, no customer data. */
import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { xlsxToText } from '@/app/(app)/db-sheet/_components/xlsx';
import { readImportFile } from '@/app/(app)/db-sheet/_components/import-file';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
type Entry = { name: string; text: string; compressed?: boolean; declaredSize?: number };
function workbook(entries: Entry[]): ArrayBuffer {
  const chunks: Uint8Array[] = [], directory: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name), data = new TextEncoder().encode(entry.text);
    const bytes = entry.compressed ? new Uint8Array(deflateRawSync(data)) : data;
    const local = new Uint8Array(30 + name.length), central = new Uint8Array(46 + name.length);
    const l = new DataView(local.buffer), c = new DataView(central.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(8, entry.compressed ? 8 : 0, true);
    l.setUint32(18, bytes.length, true); l.setUint32(22, entry.declaredSize ?? data.length, true);
    l.setUint16(26, name.length, true); local.set(name, 30);
    c.setUint32(0, 0x02014b50, true); c.setUint16(10, entry.compressed ? 8 : 0, true);
    c.setUint32(20, bytes.length, true); c.setUint32(24, entry.declaredSize ?? data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(local, bytes); directory.push(central); offset += local.length + bytes.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, directory.reduce((n, p) => n + p.length, 0), true); e.setUint32(16, offset, true);
  const all = [...chunks, ...directory, end], result = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0; for (const bytes of all) { result.set(bytes, pos); pos += bytes.length; }
  return result.buffer;
}
function sheet(cells: string) { return `<worksheet ${NS}><sheetData>${cells}</sheetData></worksheet>`; }
function simple(text = '합성상사') { return `<row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row>`; }
const entry = (text: string): Entry => ({ name: 'xl/worksheets/sheet1.xml', text });

describe('XLSX input resource limits', () => {
  it('rejects oversized declared content before decompression', async () => {
    await expect(xlsxToText(workbook([{ ...entry(sheet(simple())), declaredSize: 21 * 1024 * 1024 }]))).rejects.toThrow();
  });
  it('rejects understated ZIP size instead of trusting directory metadata', async () => {
    await expect(xlsxToText(workbook([{ ...entry(sheet(simple())), declaredSize: 1 }]))).rejects.toThrow();
  });
  it('limits actual decompressed output even when the directory lies', async () => {
    const zip = workbook([{ ...entry(' '.repeat(21 * 1024 * 1024)), compressed: true, declaredSize: 1 }]);
    expect(zip.byteLength).toBeLessThan(5 * 1024 * 1024);
    await expect(xlsxToText(zip)).rejects.toThrow();
  });
  it('rejects the 201st column rather than allocating a sparse grid', async () => {
    await expect(xlsxToText(workbook([entry(sheet('<row r="1"><c r="GS1"><v>1</v></c></row>'))]))).rejects.toThrow();
  });
  it('accepts exactly 200 columns', async () => {
    const text = await xlsxToText(workbook([entry(sheet('<row r="1"><c r="GR1"><v>1</v></c></row>'))]));
    expect(text.split('\t')).toHaveLength(200); expect(text.endsWith('1')).toBe(true);
  });
  it('rejects more than 10000 data rows', async () => {
    const rows = Array.from({ length: 10002 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>1</v></c></row>`).join('');
    await expect(xlsxToText(workbook([entry(sheet(rows))]))).rejects.toThrow();
  });
  it('rejects duplicate ZIP paths instead of replacing the first sheet', async () => {
    await expect(xlsxToText(workbook([entry(sheet(simple())), entry(sheet(simple('다른합성')))]))).rejects.toThrow();
  });
  it('does not inflate an unused second sheet', async () => {
    const zip = workbook([entry(sheet(simple())), { name: 'xl/worksheets/sheet2.xml', text: 'unused', compressed: true, declaredSize: 30 * 1024 * 1024 }]);
    const bytes = new Uint8Array(zip), view = new DataView(zip);
    const directory = view.getUint32(zip.byteLength - 6, true);
    const second = directory + 46 + view.getUint16(directory + 28, true);
    const local = view.getUint32(second + 42, true);
    bytes[local + 30 + view.getUint16(local + 26, true)] = 0xff;
    expect(await xlsxToText(zip)).toBe('합성상사');
  });
  it('reads a normal compressed workbook', async () => {
    expect(await xlsxToText(workbook([{ ...entry(sheet(simple())), compressed: true }]))).toBe('합성상사');
  });
  it('limits rendered output when a small shared string table is reused many times', async () => {
    const value = '가'.repeat(20000);
    const zip = workbook([
      { name: 'xl/sharedStrings.xml', text: `<sst ${NS}><si><t>${value}</t></si></sst>`, compressed: true },
      { ...entry(sheet(Array.from({ length: 120 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}" t="s"><v>0</v></c></row>`).join(''))), compressed: true },
    ]);
    expect(zip.byteLength).toBeLessThan(5 * 1024 * 1024);
    await expect(xlsxToText(zip)).rejects.toThrow('5MB');
  });
  it('keeps actionable limit feedback at the file-import boundary', async () => {
    const zip = workbook([entry(sheet('<row r="1"><c r="GS1"><v>1</v></c></row>'))]);
    await expect(readImportFile({ name: 'synthetic.xlsx', size: zip.byteLength, arrayBuffer: async () => zip })).rejects.toThrow('200열');
  });
  it('limits unusually long number formats before invoking the formatter', async () => {
    const styles = `<styleSheet ${NS}><numFmts><numFmt numFmtId="164" formatCode="${'0'.repeat(1025)}"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs></styleSheet>`;
    const zip = workbook([{ name: 'xl/styles.xml', text: styles }, entry(sheet('<row r="1"><c r="A1" s="0"><v>1</v></c></row>'))]);
    await expect(xlsxToText(zip)).rejects.toThrow('표시 형식');
  });
  it('does not evaluate formulas or follow external references', async () => {
    const text = await xlsxToText(workbook([entry(sheet('<row r="1"><c r="A1"><f>WEBSERVICE("https://invalid.example")</f><v>cached-text</v></c></row>'))]));
    expect(text).toBe('cached-text');
  });
  it('fails on a broken central-directory offset', async () => {
    const zip = workbook([entry(sheet(simple()))]); new DataView(zip).setUint32(zip.byteLength - 6, zip.byteLength + 1, true);
    await expect(xlsxToText(zip)).rejects.toThrow();
  });
});

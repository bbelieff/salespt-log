/** 옛 엑셀 BIFF(.xls)의 첫 시트를 기존 가져오기용 TSV로 변환한다. */
export async function xlsToText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const compound = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((b, i) => bytes[i] === b);
  const biff = [0x09, 0x02, 0x04].includes(bytes[0] ?? -1) && bytes[1] === 0x08;
  if (!compound && !biff) throw new Error('엑셀(.xls) 파일이 아닙니다. 엑셀에서 .xlsx로 다시 저장해 주세요.');
  const XLSX = await import('xlsx');
  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false, cellNF: true, sheetRows: 10002 });
  } catch {
    throw new Error('엑셀 파일을 읽지 못했습니다. 암호를 해제하고 .xlsx로 다시 저장해 주세요.');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!sheet?.['!ref']) return '';
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
  if (range.e.r - range.s.r > 10000 || range.e.c - range.s.c >= 200) {
    throw new Error('한 번에 10,000행·200열까지 가져올 수 있습니다. 필요한 범위만 새 파일에 저장해 주세요.');
  }
  const quote = (text: string) => /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  const rows: string[] = [];
  const dateColumns = new Set<number>();
  for (let r = range.s.r; r <= range.e.r; r++) {
    const values: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      let value = cell ? XLSX.utils.format_cell(cell) : '';
      if (r === range.s.r && /일시|날짜|일자|유입일|신청일|date|time/i.test(value)) dateColumns.add(c);
      if (r > range.s.r && dateColumns.has(c) && cell?.t === 'n' && cell.v > 20000 && cell.v < 80000) {
        const date = XLSX.SSF.parse_date_code(cell.v, { date1904: !!workbook.Workbook?.WBProps?.date1904 });
        if (date) value = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
      values.push(quote(value));
    }
    rows.push(values.join('\t'));
  }
  return rows.join('\n');
}

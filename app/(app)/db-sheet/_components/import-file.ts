import { decodeImport } from './model';
import { xlsxToText } from './xlsx';
import { XlsxImportLimitError } from './xlsx-zip';

export const IMPORT_FILE_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt';
export const IMPORT_FILE_HINT = '엑셀 XLSX · XLS · CSV · TSV · TXT / 최대 5MB';

/** 파일 선택과 끌어놓기가 같은 검증/변환을 사용한다. 저장은 기존 확인 단계에서만 한다. */
export async function readImportFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls', 'csv', 'tsv', 'txt'].includes(extension)) {
    throw new Error('엑셀(.xlsx·.xls)·CSV·TSV·TXT 파일을 지원합니다.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('5MB 이하 파일을 가져와 주세요.');
  const buffer = await file.arrayBuffer();
  let raw: string;
  if (extension === 'xls') {
    const { xlsToText } = await import('./xls');
    raw = await xlsToText(buffer);
  } else if (extension === 'xlsx') {
    try { raw = await xlsxToText(buffer); }
    catch (error) {
      if (error instanceof XlsxImportLimitError) throw error;
      throw new Error('엑셀 파일을 읽지 못했습니다. 암호를 해제하고 .xlsx로 다시 저장해 주세요.');
    }
  } else raw = decodeImport(buffer);
  if (raw.includes('\uFFFD')) throw new Error('글자가 깨진 파일입니다. 엑셀에서 다시 저장해 주세요.');
  if (!raw.trim()) throw new Error('빈 파일 또는 빈 첫 시트입니다. 내용을 확인해 주세요.');
  return raw.replace(/^\uFEFF/, '');
}

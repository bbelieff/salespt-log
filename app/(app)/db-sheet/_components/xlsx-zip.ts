/** XLSX의 필요한 항목만 읽으며 선언 크기와 실제 해제량을 모두 제한한다. */
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
export class XlsxImportLimitError extends Error {}
const invalid = () => new Error('엑셀 압축 구조가 손상되었습니다. .xlsx로 다시 저장해 주세요.');
const limit = () => new XlsxImportLimitError('압축을 푼 엑셀 내용이 너무 큽니다. 필요한 첫 시트만 새 파일에 저장해 주세요.');

async function inflate(bytes: Uint8Array, remaining: number): Promise<Uint8Array> {
  const reader = new Response(bytes.slice()).body!.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > remaining) { await reader.cancel(); throw limit(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length); let pos = 0;
  for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }
  return result;
}

type Entry = { method: number; size: number; expanded: number; local: number; flags: number };
export function xlsxZipReader(buf: ArrayBuffer): (name: string) => Promise<string | undefined> {
  const bytes = new Uint8Array(buf), view = new DataView(buf), decode = new TextDecoder('utf-8');
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw invalid();
  const count = view.getUint16(end + 10, true), directory = view.getUint32(end + 16, true);
  const directoryEnd = directory + view.getUint32(end + 12, true);
  if (directoryEnd > end || count > 10000 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw invalid();
  const entries = new Map<string, Entry>(); let pos = directory;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > directoryEnd || view.getUint32(pos, true) !== 0x02014b50) throw invalid();
    const nameLength = view.getUint16(pos + 28, true), extra = view.getUint16(pos + 30, true), comment = view.getUint16(pos + 32, true);
    const next = pos + 46 + nameLength + extra + comment; if (next > directoryEnd) throw invalid();
    const name = decode.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    if (entries.has(name)) throw invalid();
    entries.set(name, { flags: view.getUint16(pos + 8, true), method: view.getUint16(pos + 10, true), size: view.getUint32(pos + 20, true), expanded: view.getUint32(pos + 24, true), local: view.getUint32(pos + 42, true) });
    pos = next;
  }
  if (pos !== directoryEnd) throw invalid();
  const cache = new Map<string, string>(); let expandedBytes = 0;
  return async name => {
    if (cache.has(name)) return cache.get(name);
    const entry = entries.get(name); if (!entry) return undefined;
    const { local, size, expanded, method, flags } = entry;
    if (expanded > MAX_EXPANDED_BYTES - expandedBytes) throw limit();
    if (local + 30 > directory || view.getUint32(local, true) !== 0x04034b50 || flags & 1 || ![0, 8].includes(method)) throw invalid();
    const nameLength = view.getUint16(local + 26, true), extra = view.getUint16(local + 28, true);
    const start = local + 30 + nameLength + extra;
    if (start + size > directory || decode.decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== name || view.getUint16(local + 8, true) !== method) throw invalid();
    const raw = bytes.subarray(start, start + size);
    if (method === 0 && size !== expanded) throw invalid();
    const data = method === 0 ? raw : await inflate(raw, MAX_EXPANDED_BYTES - expandedBytes);
    if (data.byteLength !== expanded) throw invalid();
    expandedBytes += data.byteLength;
    const text = decode.decode(data); cache.set(name, text); return text;
  };
}

/**
 * Layer: util (순수 — import 0). 압축 없이 묶는 ZIP 만들기(사업계획서 「자료 꾸러미」, docs/plans/active/bizplan-tool.md).
 *
 * 왜 직접 만드나: 올리는 자료가 대부분 PDF·사진·docx 라 이미 압축돼 있어 다시 압축해도 거의 줄지 않는다.
 * 라이브러리를 더하지 않고 「저장(STORE)」 방식 ZIP 만 만든다 — 윈도·맥·폰 기본 압축풀기에서 열린다.
 * 파일 이름은 UTF-8 표시(일반 비트 11)를 켜서 한글 이름이 깨지지 않게 한다.
 * 한계: 파일 하나·전체 4GB 미만(ZIP64 없음). 꾸러미 상한은 화면이 훨씬 작게 막는다.
 */

export type ZipEntry = { name: string; data: Uint8Array; modified?: Date };

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  crcTable = t;
  return t;
}

export function crc32(data: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** 폴더 구분은 "/" 만 쓰고, 앞 "/"·"."·"..", 윈도에서 못 쓰는 문자는 지운다. */
export function safeZipPath(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

/** 같은 이름이 또 나오면 "이름 (2).pdf" 처럼 번호를 붙인다(대소문자 무시). */
export function uniqueZipNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((raw) => {
    const name = safeZipPath(raw) || "파일";
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      return name;
    }
    const dot = name.lastIndexOf(".");
    const slash = name.lastIndexOf("/");
    const hasExt = dot > slash + 1;
    const stem = hasExt ? name.slice(0, dot) : name;
    const ext = hasExt ? name.slice(dot) : "";
    for (let i = 2; ; i++) {
      const next = `${stem} (${i})${ext}`;
      if (!seen.has(next.toLowerCase())) {
        seen.add(next.toLowerCase());
        return next;
      }
    }
  });
}

/** ZIP 바이트를 만든다. 이름은 호출부가 uniqueZipNames 로 정리해 넘긴다. */
export function buildStoredZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const { time, date } = dosTime(e.modified ?? new Date());
    const size = e.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 이름
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, e.data);
    centrals.push(central);
    offset += local.length + size;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

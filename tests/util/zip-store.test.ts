import { describe, expect, it } from "vitest";
import { buildStoredZip, crc32, safeZipPath, uniqueZipNames } from "@/util/zip-store";

/** 중앙 디렉터리를 읽어 이름·크기·CRC·내용을 되돌려 본다(직접 만든 ZIP 이 표준대로인지). */
function readZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endAt = bytes.length - 22;
  expect(v.getUint32(endAt, true)).toBe(0x06054b50);
  const count = v.getUint16(endAt + 10, true);
  let p = v.getUint32(endAt + 16, true);
  const dec = new TextDecoder();
  const out: { name: string; data: string; crc: number; flags: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const flags = v.getUint16(p + 8, true);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + v.getUint16(local + 26, true);
    out.push({ name, data: dec.decode(bytes.subarray(start, start + size)), crc, flags });
    p += 46 + nameLen;
  }
  return out;
}

describe("zip-store", () => {
  it("crc32 는 표준값과 같다", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("한글 이름·폴더가 그대로 들어가고 내용·CRC 가 맞다", () => {
    const enc = new TextEncoder();
    const zip = buildStoredZip([
      { name: "00_시작프롬프트.txt", data: enc.encode("안녕") },
      { name: "03_원본자료/01_사업자등록증/등록증.pdf", data: enc.encode("%PDF-1.4") },
    ]);
    const files = readZip(zip);
    expect(files.map((f) => f.name)).toEqual(["00_시작프롬프트.txt", "03_원본자료/01_사업자등록증/등록증.pdf"]);
    expect(files[0]!.data).toBe("안녕");
    expect(files[0]!.crc).toBe(crc32(enc.encode("안녕")));
    expect(files.every((f) => (f.flags & 0x0800) !== 0)).toBe(true);
  });

  it("빈 꾸러미도 올바른 ZIP 이다", () => {
    expect(readZip(buildStoredZip([]))).toEqual([]);
  });

  it("위험한 경로를 지우고 같은 이름에 번호를 붙인다", () => {
    expect(safeZipPath("../../etc/pa:ss.txt")).toBe("etc/pa_ss.txt");
    expect(safeZipPath("a\\b\\c.pdf")).toBe("a/b/c.pdf");
    expect(uniqueZipNames(["a/사진.jpg", "a/사진.jpg", "A/사진.JPG"])).toEqual(["a/사진.jpg", "a/사진 (2).jpg", "A/사진 (3).JPG"]);
    expect(uniqueZipNames(["메모", "메모"])).toEqual(["메모", "메모 (2)"]);
  });
});

/**
 * document-ocr/memo-file — 미팅 메모(.txt) 파일 판별·글자 풀기.
 * 메모장 파일은 UTF-8 이거나 옛 한글 저장 방식(EUC-KR/CP949)이다 — UTF-8 로 안 풀리면 EUC-KR 로 푼다.
 */

export const MEMO_MAX_BYTES = 1024 * 1024;

export function isMemoFile(file: { name?: string; type?: string }): boolean {
  return (file.type ?? "").toLowerCase() === "text/plain" || /\.txt$/i.test(file.name ?? "");
}

export function decodeMemoBytes(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("euc-kr").decode(buf);
  }
}

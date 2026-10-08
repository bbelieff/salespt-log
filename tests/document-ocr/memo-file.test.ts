import { describe, it, expect } from "vitest";
import { decodeMemoBytes, isMemoFile } from "@/lib/document-ocr/memo-file";
import { classifyDocumentText, isSupportedDocType, parseDocument } from "@/lib/document-ocr/registry";

describe("미팅 메모 파일", () => {
  it("txt 파일만 메모로 본다", () => {
    expect(isMemoFile({ name: "가나다.txt", type: "" })).toBe(true);
    expect(isMemoFile({ name: "memo", type: "text/plain" })).toBe(true);
    expect(isMemoFile({ name: "사업자등록증.pdf", type: "application/pdf" })).toBe(false);
  });

  it("UTF-8 과 옛 한글 저장 방식(EUC-KR) 모두 읽는다", () => {
    expect(decodeMemoBytes(new TextEncoder().encode("\uFEFF● 업종\t\t한식"))).toBe("● 업종\t\t한식");
    // "업종" EUC-KR 바이트
    expect(decodeMemoBytes(new Uint8Array([0xbe, 0xf7, 0xc1, 0xbe]))).toBe("업종");
  });

  it("미팅 메모 종류가 등록돼 있고, 서류 분류기는 메모로 착각하지 않는다", () => {
    expect(isSupportedDocType("미팅메모")).toBe(true);
    expect(classifyDocumentText("● 업종\t\t한식")).toBe("unknown");
    expect(parseDocument("미팅메모", "가상상사\n● 업종\t\t한식")?.fields[0]).toMatchObject({ key: "업종주생산품목", value: "한식" });
  });
});

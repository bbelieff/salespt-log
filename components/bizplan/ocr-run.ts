/**
 * 사업계획서 작성도구 — 「서류에서 숫자 읽기」 실행 도우미(브라우저 전용).
 *
 * 업체정보 「문서로 자동입력」과 같은 OCR(@/lib/document-ocr)을 다시 쓴다:
 * 파일은 서버로 보내지 않고, 읽은 글자는 가린 뒤(redactOcrText)에만 메모리에 둔다.
 * 같은 파일을 다시 읽지 않도록 파일 → 읽은 글 캐시(WeakMap)를 쓴다 — 파일을 빼면 함께 사라진다.
 */
import { validateOcrFile } from "@/lib/document-ocr/limits";
import { redactOcrText } from "@/lib/document-ocr/text-utils";
import { classifyDocumentText, parseDocument } from "@/lib/document-ocr/registry";
import { bundlePieces } from "@/lib/document-ocr/bundle";
import { mergeParseResults } from "@/lib/document-ocr/merge";
import {
  BIZPLAN_OCR_SLOTS,
  pickDocType,
  suggestionsFromParse,
  type BizplanOcrSlot,
  type BizplanRawSuggestion,
} from "@/lib/document-ocr/bizplan-map";
import type { DocType, OcrProgress } from "@/lib/document-ocr/types";
import type { SlotFiles } from "./pack-client";

export type ReadPiece = { name: string; docType: DocType; text: string; altText?: string };
export type OcrJob = { slot: BizplanOcrSlot; file: File };

/** 읽을 파일(사업자등록증·재무제표·부가세 칸의 사진·PDF)과 못 읽는 파일 이름. */
export function ocrJobs(files: SlotFiles): { jobs: OcrJob[]; skipped: string[] } {
  const jobs: OcrJob[] = [];
  const skipped: string[] = [];
  for (const slot of BIZPLAN_OCR_SLOTS) {
    for (const file of files[slot]) {
      const v = validateOcrFile({ size: file.size, type: file.type, name: file.name });
      if ("error" in v) skipped.push(file.name);
      else jobs.push({ slot, file });
    }
  }
  return { jobs, skipped };
}

/** 파일 하나를 읽는다. 합본 PDF 는 서류마다 조각으로 나눈다. */
export async function readOcrFile(
  job: OcrJob,
  signal: AbortSignal,
  onProgress: (p: OcrProgress) => void,
): Promise<ReadPiece[]> {
  const { runDocumentOcr } = await import("@/lib/document-ocr/ocr-client");
  const out = await runDocumentOcr(job.file, { signal, onProgress });
  const pieces = bundlePieces(job.file.name, out.pages?.map(redactOcrText), out.altPages?.map(redactOcrText));
  if (pieces) return pieces.map((p) => ({ name: p.name, docType: pickDocType(p.docType, job.slot), text: p.text, altText: p.altText }));
  const text = redactOcrText(out.text);
  const altText = out.altText ? redactOcrText(out.altText) : undefined;
  const kind = classifyDocumentText(text);
  const classified = kind === "unknown" && altText ? classifyDocumentText(altText) : kind;
  return [{ name: job.file.name, docType: pickDocType(classified, job.slot), text, altText }];
}

/** 읽은 조각들 → 팩트시트 제안(두 인식 결과가 있으면 칸마다 합친다). */
export function suggestionsFromPieces(
  pieces: ReadPiece[],
  baseYear: number,
): { suggestions: BizplanRawSuggestion[]; notes: string[] } {
  const suggestions: BizplanRawSuggestion[] = [];
  const notes: string[] = [];
  for (const p of pieces) {
    const main = parseDocument(p.docType, p.text, { baseYear });
    const alt = p.altText ? parseDocument(p.docType, p.altText, { baseYear }) : null;
    const result = main && alt ? mergeParseResults([alt, main]) : main ?? alt;
    if (!result) continue;
    const got = suggestionsFromParse(p.docType, result, baseYear, p.name);
    suggestions.push(...got.suggestions);
    notes.push(...got.notes);
  }
  return { suggestions, notes };
}

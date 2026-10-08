/**
 * document-ocr/types — 업체정보 「문서로 자동입력」 공통 타입.
 *
 * 원칙(belie 결정 2026-09-28):
 * - OCR 은 **브라우저 안에서만** 돈다(서버 업로드·외부 API·비용 0). 원본 파일은 저장하지 않는다.
 * - 파서는 **제안**만 만든다. 실제 반영은 사용자가 팝업에서 체크한 칸만, 편집기의
 *   기존 자동저장 경로로 들어간다.
 * - 제안에는 원문 근거(evidence)를 싣지 않는다 — OCR 원문은 개인정보라 로그·화면에 남기지 않는다.
 *
 * 레이어: lib/document-ocr 는 lib/format 처럼 화면·서비스가 함께 쓰는 순수 헬퍼 폴더다.
 * types(@/types — 타입만)·util(@/util/*) 만 import 한다. 브라우저 전용 실행기는 ocr-client.ts(+ PDF 부분 ocr-pdf.ts) 뿐.
 */
import type { CompanyInfo } from "@/types";

/** 문서 종류 — 분류기가 고르고, 사용자가 팝업에서 바꿀 수 있다. */
export const DOC_TYPES = [
  "사업자등록증",
  "부가세과세표준증명",
  "재무제표",
  "신분증",
  "임대차계약서",
  "미팅메모",
  "unknown",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  사업자등록증: "사업자등록증",
  부가세과세표준증명: "부가세 과세표준증명",
  재무제표: "재무제표",
  신분증: "신분증",
  임대차계약서: "임대차계약서",
  미팅메모: "미팅 메모(txt)",
  unknown: "모르는 문서",
};

/** 파서가 채울 수 있는 업체정보 칸 — 문자열 칸만(커스텀 제외). */
export type CompanyInfoKey = Exclude<keyof CompanyInfo, "커스텀">;

/** 한 칸 제안. value="" 는 "못 읽음" — 절대 기존 값을 덮지 않는다. */
export type ParsedField = {
  key: CompanyInfoKey;
  value: string;
  /** 0~1. 라벨 일치·형식·체크섬으로 매긴 경험치(확률 아님). */
  confidence: number;
  warnings: string[];
  /** false 면 형식 검증 실패(예: 사업자등록번호 체크섬) — 기본 체크 해제. */
  valid?: boolean;
  /** 금액 칸: 문서에 적힌 원 금액(백만원으로 바꾸기 전) — 비교표가 "원문 250,123,456원" 으로 보여 준다. */
  sourceWon?: number;
};

/** 화면에만 보여주고 저장하지 않는 참고 정보(예: 상호 — CompanyInfo 칸이 아니다). */
export type ParsedInfo = { label: string; value: string };

/** 모든 문서 파서의 공통 결과 — PR-5 는 파서를 레지스트리에 등록만 하면 된다. */
export type DocParseResult = {
  fields: ParsedField[];
  documentWarnings: string[];
  info?: ParsedInfo[];
};

/** 파서에 넘기는 업체 문맥 — baseYear = 업체의 매출 기준 연도(없으면 오늘 연도). */
export type DocParseContext = { baseYear?: number };

export type DocParser = (text: string, ctx?: DocParseContext) => DocParseResult;

/** OCR 진행 단계(진행 막대용). */
export type OcrStage = "validating" | "pdf-text" | "pdf-render" | "recognizing" | "done";

export type OcrProgress = { stage: OcrStage; ratio: number; message: string };

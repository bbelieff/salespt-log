/**
 * document-ocr/parse-certificate — 국문 사업자등록증 OCR 텍스트 → 업체정보 칸 제안.
 * 라벨 규칙 출처: MoaWork app/src/lib/document-ocr/parse-certificate.ts (origin/main) —
 * 이 앱은 결과를 CompanyInfo 키·형식으로 바로 낸다.
 *
 * 채우는 칸: 대표자이름 · 사업자등록번호 · 개업일(YY.MM.DD) · 사업자구분(개인/법인) · 소재지 ·
 *   업태 · 업종주생산품목(종목) · 과세유형 · 대표자생년월일(YY.MM.DD) · 법인등록번호.
 * 상호는 업체정보 칸이 아니다 → info(화면 참고용)로만 낸다.
 *
 * 개인정보 규칙(belie 결정):
 * - 13자리 등록번호 꼴(주민등록번호 등)은 법인등록번호 라벨 줄의 값만 꺼낸 뒤 **원문에서 지우고** 읽는다
 *   → 주민등록번호 뒷자리는 어떤 제안값에도 들어갈 수 없다.
 * - 생년월일은 "생년월일" 라벨이 있을 때만. 주민등록번호에서 추측하지 않는다.
 */
import { findBizNoCandidates, formatBizNo, formatCorpNo, isValidBizNo, isValidCorpNo, digitsOnly } from "./bizno";
import {
  THIRTEEN_DIGIT_ID,
  findCorpNo,
  findLabelLines,
  normalizeOcrText,
  stripSep,
  toLines,
  toYyMmDd,
  valueAfter,
  compactText,
} from "./text-utils";
import type { CompanyInfoKey, DocParseResult, ParsedField, ParsedInfo } from "./types";

const STOP_WORDS = [
  "업태", "종목", "대표자", "성명", "소재지", "개업", "생년월일", "법인등록번호",
  "사업자등록번호", "등록번호", "상호", "법인명", "과세", "본점", "사업장",
] as const;

const TAXATION = ["일반과세자", "간이과세자", "면세사업자"] as const;
const LEGAL_FORMS = ["주식회사", "유한책임회사", "유한회사", "합자회사", "합명회사", "㈜"];

type Take = (labels: string[]) => { value: string; confidence: number; warnings: string[] } | null;

export function parseBusinessCertificate(rawText: string): DocParseResult {
  const normalized = normalizeOcrText(rawText);
  const fields: ParsedField[] = [];
  const info: ParsedInfo[] = [];
  const documentWarnings: string[] = [];
  if (!normalized.trim()) {
    return { fields, info, documentWarnings: ["읽힌 글자가 없어요. 더 선명한 사진으로 다시 해 보세요."] };
  }
  const push = (key: CompanyInfoKey, value: string, confidence: number, warnings: string[] = [], valid?: boolean) => {
    if (!value) return;
    fields.push({ key, value, confidence, warnings, ...(valid === undefined ? {} : { valid }) });
  };

  // ── 법인등록번호: 라벨에 붙은 값만(다음 줄이 주민등록번호 줄이면 빌려오지 않는다) ──
  const corpNo = findCorpNo(normalized);
  const corpOk = corpNo !== "" && isValidCorpNo(corpNo);
  if (/주\s*민\s*등\s*록\s*번\s*호/.test(normalized)) {
    documentWarnings.push("주민등록번호는 읽지 않았어요. 필요하면 앞 6자리만 직접 적어 주세요.");
  }
  // 13자리 번호는 전부 지운 원문으로 나머지를 읽는다.
  const text = normalized.replace(THIRTEEN_DIGIT_ID, " ");
  const lines = toLines(text);

  const take: Take = (labels) => {
    const hits = findLabelLines(lines, labels);
    if (hits.length === 0) return null;
    const { value, multiline } = valueAfter(lines, hits[0]!, labels, STOP_WORDS);
    if (!value) return null;
    const warnings: string[] = [];
    if (multiline) warnings.push("라벨 다음 줄에서 읽었어요. 확인해 주세요.");
    return { value, confidence: multiline ? 0.7 : 0.85, warnings };
  };

  // 상호(참고 정보만 — 저장 칸 아님)
  const name = take(["상호", "법인명"]);
  const companyName = name ? stripSep(name.value.replace(/\(?\s*단\s*체\s*명\s*\)?/g, " ")).slice(0, 60) : "";
  if (companyName) info.push({ label: "상호", value: companyName });

  // 대표자 이름
  const rep = take(["대표자", "성명"]);
  if (rep) {
    const m = rep.value.match(/[가-힣]{2,5}/);
    push("대표자이름", m ? m[0] : rep.value.slice(0, 20), m ? rep.confidence : 0.3, [
      ...rep.warnings,
      ...(m ? [] : ["이름 글자가 흐려요. 직접 확인해 주세요."]),
    ]);
  }

  // 생년월일(라벨 명시만)
  const birth = take(["생년월일"]);
  if (birth) {
    const d = toYyMmDd(birth.value);
    if (d) push("대표자생년월일", d, Math.min(birth.confidence, 0.8), birth.warnings);
  }

  // 개업일
  const opened = take(["개업연월일", "개업일"]);
  if (opened) {
    const d = toYyMmDd(opened.value);
    if (d) push("개업일", d, Math.min(opened.confidence, 0.8), opened.warnings);
  }

  // 소재지 — 사업장 소재지 우선, 없으면 본점/그냥 소재지
  const addr = take(["사업장소재지"]) ?? take(["본점소재지"]) ?? take(["소재지"]);
  if (addr) {
    const v = addr.value.slice(0, 120);
    push("소재지", v, v.length >= 5 ? Math.min(addr.confidence, 0.75) : 0.45, addr.warnings);
  }

  // 업태 / 종목
  const cat = take(["업태"]);
  if (cat) push("업태", cat.value.slice(0, 60), cat.confidence - 0.1, cat.warnings);
  const item = take(["종목"]);
  if (item) push("업종주생산품목", item.value.slice(0, 60), item.confidence - 0.1, item.warnings);

  // 사업자등록번호 — 체크섬 포함. 법인·주민 번호 줄은 라벨 후보에서 뺀다.
  const bizHits = findLabelLines(lines, ["등록번호"]).filter((h) => !/법\s*인|주\s*민/.test(h.line));
  const cands: string[] = [];
  for (const hit of bizHits) {
    const scope = `${hit.line} ${lines[hit.index + 1] ?? ""}`;
    for (const c of findBizNoCandidates(scope)) if (!cands.includes(c)) cands.push(c);
  }
  if (cands.length === 0) cands.push(...findBizNoCandidates(text));
  if (cands.length > 0) {
    const raw = cands[0]!;
    const ok = isValidBizNo(raw);
    const warnings: string[] = [];
    if (cands.length > 1) warnings.push("번호 후보가 여러 개예요. 첫 번째를 골랐어요.");
    if (!ok) warnings.push("번호 검증이 맞지 않아요. 숫자를 직접 확인해 주세요.");
    push("사업자등록번호", ok ? formatBizNo(raw) : stripSep(raw).slice(0, 20), ok ? 0.9 : 0.3, warnings, ok);
  }

  // 법인등록번호
  if (corpNo) {
    push(
      "법인등록번호",
      formatCorpNo(corpNo),
      corpOk ? 0.9 : 0.4,
      corpOk ? [] : ["번호 검증이 맞지 않아요. 숫자를 직접 확인해 주세요."],
      corpOk,
    );
  }

  // 과세유형
  const compact = compactText(text);
  const taxFound = TAXATION.filter((t) => compact.includes(t));
  if (taxFound.length > 0) {
    push(
      "과세유형",
      taxFound[0]!,
      taxFound.length === 1 ? 0.7 : 0.35,
      taxFound.length === 1 ? [] : ["과세유형 표기가 여러 개예요. 확인해 주세요."],
    );
  }

  // 사업자구분 — 법인등록번호·"법인사업자"·법인 형태가 있으면 법인, 과세자/생년월일 표기면 개인.
  const legal = LEGAL_FORMS.some((f) => compactText(companyName).includes(f)) || /\(주\)|（주）/.test(companyName);
  if (corpOk) push("사업자구분", "법인", 0.9);
  else if (compact.includes("법인사업자")) push("사업자구분", "법인", 0.85);
  else if (legal) push("사업자구분", "법인", 0.7);
  else if (taxFound.length > 0 || birth) push("사업자구분", "개인", 0.7);

  if (fields.length === 0) {
    documentWarnings.push("사업자등록증 칸을 찾지 못했어요. 문서 종류가 맞는지 확인해 주세요.");
  }
  // 파서가 만든 값에 13자리 번호가 남지 않았는지 마지막으로 한 번 더(방어).
  for (const f of fields) {
    if (f.key !== "법인등록번호" && digitsOnly(f.value).length >= 13) f.value = f.value.replace(THIRTEEN_DIGIT_ID, "").trim();
  }
  return { fields: fields.filter((f) => f.value), info, documentWarnings };
}

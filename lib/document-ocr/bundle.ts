/**
 * document-ocr/bundle — 합본 PDF 나누기(순수 함수, pdfjs 없이 테스트 가능). 깨진 글자층 판정은 text-utils `isGarbledText`.
 * 출처: 원페이지 경영진단(MSC) 리드디벨롭 `splitRows`·`splitPageInfo`·`garbledText`(2026-11-01 이식, L-115·L-140).
 *
 * 합본: 홈택스 서류 여러 장을 한 PDF 로 묶어 오면 쪽마다 위 몇 줄에서 제목을 찾아 서류 경계를 정한다.
 * - 제목 없는 쪽은 앞 서류가 이어지는 것으로 본다(표준재무제표 2쪽 이후 등).
 * - "1/3" 같은 쪽 표시가 있으면 그 쪽 수가 찰 때까지 같은 서류다.
 * - 같은 종류가 이어지면 발급번호(재무제표는 연도)가 다를 때만 새 서류 — 여러 쪽 서류는 그대로 붙인다.
 */
import { classifyDocumentText } from "./registry";
import { compactText } from "./text-utils";
import type { DocType } from "./types";

/** 제목을 찾는 쪽 맨 위 줄 수. */
const TOP_LINES = 10;
/** 한 서류가 여러 쪽일 수 있는 종류 — 같은 종류가 이어지면 기본으로 붙인다. */
const MULTI_PAGE: ReadonlySet<DocType> = new Set(["재무제표", "임대차계약서", "부가세과세표준증명"]);

export type BundleSegment = { from: number; to: number; docType: DocType; text: string };

type PageInfo = { docType: DocType; key: string; pageNo: number; total: number };

function pageNoOf(lines: string[]): { no: number; total: number } | null {
  // 쪽 표시는 보통 맨 아래 — 아래 줄부터 본다.
  for (const raw of [...lines].reverse().slice(0, 6)) {
    const t = raw.replace(/\s+/g, " ").trim();
    const m =
      t.match(/^-\s*(\d{1,2})\s*-$/) ||
      t.match(/^(?:페이지|쪽)\s*[:：]?\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?$/) ||
      t.match(/^\(?\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)?\s*(?:쪽|페이지)?$/);
    if (m && (!m[2] || Number(m[1]) <= Number(m[2]))) return { no: Number(m[1]), total: m[2] ? Number(m[2]) : 0 };
  }
  return null;
}

function keyOf(docType: DocType, compact: string): string {
  if (docType === "재무제표") {
    const y = compact.match(/(20\d{2})년?(?:\d{1,2}월\d{1,2}일)?(?:부터|~)/);
    if (y) return `y${y[1]}`;
  }
  const n = compact.match(/발급번호[:：]?([0-9A-Za-z-]{4,})/);
  return n ? `n${n[1]}` : "";
}

function pageInfo(text: string): PageInfo {
  const lines = text.split("\n").filter((l) => l.trim());
  const docType = classifyDocumentText(lines.slice(0, TOP_LINES).join("\n"));
  const pn = pageNoOf(lines);
  return {
    docType,
    key: docType === "unknown" ? "" : keyOf(docType, compactText(text)),
    pageNo: pn?.no ?? 0,
    total: pn?.total ?? 0,
  };
}

/**
 * 쪽별 글 → 서류 조각. 나눌 근거가 없으면 조각 하나(전체 쪽)를 돌려준다.
 * docType 이 "unknown" 인 조각은 전체 글로 다시 분류한다(제목이 10줄 아래에 있는 서류).
 */
export function splitBundlePages(pages: string[]): BundleSegment[] {
  type Seg = { from: number; to: number; docType: DocType; key: string; total: number };
  const segs: Seg[] = [];
  pages.map(pageInfo).forEach((p, i) => {
    const cur = segs[segs.length - 1];
    let fresh = false;
    if (!cur) fresh = true;
    else if (p.docType === "unknown") fresh = false;
    else if (cur.docType === "unknown") Object.assign(cur, { docType: p.docType, key: p.key });
    else if (p.docType !== cur.docType) fresh = true;
    else if (p.pageNo) fresh = p.pageNo === 1 && !(cur.total && i + 1 - cur.from < cur.total);
    else if (p.key && cur.key) fresh = p.key !== cur.key;
    else fresh = !MULTI_PAGE.has(p.docType);
    if (fresh) segs.push({ from: i + 1, to: i + 1, docType: p.docType, key: p.key, total: p.pageNo === 1 ? p.total : 0 });
    else if (cur) {
      cur.to = i + 1;
      if (!cur.key && p.docType === cur.docType) cur.key = p.key;
    }
  });
  const join = (from: number, to: number) => pages.slice(from - 1, to).join("\n\n").trim();
  if (segs.length < 2) {
    const text = join(1, pages.length);
    return [{ from: 1, to: pages.length, docType: classifyDocumentText(text), text }];
  }
  return segs.map((s) => {
    const text = join(s.from, s.to);
    return { from: s.from, to: s.to, docType: s.docType === "unknown" ? classifyDocumentText(text) : s.docType, text };
  });
}

/** 조각 이름 — 나뉘었을 때만 쪽 범위를 붙인다. */
export function segmentName(fileName: string, seg: BundleSegment, total: number): string {
  if (seg.from === 1 && seg.to === total) return fileName;
  return `${fileName} (${seg.from === seg.to ? `${seg.from}쪽` : `${seg.from}~${seg.to}쪽`})`;
}

export type BundlePiece = { name: string; text: string; altText?: string; docType: DocType };

/**
 * 읽은 PDF 쪽들 → 팝업 줄(서류 조각마다 하나). 나뉘지 않으면 null(한 파일 한 줄 그대로).
 * altPages = 쪽별 Paddle 글(있으면 같은 쪽 범위로 잘라 붙인다).
 */
export function bundlePieces(fileName: string, pages: string[] | undefined, altPages?: string[]): BundlePiece[] | null {
  const segs = pages && pages.length > 1 ? splitBundlePages(pages) : [];
  if (segs.length < 2) return null;
  return segs.map((seg) => {
    const alt = altPages?.slice(seg.from - 1, seg.to).join("\n\n").trim();
    return { name: segmentName(fileName, seg, pages!.length), text: seg.text, ...(alt ? { altText: alt } : {}), docType: seg.docType };
  });
}

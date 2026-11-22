/**
 * Layer: service — 노션 응답 → 트레이닝일지 화면 모델 (순수 함수, 네트워크 없음).
 * 소유 판정·제목·블록 변환을 여기 모아 합성 데이터로 시험한다.
 */
import { LOG_COLORS, type LogBlock, type LogBlockType, type LogColor, type LogText, type TrainingLogItem } from "@/types/training-log";
import { nameMatchCandidates } from "@/repo/name-match";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

/** 기수 표기 → 숫자 문자열("11기"·"11"·"PRM 11기" → "11"). 숫자가 없으면 "". */
export function cohortNumber(cohort: string): string {
  return String(cohort ?? "").match(/(\d+)/)?.[1] ?? "";
}

/** 「[서울11기] 트레이닝 일지」 처럼 이 기수의 트레이닝 일지 DB 제목인가. */
export function isCohortLogDatabase(title: string, cohort: string): boolean {
  const n = cohortNumber(cohort);
  const m = title.replace(/\s+/g, "").match(/\[[^\]]*?(\d+)기\]트레이닝일지/);
  return !!n && !!m && m[1] === n;
}

export function plainTitle(richTitle: unknown): string {
  return arr(richTitle).map((t) => String(t.plain_text ?? "")).join("").trim();
}

function pageTitle(page: Json): string {
  for (const prop of Object.values(obj(page.properties))) {
    const p = obj(prop);
    if (p.type === "title") return plainTitle(p.title);
  }
  return "";
}

/** 이 일지 행이 `name` 수강생 것인가 — select 값(보드 열)이 이름과 같거나, 제목이 이름으로 시작. */
export function isOwnLog(page: Json, name: string): boolean {
  const names = nameMatchCandidates(name);
  if (!names.length) return false;
  for (const prop of Object.values(obj(page.properties))) {
    const p = obj(prop);
    if (p.type === "select" && names.includes(String(obj(p.select).name ?? "").trim())) return true;
  }
  const title = pageTitle(page).replace(/\s+/g, "");
  return names.some((n) => title.startsWith(n.replace(/\s+/g, "")));
}

export function toLogItem(page: Json): TrainingLogItem {
  const title = pageTitle(page);
  const week = title.match(/(\d+)\s*주차/)?.[1];
  return { id: String(page.id ?? ""), title, week: week ? Number(week) : null, createdTime: String(page.created_time ?? "") };
}

/** 주차 내림차순(최신 위), 주차가 없으면 만든 시각 내림차순. */
export function sortLogs(items: TrainingLogItem[]): TrainingLogItem[] {
  return [...items].sort((a, b) => (b.week ?? -1) - (a.week ?? -1) || b.createdTime.localeCompare(a.createdTime));
}

/** 노션 색 이름("red"·"red_background"·"default") → 글자색/배경색. 모르는 색은 버린다. */
function tone(raw: unknown): { color?: LogColor; bg?: LogColor } {
  const [name, kind] = String(raw ?? "").split("_");
  if (!(LOG_COLORS as readonly string[]).includes(name ?? "")) return {};
  return kind === "background" ? { bg: name as LogColor } : { color: name as LogColor };
}

export function toText(rich: unknown): LogText[] {
  return arr(rich).map((t) => {
    const a = obj(t.annotations);
    const out: LogText = { text: String(t.plain_text ?? "") };
    const href = t.href ?? obj(obj(t.text).link).url;
    if (typeof href === "string" && /^https?:\/\//.test(href)) out.href = href;
    if (a.bold) out.bold = true;
    if (a.italic) out.italic = true;
    if (a.strikethrough) out.strike = true;
    if (a.underline) out.underline = true;
    if (a.code) out.code = true;
    if (t.type === "mention" || t.type === "equation") out.mention = true;
    return Object.assign(out, tone(a.color));
  });
}

// heading_4 는 노션이 2026년에 더한 제목 4단계 — 빠뜨리면 그 아래 내용까지 통째로 사라진다(김태진 6주차, 2026-11-16).
const SIMPLE: Record<string, LogBlockType> = {
  paragraph: "p", heading_1: "h1", heading_2: "h2", heading_3: "h3", heading_4: "h4",
  bulleted_list_item: "ul", numbered_list_item: "ol", to_do: "todo", toggle: "toggle",
  quote: "quote", callout: "callout", code: "code",
};

function fileUrl(body: Json): string {
  const f = obj(body.file).url ?? obj(body.external).url;
  return typeof f === "string" ? f : "";
}

/**
 * 노션 블록 1개 → 화면 블록(자식은 호출자가 채움). 그릴 수 없는 블록(하위 DB 등)은 null.
 * 모르는 종류라도 글자나 자식이 있으면 문단으로 남긴다 — 노션이 새 블록을 더해도 내용이 조용히 빠지지 않게.
 * 제목 블록이 토글이면(is_toggleable) 토글로 바꿔 자식이 접혀 보이게 한다.
 */
export function toLogBlock(block: Json): LogBlock | null {
  const type = String(block.type ?? "");
  const body = obj(block[type]);
  if (type === "divider") return { type: "divider", text: [] };
  if (type === "image") {
    const url = fileUrl(body);
    return url ? { type: "image", text: toText(body.caption), url } : null;
  }
  if (type === "file" || type === "pdf" || type === "video" || type === "audio") {
    const url = fileUrl(body);
    const name = String(body.name ?? "").trim();
    return url ? { type: "file", text: name ? [{ text: name }] : toText(body.caption), url } : null;
  }
  if (type === "bookmark" || type === "link_preview" || type === "embed") {
    const url = String(body.url ?? "");
    return /^https?:\/\//.test(url) ? { type: "link", text: toText(body.caption), url } : null;
  }
  if (type === "table") {
    const out: LogBlock = { type: "table", text: [], rows: [] };
    if (body.has_column_header === true) out.headRow = true;
    if (body.has_row_header === true) out.headCol = true;
    return out;
  }
  if (type === "column_list") return { type: "columns", text: [] };
  if (type === "column") {
    const ratio = Number(body.width_ratio);
    return ratio > 0 && ratio <= 1 ? { type: "column", text: [], ratio } : { type: "column", text: [] };
  }
  if (type === "synced_block") return { type: "p", text: [] };
  if (type === "equation") {
    const expr = String(body.expression ?? "").trim();
    return expr ? { type: "code", text: [{ text: expr }] } : null;
  }
  const mapped = SIMPLE[type];
  if (!mapped) {
    // 일지 안에 만든 하위 페이지는 제목을 글자로 남기고 그 내용을 아래에 펼친다.
    const text = type === "child_page" && typeof body.title === "string" && body.title.trim() ? [{ text: body.title.trim(), bold: true }] : toText(body.rich_text);
    return text.length || block.has_children === true ? { type: "p", text } : null;
  }
  const toggleHeading = mapped.startsWith("h") && body.is_toggleable === true;
  const out: LogBlock = { type: toggleHeading ? "toggle" : mapped, text: toText(body.rich_text), ...tone(body.color) };
  if (toggleHeading) out.level = Number(mapped.slice(1)) as 1 | 2 | 3 | 4;
  if (mapped === "todo") out.checked = body.checked === true;
  if (mapped === "code") {
    const lang = String(body.language ?? "").trim();
    if (lang && lang !== "plain text") out.lang = lang;
  }
  if (mapped === "callout") {
    const icon = obj(body.icon);
    if (icon.type === "emoji" && typeof icon.emoji === "string") out.icon = icon.emoji;
    else {
      const url = obj(icon.external).url ?? obj(icon.file).url ?? obj(icon.custom_emoji).url;
      if (typeof url === "string" && /^https?:\/\//.test(url)) out.iconUrl = url;
    }
  }
  return out;
}

/** 표 행 블록들 → 행·칸 글자. */
export function toTableRows(rows: Json[]): LogText[][][] {
  return rows.filter((r) => r.type === "table_row").map((r) => arr(obj(r.table_row).cells).map((cell) => toText(cell)));
}

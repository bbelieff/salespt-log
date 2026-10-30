/**
 * Layer: repo — 노션 API 읽기 전용 클라이언트(트레이닝일지, 2026-10-30 belie).
 *
 * 토큰은 VPS `.env.local` 의 `NOTION_TOKEN` 에만 둔다(belie 개인 액세스 토큰 「에고라이트」).
 * 이 토큰은 쓰기도 되는 토큰이라 **여기서는 GET 과 조회용 POST(search·query)만** 부른다 —
 * 페이지·블록을 만들거나 고치는 호출을 이 파일에 더하지 않는다.
 * 노션 제한(초당 3회)에 맞춰 순서대로 부르고, 429 는 Retry-After 만큼 한 번 기다린다.
 */

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

export class NotionNotConfigured extends Error {
  constructor() { super("NOTION_TOKEN 없음"); }
}

export function notionConfigured(): boolean {
  return !!process.env.NOTION_TOKEN?.trim();
}

type Json = Record<string, unknown>;

async function call(path: string, body?: Json, retried = false): Promise<Json> {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) throw new NotionNotConfigured();
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 429 && !retried) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 1, 5);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return call(path, body, true);
  }
  if (!res.ok) throw new Error(`notion ${res.status} ${path}`);
  return (await res.json()) as Json;
}

async function paged(path: string, body?: Json): Promise<Json[]> {
  const out: Json[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = body
      ? await call(path, { ...body, ...(cursor ? { start_cursor: cursor } : {}), page_size: 100 })
      : await call(`${path}${path.includes("?") ? "&" : "?"}page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...((page.results as Json[]) ?? []));
    if (!page.has_more || typeof page.next_cursor !== "string") break;
    cursor = page.next_cursor;
  }
  return out;
}

/** 제목에 `query` 가 든 데이터베이스들(연결된 사용자가 볼 수 있는 것만). */
export function searchDatabases(query: string): Promise<Json[]> {
  return paged("/search", { query, filter: { property: "object", value: "database" } });
}

/** 데이터베이스의 모든 행(페이지). 일지는 기수당 수십~백여 건이라 전부 읽고 서비스에서 거른다. */
export function queryDatabase(databaseId: string): Promise<Json[]> {
  return paged(`/databases/${encodeURIComponent(databaseId)}/query`, {});
}

export function getPage(pageId: string): Promise<Json> {
  return call(`/pages/${encodeURIComponent(pageId)}`);
}

export function listBlockChildren(blockId: string): Promise<Json[]> {
  return paged(`/blocks/${encodeURIComponent(blockId)}/children`);
}

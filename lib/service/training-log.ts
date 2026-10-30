/**
 * Layer: service — 트레이닝일지: 로그인한 수강생 **자기 일지만** 노션에서 읽는다(2026-10-30 belie).
 *
 * 내 것 판정은 서버가 레지스트리의 기수·이름으로만 한다(화면이 이름을 보내지 않는다).
 * 기수 → DB 는 노션 검색으로 「[○○N기] 트레이닝 일지」 제목을 찾는다(새 기수 설정 0).
 * 본문 요청은 그 페이지가 내 기수 DB 의 내 행인지 **다시 확인**한 뒤에만 준다.
 * 5분 캐시 — 노션 초당 3회 제한과 파일 주소 1시간 만료 사이.
 */
import type { LogBlock, TrainingLogDetail, TrainingLogList } from "@/types/training-log";
import { findUserByEmail } from "@/repo/users";
import { getPage, listBlockChildren, notionConfigured, queryDatabase, searchDatabases } from "@/repo/notion-client";
import { cohortNumber, isCohortLogDatabase, isOwnLog, plainTitle, sortLogs, toLogBlock, toLogItem, toTableRows } from "./training-log-blocks";

type Json = Record<string, unknown>;
const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function cohortDatabaseIds(cohort: string): Promise<string[]> {
  const n = cohortNumber(cohort);
  return cached(`db:${n}`, async () => {
    const found = await searchDatabases(`${n}기] 트레이닝 일지`);
    return found.filter((d) => isCohortLogDatabase(plainTitle(d.title), n)).map((d) => String(d.id));
  });
}

async function ownPages(cohort: string, name: string): Promise<Json[]> {
  const ids = await cohortDatabaseIds(cohort);
  const pages: Json[] = [];
  for (const id of ids) pages.push(...(await cached(`rows:${id}`, () => queryDatabase(id))));
  return pages.filter((p) => !p.archived && !p.in_trash && isOwnLog(p, name));
}

async function trainee(email: string) {
  const user = await findUserByEmail(email);
  return user && user.role === "trainee" && cohortNumber(user.cohort) && user.name.trim() ? user : null;
}

export async function listMyTrainingLogs(email: string): Promise<TrainingLogList> {
  if (!notionConfigured()) return { status: "not_configured", items: [] };
  const user = await trainee(email);
  if (!user) return { status: "no_cohort", items: [] };
  try {
    if (!(await cohortDatabaseIds(user.cohort)).length) return { status: "no_database", items: [] };
    return { status: "ok", items: sortLogs((await ownPages(user.cohort, user.name)).map(toLogItem)) };
  } catch (e) {
    console.warn("[training-log] 목록 실패", e instanceof Error ? e.message : e);
    return { status: "unavailable", items: [] };
  }
}

const MAX_DEPTH = 4;
const MAX_BLOCKS = 600;

async function readBlocks(blockId: string, depth: number, budget: { left: number }): Promise<LogBlock[]> {
  const out: LogBlock[] = [];
  for (const raw of await listBlockChildren(blockId)) {
    if (budget.left-- <= 0) break;
    const block = toLogBlock(raw);
    if (!block) continue;
    if (raw.has_children === true && depth < MAX_DEPTH) {
      const id = String(raw.id);
      if (block.type === "table") block.rows = toTableRows(await listBlockChildren(id));
      else block.children = await readBlocks(id, depth + 1, budget);
    }
    out.push(block);
  }
  return out;
}

/** 내 일지 한 편. 남의 것·없는 것·다른 기수 것은 모두 null(존재 여부도 알리지 않는다). */
export async function getMyTrainingLog(email: string, pageId: string): Promise<TrainingLogDetail | null> {
  if (!notionConfigured() || !/^[0-9a-f-]{32,36}$/i.test(pageId)) return null;
  const user = await trainee(email);
  if (!user) return null;
  const page = await getPage(pageId);
  const parent = String((page.parent as Json | undefined)?.database_id ?? "").replace(/-/g, "");
  const allowed = (await cohortDatabaseIds(user.cohort)).map((id) => id.replace(/-/g, ""));
  if (!allowed.includes(parent) || page.archived || page.in_trash || !isOwnLog(page, user.name)) return null;
  const blocks = await cached(`blocks:${pageId}`, () => readBlocks(pageId, 0, { left: MAX_BLOCKS }));
  return { ...toLogItem(page), blocks };
}

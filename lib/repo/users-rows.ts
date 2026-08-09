/**
 * Layer: repo — 레지스트리 users 행 읽기 **단일 진입점** (BBE-56).
 * users.ts 에서 분리(500줄 cap). 호환 위해 users.ts 가 `cachedRegistryRows` 를 re-export 한다.
 *
 * 경로 선택:
 *   `REGISTRY_DB_READ=1` → DB(캐시 없음, 항상 최신)
 *   그 외(기본)          → 기존 시트 경로 그대로 — 동작 변화 0
 *   DB 가 실패하거나 0행이면 `readUserRowsFromDb` 가 null 을 주고 여기서 **시트로 폴백**한다
 *   (근거는 db/registry-read.ts 주석 — 빈 테이블을 읽어 전원 로그인 불가가 되는 것을 막는다).
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { registry } from "@/config";
import { readRange } from "./sheets-client";
import { readUserRowsFromDb } from "./db/registry-read";

const DATA_RANGE = (tab: string) => `${tab}!A2:T`;
const REGISTRY_TAG = "registry";

/** 레지스트리 전체 row 60초 캐시 — /api/me 매 호출 스캔 비용 흡수.
 * 쓰기 시 revalidateTag("registry") 즉시 무효화. */
const cachedRegistrySheetRows = unstable_cache(
  async (): Promise<string[][]> => {
    const reg = registry();
    return readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
  },
  ["registry-rows"],
  { revalidate: 60, tags: [REGISTRY_TAG] },
);

/** 시트 직접 read — 캐시 우회(claim 직후 등 최신값이 필요한 경로). */
function readRegistrySheetRows(): Promise<string[][]> {
  const reg = registry();
  return readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));
}

export async function cachedRegistryRows(opts?: { fresh?: boolean }): Promise<string[][]> {
  const fromDb = await readUserRowsFromDb();
  if (fromDb) return fromDb;
  return opts?.fresh ? readRegistrySheetRows() : cachedRegistrySheetRows();
}

// sibling 파일에서도 사용 — claimRegistry (users-claim.ts).
export function invalidateRegistry(): void {
  revalidateTag(REGISTRY_TAG);
}

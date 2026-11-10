/**
 * Layer: repo — 「이 번호로 시트를 쓰거나 보충해서 읽어도 되나」의 단일 판정 (ADR-0038).
 *
 * 시트를 건너뛰는 경우 두 가지:
 *  · 시트 없는 수강생(`local:` 번호) — 시트가 아예 없다.
 *  · 시트에서 떼어 낸 기수(SHEET_DETACHED_COHORTS) — 시트는 있지만 얼어붙었다. 미러를 보내면 낡은 시트가
 *    부분만 갱신돼 헷갈리고, 보충 읽기를 하면 DB 에서 지운 행이 얼어붙은 시트에서 되살아난다.
 *
 * 떼어 낸 기수 목록이 비어 있으면 명단 조회 없이 바로 끝난다(지금 운영 비용 0).
 * 한 시트를 여러 명단 행이 나눠 쓰면(직원·아레나 재참여 등) **모든 행이** 떼어 낸 기수일 때만 떼어 낸 것으로 본다.
 */
import { SHEET_DETACHED_COHORTS } from "@/config/sheet-detach";
import { isSheetlessTenantKey } from "@/util/tenant-key";
import { cachedRegistryRows } from "./users-rows";

const norm = (c: unknown) => String(c ?? "").replace(/기\s*$/, "").trim();

/** 명단 행의 저장 기수 — 유보·빈 기수면 원래 기수(I열 cohort_label). service/daily-source.ts sourceCohort 와 같은 규칙. */
function storageCohort(r: string[]): string {
  const c = norm(r[1]);
  const label = norm(r[8]);
  return (c === "유보" || c === "") && label && label !== "유보" ? label : c;
}

export async function isSheetDetached(
  spreadsheetId: string,
  detached: ReadonlySet<string> = SHEET_DETACHED_COHORTS,
): Promise<boolean> {
  if (isSheetlessTenantKey(spreadsheetId)) return true;
  if (detached.size === 0 || !spreadsheetId) return false;
  const owners = (await cachedRegistryRows()).filter((r) => String(r[3] ?? "").trim() === spreadsheetId);
  return owners.length > 0 && owners.every((r) => detached.has(storageCohort(r)));
}

/** 시트 미러 잡 감싸기 — 떼어 낸 번호면 아무것도 안 한다. */
export async function whenSheetAttached(spreadsheetId: string, job: () => Promise<unknown>): Promise<void> {
  if (await isSheetDetached(spreadsheetId)) return;
  await job();
}

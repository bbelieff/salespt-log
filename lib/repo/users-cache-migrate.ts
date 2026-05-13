/**
 * Layer: repo — Registry I~L 캐시 일괄 백필 (PR B-3).
 *
 * 동작:
 *   1. registry 전체 row 스캔.
 *   2. I~L (cohort_label/name_label/course_start_iso/graduation_iso) 중 하나라도
 *      빈 row → 시트 읽어서 채움 후보.
 *   3. spreadsheetId 가 빈 row (트레이너/admin) → skip.
 *   4. 동일 spreadsheetId 공유 row 들은 readProfileBundle 1회로 모두 처리
 *      (멀티 계정 per 시트).
 *   5. 시트 read 실패 → failed 에 기록, 다음 row 진행.
 *   6. 모든 update 를 batchUpdate 단일 호출(100개 단위 chunk)로 전송.
 *
 * 멱등: 이미 cached 채워진 row 는 fetch 안 하고 skip. 다시 호출해도 안전.
 *
 * 사용처:
 *   - 기존(PR B-1 이전) row 들의 I~L 빈 값 backfill.
 *   - PR B-2 의 prep/claim 시점 시트 read 실패 row 들 retry.
 *   - admin /admin/users 의 [🔄 동기화] 버튼.
 */
import { registry } from "@/config";
import { readRange, sheetsClient } from "./sheets-client";
import { readProfileBundle } from "./sales";
import { invalidateRegistry } from "./users";

const DATA_RANGE = (tab: string) => `${tab}!A2:M`;
const CHUNK_SIZE = 100; // Sheets API batchUpdate 안전 청크 크기.

export interface MigrateFailed {
  row: number; // 시트 row (1-based, header 포함 = 2~)
  email: string; // 빈 prep row 는 "(prep)"
  cohort: string;
  name: string;
  error: string;
}

export interface MigrateResult {
  processed: number; // 스캔한 row 총수
  updated: number; // 실제 I~L 갱신한 row
  skipped: number; // 이미 캐시 채워졌거나 (sheetId 없거나 trainer)
  failed: MigrateFailed[];
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface CachedTuple {
  cohort: string;
  name: string;
  courseStartISO: string;
  graduationISO: string;
}

export async function migrateRegistryCache(): Promise<MigrateResult> {
  const reg = registry();
  const rows = await readRange(reg.spreadsheetId, DATA_RANGE(reg.tab));

  // sheetId 단위 fetch 캐싱 — 동일 시트에 묶인 멀티 계정 row N개를 1회 read 로.
  // null = 이전 시도 실패 (반복 fetch 회피).
  const bundleCache = new Map<string, CachedTuple | null>();

  async function getBundleFor(sheetId: string): Promise<CachedTuple | null> {
    if (bundleCache.has(sheetId)) return bundleCache.get(sheetId)!;
    try {
      const b = await readProfileBundle(sheetId);
      const tuple: CachedTuple = {
        cohort: b.cohort,
        name: b.name,
        courseStartISO: toISO(b.courseStart),
        graduationISO: toISO(b.graduation),
      };
      bundleCache.set(sheetId, tuple);
      return tuple;
    } catch (e) {
      bundleCache.set(sheetId, null);
      // 한 시트의 실패는 호출자(아래 loop)가 모든 공유 row 에 동일하게 적용.
      // 여기서는 throw 안 함 — 다음 row 진행.
      void e;
      return null;
    }
  }

  const updates: { range: string; values: unknown[][] }[] = [];
  const failed: MigrateFailed[] = [];
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const sheetRow = i + 2;
    const email = String(r[0] ?? "").trim();
    const cohort = String(r[1] ?? "").trim();
    const name = String(r[2] ?? "").trim();
    const sheetId = String(r[3] ?? "").trim();
    const cohortLabel = String(r[8] ?? "").trim();
    const nameLabel = String(r[9] ?? "").trim();
    const courseStartISO = String(r[10] ?? "").trim();
    const graduationISO = String(r[11] ?? "").trim();

    // 이미 4종 모두 채워짐 → skip.
    const alreadyCached =
      cohortLabel !== "" &&
      nameLabel !== "" &&
      courseStartISO !== "" &&
      graduationISO !== "";
    if (alreadyCached) {
      skipped++;
      continue;
    }

    // 시트 없는 row (트레이너/admin) → skip.
    if (!sheetId) {
      skipped++;
      continue;
    }

    const bundle = await getBundleFor(sheetId);
    if (!bundle) {
      failed.push({
        row: sheetRow,
        email: email || "(prep)",
        cohort,
        name,
        error: `시트 ${sheetId.slice(0, 10)}… 읽기 실패`,
      });
      continue;
    }

    updates.push({
      range: `${reg.tab}!I${sheetRow}:L${sheetRow}`,
      values: [[
        bundle.cohort,
        bundle.name,
        bundle.courseStartISO,
        bundle.graduationISO,
      ]],
    });
    updated++;
  }

  // 청크 단위로 batchUpdate (100 row/call).
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    await sheetsClient().spreadsheets.values.batchUpdate({
      spreadsheetId: reg.spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: chunk,
      },
    });
  }

  if (updates.length > 0) {
    invalidateRegistry();
  }

  return {
    processed: rows.length,
    updated,
    skipped,
    failed,
  };
}

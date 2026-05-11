/**
 * Layer: repo — 기수별 활성/보관 상태 관리.
 *
 * registry 스프레드시트의 별도 탭 (`cohorts`):
 *   A: cohort (예: "7" / "8" / "6") — trainee row 의 cohort 와 동일 의미.
 *   B: status ("active" | "archived")
 *   C: note (자유 메모, optional)
 *
 * 탭이 없으면 첫 호출 시 ensureCohortsTab() 으로 자동 생성 + 시드.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { registry, cohortsTab } from "@/config";
import { readRange, appendRows, sheetsClient } from "./sheets-client";

export type CohortStatus = "active" | "archived";

export interface Cohort {
  label: string;
  status: CohortStatus;
  note: string;
}

const COHORTS_TAG = "cohorts";

const cachedCohortsRows = unstable_cache(
  async (): Promise<string[][]> => {
    const reg = registry();
    try {
      return await readRange(reg.spreadsheetId, `${cohortsTab()}!A2:C`);
    } catch {
      // 탭 없을 수 있음 (ensure 전 첫 호출) — 빈 배열로 fallback.
      return [];
    }
  },
  ["cohorts-rows"],
  { revalidate: 60, tags: [COHORTS_TAG] },
);

function invalidateCohorts(): void {
  revalidateTag(COHORTS_TAG);
}

export async function listCohorts(): Promise<Cohort[]> {
  const rows = await cachedCohortsRows();
  return rows
    .filter((r) => r[0] && String(r[0]).trim() !== "")
    .map((r) => ({
      label: String(r[0]).trim(),
      status: r[1] === "archived" ? "archived" : "active",
      note: String(r[2] ?? ""),
    }));
}

/** 한 기수 label 의 status 반환 (시트에 없으면 default "active"). */
export async function getCohortStatus(label: string): Promise<CohortStatus> {
  const trimmed = label.trim();
  if (!trimmed) return "active";
  const list = await listCohorts();
  const found = list.find((c) => c.label === trimmed);
  return found?.status ?? "active";
}

/** archived 기수 label set — 빠른 멤버십 검사용. */
export async function getArchivedCohortSet(): Promise<Set<string>> {
  const list = await listCohorts();
  return new Set(list.filter((c) => c.status === "archived").map((c) => c.label));
}

/**
 * 탭 + 헤더 자동 생성. 이미 row 있으면 noop.
 * 시드: 인자로 주어진 cohort label 들을 active 로 append.
 */
export async function ensureCohortsTab(seedLabels: string[] = []): Promise<void> {
  const reg = registry();
  const tab = cohortsTab();

  // 탭 존재 여부 확인.
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId: reg.spreadsheetId,
    fields: "sheets(properties(title,sheetId))",
  });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab);
  if (!exists) {
    await sheetsClient().spreadsheets.batchUpdate({
      spreadsheetId: reg.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }],
      },
    });
  }

  // 헤더 확인.
  const header = await readRange(reg.spreadsheetId, `${tab}!A1:C1`);
  if (!header[0]?.[0]) {
    await appendRows(reg.spreadsheetId, `${tab}!A1:C`, [
      ["cohort", "status", "note"],
    ]);
  }

  // 기존 데이터 row 있는지.
  const existing = await readRange(reg.spreadsheetId, `${tab}!A2:A`);
  if (existing.length > 0) {
    invalidateCohorts();
    return;
  }

  // 시드.
  if (seedLabels.length > 0) {
    const uniq = Array.from(new Set(seedLabels.filter(Boolean)));
    await appendRows(
      reg.spreadsheetId,
      `${tab}!A2:C`,
      uniq.map((l) => [l, "active", ""]),
    );
  }
  invalidateCohorts();
}

/** label row 의 status 변경. 없으면 append. */
export async function setCohortStatus(
  label: string,
  status: CohortStatus,
): Promise<void> {
  const reg = registry();
  const tab = cohortsTab();
  const rows = await readRange(reg.spreadsheetId, `${tab}!A2:C`);
  const trimmed = label.trim();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? "").trim() === trimmed) {
      const sheetRow = i + 2;
      await sheetsClient().spreadsheets.values.update({
        spreadsheetId: reg.spreadsheetId,
        range: `${tab}!B${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[status]] },
      });
      invalidateCohorts();
      return;
    }
  }
  // 없으면 새 row append.
  await appendRows(reg.spreadsheetId, `${tab}!A2:C`, [[trimmed, status, ""]]);
  invalidateCohorts();
}

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
export type CohortType = "cohort" | "arena";

export interface Cohort {
  label: string;
  status: CohortStatus;
  note: string;
  type: CohortType; // D — 없으면 "cohort"
  templateSheetId: string; // E — 복제 원본 시트 ID
  rootFolderId: string; // F — 기수 루트(일반) / 아레나 N회(아레나) 폴더 ID
  rosterSheetId: string; // G — (아레나) 전체 참가자 시트 ID. 일반 기수 빈값
}

const COHORTS_TAG = "cohorts";

const cachedCohortsRows = unstable_cache(
  async (): Promise<string[][]> => {
    const reg = registry();
    try {
      return await readRange(reg.spreadsheetId, `${cohortsTab()}!A2:G`);
    } catch {
      // 탭 없을 수 있음 (ensure 전 첫 호출) — 빈 배열로 fallback.
      return [];
    }
  },
  ["cohorts-rows"],
  { revalidate: 60, tags: [COHORTS_TAG] },
);

function invalidateCohorts(): void {
  // Server Component 의 render phase 에서 호출되면 Next.js 15+ 가 throw 한다.
  // ensureCohortsTab() 은 Server Component (예: /admin/cohorts) 에서 호출되므로
  // try/catch 로 render context 호출은 무시. 데이터는 unstable_cache 의
  // `revalidate: 60` 에 따라 자연 갱신된다.
  // Server Action / Route Handler 에서 호출되는 setCohortStatus() 는 정상 동작.
  try {
    revalidateTag(COHORTS_TAG);
  } catch {
    // Render context — 무시.
  }
}

export async function listCohorts(): Promise<Cohort[]> {
  const rows = await cachedCohortsRows();
  return rows
    .filter((r) => r[0] && String(r[0]).trim() !== "")
    .map((r) => ({
      label: String(r[0]).trim(),
      status: r[1] === "archived" ? "archived" : "active",
      note: String(r[2] ?? ""),
      type: r[3] === "arena" ? "arena" : "cohort",
      templateSheetId: String(r[4] ?? "").trim(),
      rootFolderId: String(r[5] ?? "").trim(),
      rosterSheetId: String(r[6] ?? "").trim(),
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

  // 헤더 확인/갱신 (A1:G 멱등). 기존 A~C 헤더만 있으면 D~G 헤더 보강.
  const header = await readRange(reg.spreadsheetId, `${tab}!A1:G1`);
  const HEADER = [
    "cohort",
    "status",
    "note",
    "type",
    "templateSheetId",
    "rootFolderId",
    "rosterSheetId",
  ];
  if (!header[0]?.[0] || (header[0]?.length ?? 0) < HEADER.length) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${tab}!A1:G1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADER] },
    });
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
      `${tab}!A2:G`,
      uniq.map((l) => [l, "active", "", "cohort", "", "", ""]),
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
  await appendRows(reg.spreadsheetId, `${tab}!A2:G`, [
    [trimmed, status, "", "cohort", "", "", ""],
  ]);
  invalidateCohorts();
}

/**
 * cohorts row 의 설정(D~G) upsert. 주어진 필드만 갱신(나머지 보존).
 * 없으면 새 row(status=active) append. (ADR-0011 — 기수 생성 설정)
 */
export async function upsertCohortConfig(
  label: string,
  cfg: {
    type?: CohortType;
    templateSheetId?: string;
    rootFolderId?: string;
    rosterSheetId?: string;
  },
): Promise<void> {
  const reg = registry();
  const tab = cohortsTab();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("[upsertCohortConfig] label 비어있음");
  const rows = await readRange(reg.spreadsheetId, `${tab}!A2:G`);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? "").trim() === trimmed) {
      const cur = rows[i] ?? [];
      const sheetRow = i + 2;
      const next = [
        cfg.type ?? (cur[3] === "arena" ? "arena" : cur[3] ? "cohort" : "cohort"),
        cfg.templateSheetId ?? String(cur[4] ?? ""),
        cfg.rootFolderId ?? String(cur[5] ?? ""),
        cfg.rosterSheetId ?? String(cur[6] ?? ""),
      ];
      await sheetsClient().spreadsheets.values.update({
        spreadsheetId: reg.spreadsheetId,
        range: `${tab}!D${sheetRow}:G${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [next] },
      });
      invalidateCohorts();
      return;
    }
  }
  // 없으면 새 row.
  await appendRows(reg.spreadsheetId, `${tab}!A2:G`, [
    [
      trimmed,
      "active",
      "",
      cfg.type ?? "cohort",
      cfg.templateSheetId ?? "",
      cfg.rootFolderId ?? "",
      cfg.rosterSheetId ?? "",
    ],
  ]);
  invalidateCohorts();
}

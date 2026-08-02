/**
 * Layer: repo — 기수별 활성/보관 상태 관리.
 *
 * registry 스프레드시트의 별도 탭 (`cohorts`):
 *   A: cohort (예: "7" / "8" / "6") — trainee row 의 cohort 와 동일 의미.
 *   B: status ("active" | "archived")
 *   C: note (자유 메모, optional)
 *   D~I: type / 템플릿·폴더 ID (ADR-0011/0012 생성 설정)
 *   J: seasonStartISO — (아레나) **시즌 개강일 정본**. admin 이 직접 입력하는 값.
 *      전광판 시즌 판정 SSOT (AR-2b). registry K(참가자별 courseStartISO)는 시트 템플릿
 *      O1 이 스탬프돼 출처를 신뢰할 수 없어 시즌 판정에 쓰지 않는다.
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
  sheetsFolderId: string; // H — (아레나) 경영일지 시트 복제 대상 폴더 ID
  companyParentFolderId: string; // I — (아레나) 업체관리 폴더 생성 부모 폴더 ID
  /** J — (아레나) 시즌 개강일 "YYYY-MM-DD". admin 입력. 빈값=미정(전광판 시즌 미판정). */
  seasonStartISO: string;
}

const COHORTS_TAG = "cohorts";

const cachedCohortsRows = unstable_cache(
  async (): Promise<string[][]> => {
    const reg = registry();
    try {
      return await readRange(reg.spreadsheetId, `${cohortsTab()}!A2:J`);
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

/**
 * cohorts J(시즌 개강일) 읽기 정규화 → "YYYY-MM-DD" 또는 "".
 * 앱은 RAW 로 쓰지만(날짜 셀 변환 차단), **admin 이 시트에서 직접 입력**하면 날짜 셀이 되어
 * 로케일 문자열("2026. 8. 7.")로 읽힌다. 그 값을 그대로 두면 ISO 검사가 실패해 시즌이 영구
 * 미판정(0)이 되므로, 흔한 표기를 여기서 흡수한다. 알 수 없는 형태는 ""(미정) 로 degrade.
 */
export function normalizeSeasonStart(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // "2026. 8. 7." / "2026.8.7" / "2026/8/7" → 2026-08-07
  const m = s.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?$/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
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
      sheetsFolderId: String(r[7] ?? "").trim(),
      companyParentFolderId: String(r[8] ?? "").trim(),
      seasonStartISO: normalizeSeasonStart(r[9]),
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

  // 헤더 확인/갱신 (A1:I 멱등). 기존 짧은 헤더면 D~I 헤더 보강.
  const header = await readRange(reg.spreadsheetId, `${tab}!A1:J1`);
  const HEADER = [
    "cohort",
    "status",
    "note",
    "type",
    "templateSheetId",
    "rootFolderId",
    "rosterSheetId",
    "sheetsFolderId",
    "companyParentFolderId",
    "seasonStartISO",
  ];
  if (!header[0]?.[0] || (header[0]?.length ?? 0) < HEADER.length) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${tab}!A1:J1`,
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
      `${tab}!A2:J`,
      uniq.map((l) => [l, "active", "", "cohort", "", "", "", "", "", ""]),
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
  await appendRows(reg.spreadsheetId, `${tab}!A2:J`, [
    [trimmed, status, "", "cohort", "", "", "", "", "", ""],
  ]);
  invalidateCohorts();
}

/**
 * cohorts row 의 설정(D~J) upsert. 주어진 필드만 갱신(나머지 보존).
 * 없으면 새 row(status=active) append. (ADR-0011/0012 — 기수·아레나 생성 설정)
 */
export async function upsertCohortConfig(
  label: string,
  cfg: {
    type?: CohortType;
    templateSheetId?: string;
    rootFolderId?: string;
    rosterSheetId?: string;
    sheetsFolderId?: string;
    companyParentFolderId?: string;
    /** (아레나) 시즌 개강일 "YYYY-MM-DD" — 전광판 시즌 판정 정본(AR-2b). */
    seasonStartISO?: string;
  },
): Promise<void> {
  const reg = registry();
  const tab = cohortsTab();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("[upsertCohortConfig] label 비어있음");
  const rows = await readRange(reg.spreadsheetId, `${tab}!A2:J`);

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? "").trim() === trimmed) {
      const cur = rows[i] ?? [];
      const sheetRow = i + 2;
      const next = [
        cfg.type ?? (cur[3] === "arena" ? "arena" : "cohort"),
        cfg.templateSheetId ?? String(cur[4] ?? ""),
        cfg.rootFolderId ?? String(cur[5] ?? ""),
        cfg.rosterSheetId ?? String(cur[6] ?? ""),
        cfg.sheetsFolderId ?? String(cur[7] ?? ""),
        cfg.companyParentFolderId ?? String(cur[8] ?? ""),
        cfg.seasonStartISO ?? String(cur[9] ?? ""),
      ];
      await sheetsClient().spreadsheets.values.update({
        spreadsheetId: reg.spreadsheetId,
        range: `${tab}!D${sheetRow}:J${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [next] },
      });
      invalidateCohorts();
      return;
    }
  }
  // 없으면 새 row.
  await appendRows(reg.spreadsheetId, `${tab}!A2:J`, [
    [
      trimmed,
      "active",
      "",
      cfg.type ?? "cohort",
      cfg.templateSheetId ?? "",
      cfg.rootFolderId ?? "",
      cfg.rosterSheetId ?? "",
      cfg.sheetsFolderId ?? "",
      cfg.companyParentFolderId ?? "",
      cfg.seasonStartISO ?? "",
    ],
  ]);
  invalidateCohorts();
}

/**
 * (아레나) 시즌 개강일(J) 설정 — 전광판 시즌 판정 정본(AR-2b).
 * admin 이 `/admin/cohorts` 에서 시즌 행(label "A{n}")에 직접 입력한다.
 * 빈 문자열 = 미정으로 되돌림(전광판은 시즌 번호를 표시하지 않고 데이터도 자르지 않는다).
 *
 * ⚠️ `type: "arena"` 를 함께 보장한다 — 시즌 행이 아직 없을 때 upsert 가 append 하면
 * 기본값이 `"cohort"` 로 들어가고, `resolveCurrentSeason` 의 type 게이트가 그 행을 건너뛰어
 * **개강일을 입력해도 시즌이 전환되지 않는다**(개막 차단 결함). 호출부(API)가 라벨이
 * 시즌 레벨("A{n}")임을 이미 검증하므로 arena 로 못박아도 안전하다.
 */
export async function setSeasonStart(
  label: string,
  seasonStartISO: string,
): Promise<void> {
  const iso = seasonStartISO.trim();
  if (iso !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error("[setSeasonStart] YYYY-MM-DD 형식이 아님");
  }
  // 행 생성/type 보장은 upsert 로(D~J, USER_ENTERED — ID·라벨은 텍스트라 무해).
  await upsertCohortConfig(label, { type: "arena", seasonStartISO: iso });
  // ⚠️ J 는 **RAW 로 덮어쓴다** — USER_ENTERED 면 Sheets 가 "2026-08-07" 을 **날짜 시리얼**로
  // 강제 변환하고, 다시 읽을 때 로케일 문자열("2026. 8. 7.")로 나와 ISO 검사가 실패한다
  // → 시즌이 영구 미판정(0). appendArenaRoster 의 등록일과 동일한 사고 패턴이라 같은 처방.
  await writeSeasonStartRaw(label, iso);
}

/** cohorts J 셀만 RAW 로 기록 — 날짜 시리얼 변환 차단. 행이 없으면 조용히 무시(upsert 선행). */
async function writeSeasonStartRaw(label: string, iso: string): Promise<void> {
  const reg = registry();
  const tab = cohortsTab();
  const trimmed = label.trim();
  const rows = await readRange(reg.spreadsheetId, `${tab}!A2:A`);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[0] ?? "").trim() !== trimmed) continue;
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId: reg.spreadsheetId,
      range: `${tab}!J${i + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[iso]] },
    });
    invalidateCohorts();
    return;
  }
}

/**
 * (아레나) 전체 참가자 명단 시트(rosterSheetId)에 1행 append (ADR-0011).
 * 시트는 admin 이 사전 생성. 컬럼 규약: A 이름 / B 시트URL / C 폴더URL / D 등록일(ISO).
 * RAW 로 써서 등록일 문자열이 날짜 시리얼로 변환되는 사고 방지.
 * 멱등성은 호출 측(registry (label,name) 중복 검사)이 보장 → 중복 append 없음.
 */
export async function appendArenaRoster(
  rosterSheetId: string,
  row: { name: string; sheetUrl: string; folderUrl: string; regDateISO: string },
): Promise<void> {
  if (!rosterSheetId.trim()) {
    throw new Error("[appendArenaRoster] rosterSheetId 비어있음");
  }
  await appendRows(
    rosterSheetId,
    "A:D",
    [[row.name, row.sheetUrl, row.folderUrl, row.regDateISO]],
    { valueInputOption: "RAW" },
  );
}

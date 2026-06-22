/**
 * Layer: repo — 전광판 공유왕 수동 점수 `share_scores` 탭 (arena-scoreboard-v2).
 *
 * 개인 시트가 아니라 SHEETS_REGISTRY_ID 의 탭: A=email B=name C=cohort(A1-N)
 * D=points(정수) E=updatedAt(ISO). 운영자가 수동으로 점수 입력(향후 admin UI).
 * read = 10분 캐시(SHARE_SCORES_TAG). 탭/빈값이면 [] (공유왕 0).
 * setShareScores = email 키 행의 A:E 만 타격(다른 행·탭 보존, §2.5 안전 쓰기 —
 *   point 는 의도적 덮어쓰기 대상이라 무관 데이터만 보호).
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { registry, SHEET_RANGES } from "@/config";
import { sheetsClient } from "./sheets-client";

const S = SHEET_RANGES.share_scores;
export const SHARE_SCORES_TAG = "share-scores";

export interface ShareScore {
  email: string;
  name: string;
  cohort: string;
  points: number;
}

async function readRaw(): Promise<ShareScore[]> {
  try {
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: registry().spreadsheetId,
      range: `${S.tab}!${S.range}`,
    });
    return (res.data.values ?? [])
      .map((r) => ({
        email: String(r[0] ?? "").trim(),
        name: String(r[1] ?? "").trim(),
        cohort: String(r[2] ?? "").trim(),
        points: Number(r[3]) || 0,
      }))
      .filter((r) => r.name);
  } catch {
    return []; // 탭 없거나 빈 — 공유왕 점수 없음
  }
}

/** 공유왕 점수 read — 10분 캐시. 수동 갱신 = invalidateShareScores(). */
export const readShareScores = unstable_cache(readRaw, ["share-scores"], {
  revalidate: 600,
  tags: [SHARE_SCORES_TAG],
});

export function invalidateShareScores(): void {
  revalidateTag(SHARE_SCORES_TAG);
}

/** share_scores 탭 자동 생성(ensure) — 없으면 addSheet + 헤더행. 05/06 탭 패턴.
 *  write(setShareScores) 전 1회. read 는 탭 없으면 [] 라 ensure 불필요. */
let shareTabEnsured = false;
async function ensureShareScoresTab(): Promise<void> {
  if (shareTabEnsured) return;
  const spreadsheetId = registry().spreadsheetId;
  const client = sheetsClient();
  const meta = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = (meta.data.sheets ?? []).some(
    (s) => s.properties?.title === S.tab,
  );
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: S.tab } } }] },
    });
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${S.tab}!A1:E1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["email", "name", "cohort", "points", "updatedAt"]],
      },
    });
  }
  shareTabEnsured = true;
}

/** 공유왕 점수 set — email 키 행의 A:E 만 update(기존 행) / 빈 행 append(신규).
 *  자기 키 행만 타격해 다른 참가자 점수·다른 탭은 보존(§2.5 안전 쓰기). */
export async function setShareScores(
  rows: { email: string; name: string; cohort: string; points: number; updatedAt: string }[],
): Promise<void> {
  if (rows.length === 0) return;
  await ensureShareScoresTab();
  const spreadsheetId = registry().spreadsheetId;
  const existing =
    (
      await sheetsClient()
        .spreadsheets.values.get({ spreadsheetId, range: `${S.tab}!A2:A` })
        .catch(() => ({ data: { values: [] as string[][] } }))
    ).data.values ?? [];
  const emailRow = new Map<string, number>();
  existing.forEach((r, i) => {
    const e = String(r[0] ?? "").trim().toLowerCase();
    if (e) emailRow.set(e, i + 2);
  });
  let nextRow = existing.length + 2;
  const data = rows.map((row) => {
    const r = emailRow.get(row.email.toLowerCase()) ?? nextRow++;
    return {
      range: `${S.tab}!A${r}:E${r}`,
      values: [[row.email, row.name, row.cohort, row.points, row.updatedAt]],
    };
  });
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });
  invalidateShareScores();
}

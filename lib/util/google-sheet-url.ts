/**
 * Layer: util (순수 — import 0). 구글시트 공유 주소 → 문서 id·탭 gid (DB 가져오기, 2026-10-24 belie).
 * docs.google.com/spreadsheets/d/<id>/… 모양만 받는다(다른 주소는 null) — 서버가 이 id 로만 내려받는다.
 */
export type GoogleSheetRef = { id: string; gid: string | null };

export function parseGoogleSheetUrl(input: string): GoogleSheetRef | null {
  const text = input.trim();
  if (!text || /\s/.test(text) || text.length > 2000) return null;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return null;
  const m = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})(?:\/|$)/);
  if (!m) return null;
  const gidRaw = url.searchParams.get("gid") ?? new URLSearchParams(url.hash.replace(/^#/, "")).get("gid");
  const gid = gidRaw && /^\d{1,12}$/.test(gidRaw) ? gidRaw : null;
  return { id: m[1]!, gid };
}

/** CSV 내려받기 주소 — gid 가 없으면 첫 탭. */
export function googleSheetCsvUrl(ref: GoogleSheetRef): string {
  return `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv${ref.gid ? `&gid=${ref.gid}` : ""}`;
}

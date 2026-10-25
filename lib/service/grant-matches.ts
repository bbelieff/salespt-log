/**
 * Layer: service — 실무/수납 맞춤공고(2026-10-26 맞춤공고 4단계).
 * 공고 피드(최근 14게시일, 마감 지난 것 제외) × 계약 업체 업체정보 → 계약ref 별 맞는 공고.
 * 판정은 lib/analytics/grant-match.ts(저장 없음). 업체정보는 DB 미러를 한 번에 읽는다 — 요청 경로에서 시트를 부르지 않는다.
 */
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { readContractsFromDb } from "@/repo/db/read-daily";
import { readCompanyInfosFromDb } from "@/repo/db/company-info-all";
import { readPolicyNewsDays } from "@/repo/policy-news";
import { contractRef } from "@/util/contract-ref";
import { isClosed, mergeAnnouncements } from "@/lib/analytics/policy-announcement";
import { grantProfile } from "@/lib/analytics/company-grant";
import { matchesFor, type GrantMatchesResponse } from "@/lib/analytics/grant-match";
import { usesDbStorage } from "./daily-source";

const EMPTY: GrantMatchesResponse = { announcements: {}, companies: {}, unavailable: true };

export async function loadGrantMatches(email: string, today: string, sheetOverride?: string): Promise<GrantMatchesResponse> {
  const user = await findUserByEmail(email);
  if (!user?.spreadsheetId) throw new Error("[no-sheet] Invalid student sheet");
  if (!usesDbStorage(user)) return EMPTY;
  const sheet = sheetOverride ?? user.spreadsheetId;
  const [days, contracts, infos] = await Promise.all([
    readPolicyNewsDays(14),
    readContractsFromDb(sheet),
    readCompanyInfosFromDb(sheet).catch((e) => {
      Sentry.captureException(e, { tags: { where: "grant-matches-company-info" } });
      return new Map();
    }),
  ]);
  if (days.length === 0) return EMPTY;
  const list = mergeAnnouncements(days).filter((a) => !isClosed(a, today));
  const used = new Set<string>();
  const companies: GrantMatchesResponse["companies"] = {};
  for (const cp of contracts) {
    if (cp.해지일 || cp.해지숨김) continue;
    const ref = contractRef(cp.계약일, cp.업체명);
    const ci = infos.get(ref);
    if (!ci) { companies[ref] = { hasInfo: false, noRegion: false, matches: [] }; continue; }
    const found = matchesFor(ci, list, today);
    for (const f of found) used.add(f.a.id);
    companies[ref] = {
      hasInfo: true,
      noRegion: !grantProfile(ci).region.시도,
      matches: found.map(({ a, m }) => ({ id: a.id, verdict: m.verdict as "match" | "check", reasons: m.reasons, urgent: m.urgent })),
    };
  }
  const announcements: GrantMatchesResponse["announcements"] = {};
  for (const a of list) {
    if (!used.has(a.id)) continue;
    announcements[a.id] = { id: a.id, title: a.title, agency: a.agency, regionText: a.regionText, maxAmount: a.maxAmount, deadlineText: a.deadlineText, link: a.link, lastSeen: a.lastSeen };
  }
  return { announcements, companies, unavailable: false };
}

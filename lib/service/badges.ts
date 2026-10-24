/**
 * 배지 — 한 수강생의 기록을 읽어 배지 상태를 돌려준다. 읽기 전용, 저장 없음.
 * DB 정본 기수만 기록을 읽는다(시트 동기 호출 없음). 한 출처가 실패해도 나머지로 판정하고 partial 로 알린다.
 */
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { readContractsFromDb, readMeetingsFromDb, readTodosFromDb } from "@/repo/db/read-daily";
import { readDbTabFromDb } from "@/repo/db/read-db-tab";
import { readDbSheetContactRows, readDbSheetLeadBasics, readFirstPushDate, readFirstWeeklyGoalDate } from "@/repo/db/badge-reads";
import { ceremonyISO } from "@/config/cohort-dates";
import { isValidISODate } from "@/util/week";
import { judgeBadges, type BadgeSources, type BadgeState } from "@/lib/analytics/badges";
import { usesDbStorage } from "./daily-source";

export interface BadgesView { badges: BadgeState[]; partial: boolean }

async function settle<T>(label: string, p: Promise<T>, fallback: T, failed: string[]): Promise<T> {
  try { return await p; }
  catch (error) {
    failed.push(label);
    Sentry.captureException(error, { tags: { where: `loadBadges-${label}` } });
    return fallback;
  }
}

export async function loadBadges(email: string, today: string, sheetOverride?: string): Promise<BadgesView> {
  const user = await findUserByEmail(email, { fresh: true });
  if (!user?.spreadsheetId) throw new Error("[no-sheet] Invalid student sheet");
  const sheet = sheetOverride ?? user.spreadsheetId;
  const failed: string[] = [];
  const grad = ceremonyISO(user.courseStartISO, user.cohort) || user.graduationISO;
  const db = usesDbStorage(user);
  const none = Promise.resolve([] as never[]);
  const [contacts, leads, meetings, contracts, todos, dbTab, firstGoalOn, pushOnSince] = await Promise.all([
    db ? settle("contacts", readDbSheetContactRows(sheet), [], failed) : none,
    db ? settle("leads", readDbSheetLeadBasics(sheet), [], failed) : none,
    db ? settle("meetings", readMeetingsFromDb(sheet), [], failed) : none,
    db ? settle("contracts", readContractsFromDb(sheet), [], failed) : none,
    db ? settle("todos", readTodosFromDb(sheet), [], failed) : none,
    db ? settle("db-tab", readDbTabFromDb(sheet), null, failed) : Promise.resolve(null),
    db ? settle("goal", readFirstWeeklyGoalDate(sheet), null, failed) : Promise.resolve(null),
    settle("push", readFirstPushDate(email), null, failed),
  ]);
  const src: BadgeSources = {
    contacts, leads, meetings, contracts, todos,
    dbTabDates: dbTab ? [
      ...dbTab.purchases.map(x => x.구매일), ...dbTab.productions.map(x => x.시작일),
      ...dbTab.banners.map(x => x.날짜), ...dbTab.leads.map(x => x.접수일),
    ] : [],
    firstGoalOn, pushOnSince,
    graduationOn: isValidISODate(grad) ? grad : null,
  };
  return { badges: judgeBadges(src, today), partial: !db || failed.length > 0 };
}

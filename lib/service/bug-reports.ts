/**
 * Layer: service — 오류신고 접수(2026-10-25 belie).
 * 저장 → 관리자 휴대폰 알림(웹 푸시, 켜 둔 기기만). 알림 실패는 접수를 막지 않는다.
 */
import { adminEmails } from "@/config";
import { findUserByEmail } from "@/repo/users";
import { countRecentBugReports, insertBugReport } from "@/repo/db/bug-reports";
import { listActiveSubscriptions, recordSendResult } from "@/repo/db/push";
import { pushConfigured, sendPush } from "@/repo/push-sender";
import { BugReportInput } from "@/types/bug-report";

/** 하루(24시간) 한 사람 신고 상한. */
export const BUG_REPORT_DAILY_LIMIT = 20;
export class BugReportLimit extends Error {}

export async function submitBugReport(email: string, raw: unknown): Promise<{ id: string }> {
  const input = BugReportInput.parse(raw);
  if (await countRecentBugReports(email) >= BUG_REPORT_DAILY_LIMIT) throw new BugReportLimit("오늘은 신고를 더 받을 수 없어요. 카톡으로 알려 주세요.");
  const user = await findUserByEmail(email).catch(() => null);
  const id = await insertBugReport({
    email, name: user?.name ?? "", cohort: user?.cohort ?? "",
    category: input.category, body: input.text.trim(), image: input.image, context: input.context,
  });
  void notifyAdmins(`${user?.cohort ? `${user.cohort}기 ` : ""}${user?.name || "수강생"} · ${input.category}`, input.context.title || input.context.path).catch(() => undefined);
  return { id };
}

/** 관리자(ADMIN_EMAILS) 기기로 한 줄 알림. 기기가 없거나 푸시 설정이 없으면 조용히 건너뛴다. */
async function notifyAdmins(title: string, where: string): Promise<void> {
  if (!pushConfigured()) return;
  for (const admin of adminEmails()) {
    for (const sub of await listActiveSubscriptions(admin)) {
      const r = await sendPush(sub, { title: `🐞 오류신고 · ${title}`, body: where ? `화면: ${where}` : "새 오류신고가 들어왔어요", url: "/admin", d: null }, { ttlSeconds: 86_400, topic: "bug-report" });
      await recordSendResult(sub.id, r.ok, !r.ok && r.gone).catch(() => undefined);
    }
  }
}

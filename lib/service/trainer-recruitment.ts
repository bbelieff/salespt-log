/** Recruitment uses the real session only; never getActiveUserEmail/impersonation. */
import { findUserByEmail } from "@/repo/users";
import { adminNames } from "@/config";
import { z } from "zod";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { applyForTrainer, createTrainerInvite, acceptTrainerInvite, changeTrainerQualification, revokeTrainerInvite, listTrainerInvites, setQualificationDepartment, setAdminQualificationDepartment } from "@/repo/db/trainer-recruitment";
export class RecruitmentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const Email = z.string().trim().email().max(254).transform((s) => s.toLowerCase());
const Name = z.string().trim().min(1).max(100);
const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), name: Name }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("department"), email: Email, department: z.enum(["T", "관리"]) }),
  z.object({ action: z.literal("accept"), name: Name, token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  z.object({ action: z.literal("invite"), email: Email }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }),
  z.object({ action: z.literal("list") }),
  ...(["approve", "reject", "remove"] as const).map((action) => z.object({ action: z.literal(action), email: Email })),
]);
export function recruitmentWriteAllowed(req: Request): boolean {
  try {
    const expected = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL ||
      (process.env.NODE_ENV === "production" ? "https://salesptlog.online" : req.url));
    return ["https:", "http:"].includes(expected.protocol) && req.headers.get("origin") === expected.origin &&
      req.headers.get("sec-fetch-site") !== "cross-site" && req.headers.get("content-type")?.split(";")[0] === "application/json";
  } catch { return false; }
}
export async function recruitmentAction(raw: unknown) {
  const email = await getSessionEmail();
  if (!email) throw new RecruitmentError(401, "로그인이 필요합니다.");
  const action = raw && typeof raw === "object" && "action" in raw ? raw.action : null;
  if (action !== "apply" && action !== "accept" && action !== "cancel" && !isAdminEmail(email)) throw new RecruitmentError(403, "관리자만 사용할 수 있습니다.");
  const parsed = Input.safeParse(raw);
  if (!parsed.success) throw new RecruitmentError(400, "입력을 확인해 주세요.");
  const input = parsed.data;
  try {
    switch (input.action) {
      case "cancel": await changeTrainerQualification(email,"cancel",email); return { status: "cancelled" };
      case "department":
        if (isAdminEmail(input.email)) {
          const user = await findUserByEmail(input.email);
          await setAdminQualificationDepartment(input.email, user?.name || adminNames()[input.email] || input.email.split("@")[0]!, input.department, email);
        } else await setQualificationDepartment(input.email,input.department,email);
        return { updated:true };
      case "remove":
        if (!isAdminEmail(input.email)) await changeTrainerQualification(input.email,"remove",email);
        // Qualification-only revocation: never rewrite enrollment assignments by email.
        // Multiple cohorts/aliases may have different trainers. Dormant assignments grant
        // no access because every authorization path rechecks the active qualification.
        return {updated:true};
      case "apply": return await applyForTrainer(email, input.name);
      case "accept": return await acceptTrainerInvite(input.token, email, input.name);
      case "invite": return await createTrainerInvite(email, input.email);
      case "revoke": await revokeTrainerInvite(input.id, email); return { revoked: true };
      case "list": return { invitations: await listTrainerInvites() };
      default: await changeTrainerQualification(input.email, input.action, email); return { updated: true };
    }
  } catch (error) {
    // Never expose driver errors, SQL parameters, invite token or recipient details.
    if (error instanceof Error && ["invalid_invitation", "invalid_transition"].includes(error.message))
      throw new RecruitmentError(409, "이미 처리되었거나 만료·취소된 요청입니다. 초대 계정도 확인해 주세요.");
    throw new RecruitmentError(503, "지금 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

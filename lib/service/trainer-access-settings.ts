import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listTrainerAccessRows, withTrainerAccessLock } from "@/repo/db/trainer-access-settings";
import { TrainerAccessCommand, TrainerAccessValue, TrainerAccountKey } from "@/types/trainer-access";
import type { TrainerAccessPerson, TrainerAccessQualification, TrainerAccessSetting } from "@/types/trainer-access";
import { defaultTrainerGrants } from "@/util/trainer-access-policy";

const messages = {
  400: "등급과 조회·수정 권한을 확인해 주세요.",
  403: "관리자와 활성 트레이너 자격을 확인해 주세요.",
  409: "다른 변경사항이 먼저 저장되었습니다. 최신 권한을 다시 확인해 주세요.",
  503: "권한 설정을 불러오거나 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const;
export class TrainerAccessError extends Error {
  constructor(public status: keyof typeof messages) { super(messages[status]); }
}
export async function requireTrainerAccessAdmin(): Promise<string> {
  try {
    const email = await getSessionEmail();
    if (!email || !isAdminEmail(email)) throw new TrainerAccessError(403);
    const actor = email.trim().toLowerCase();
    if (!TrainerAccountKey.safeParse(actor).success) throw new TrainerAccessError(403);
    return actor;
  } catch (error) { throw safeError(error); }
}
function safeError(error: unknown): TrainerAccessError {
  return error instanceof TrainerAccessError ? error : new TrainerAccessError(503);
}
function validateQualification(q: TrainerAccessQualification): void {
  if (!TrainerAccountKey.safeParse(q.email).success || typeof q.name !== "string"
    || !q.name.trim() || q.name.length > 100
    || !["active", "pending", "rejected", "revoked", "cancelled"].includes(q.status)) throw new TrainerAccessError(503);
}
function validateSetting(setting: TrainerAccessSetting | null): void {
  if (setting && (!TrainerAccessValue.safeParse({ grade: setting.grade, grants: setting.grants }).success
    || !Number.isInteger(setting.version) || setting.version < 1 || setting.version > 2147483646)) throw new TrainerAccessError(503);
}
export async function listTrainerAccessSettings(): Promise<TrainerAccessPerson[]> {
  await requireTrainerAccessAdmin();
  try {
    const rows = await listTrainerAccessRows();
    const keys = new Set<string>();
    return rows.flatMap(({ qualification: q, setting }) => {
      validateQualification(q);
      if (keys.has(q.email)) throw new TrainerAccessError(503);
      keys.add(q.email);
      if (q.status !== "active") return [];
      validateSetting(setting);
      return [{ ...q, grade: setting?.grade ?? null, grants: setting?.grants ?? defaultTrainerGrants(null), version: setting?.version ?? 0 }];
    });
  } catch (error) { throw safeError(error); }
}
/** Public service entry authenticates itself, even when invoked outside the route. */
export async function saveTrainerAccessSettings(raw: unknown): Promise<void> {
  const actor = await requireTrainerAccessAdmin();
  const parsed = TrainerAccessCommand.safeParse(raw);
  if (!parsed.success) throw new TrainerAccessError(400);
  const input = parsed.data;
  try {
    await withTrainerAccessLock(input.email, async tx => {
      if (!tx.qualification) throw new TrainerAccessError(403);
      if (tx.qualification.status !== "active") throw new TrainerAccessError(403);
      validateQualification(tx.qualification);
      if (tx.qualification.email !== input.email) throw new TrainerAccessError(503);
      const current = await tx.read();
      validateSetting(current);
      if ((current?.version ?? 0) !== input.version) throw new TrainerAccessError(409);
      // Changing grade always resets; restricted grants can be saved on the next edit.
      const grants = current?.grade === input.grade ? input.grants : defaultTrainerGrants(input.grade);
      if (!await tx.save({ ...input, grants }, actor)) throw new TrainerAccessError(409);
    });
  } catch (error) { throw safeError(error); }
}

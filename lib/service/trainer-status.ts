import {
  getSessionEmail,
  isAdminEmail,
  resolveStudentViewContext,
} from "@/auth/identity";
import { findUserByEmail, findTrainerByEmail } from "@/repo/users";
import { listTrainerQualifications } from "@/repo/db/trainer-recruitment";
import { auth } from "@/auth";

/** Real-account capability and application state. Never use an impersonated student. */
export async function trainerStatus() {
  const email = await getSessionEmail();
  if (!email) return null;
  const [user,trainer,qualification,session] = await Promise.all([
    findUserByEmail(email), findTrainerByEmail(email), listTrainerQualifications(email), auth(),
  ]);
  const [currentContext, selfContext] = await Promise.all([
    resolveStudentViewContext(),
    resolveStudentViewContext({ selfViewRequested: true, ignoreTarget: true }),
  ]);
  const canStudent =
    selfContext.ok && (selfContext.mode === "own" || selfContext.mode === "arena");
  return {
    email, name: user?.name || trainer?.name || session?.user?.name || "",
    status: qualification[0]?.status ?? trainer?.status ?? "none",
    canStudent,
    canTrainer: trainer?.status === "active",
    isAdmin: isAdminEmail(email),
    impersonating: currentContext.ok && currentContext.mode === "assigned",
  };
}

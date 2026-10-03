import { getSessionEmail, getActiveUserEmail, isAdminEmail } from "@/auth/identity";
import { findUserByEmail, findTrainerByEmail } from "@/repo/users";
import { resolveOwnArenaSheetId } from "@/repo/users-arena";
import { listTrainerQualifications } from "@/repo/db/trainer-recruitment";
import { auth } from "@/auth";

/** Real-account capability and application state. Never use an impersonated student. */
export async function trainerStatus() {
  const email = await getSessionEmail();
  if (!email) return null;
  const [user,trainer,qualification,session] = await Promise.all([
    findUserByEmail(email), findTrainerByEmail(email), listTrainerQualifications(email), auth(),
  ]);
  const ownStudent = user?.role === "trainee" && user.status !== "pending";
  const legacyArena = !ownStudent && trainer?.status === "active" ? !!(await resolveOwnArenaSheetId(email,trainer.name)) : false;
  return {
    email, name: user?.name || trainer?.name || session?.user?.name || "",
    status: qualification[0]?.status ?? trainer?.status ?? "none",
    canStudent: !!ownStudent || legacyArena,
    canTrainer: trainer?.status === "active",
    isAdmin: isAdminEmail(email),
    impersonating: (await getActiveUserEmail()).toLowerCase() !== email.toLowerCase(),
  };
}

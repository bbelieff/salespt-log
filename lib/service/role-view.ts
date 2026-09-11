import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionEmail, setArenaSelfView, setImpersonation, getActiveUserEmail } from "@/auth/identity";
import { trainerStatus } from "./trainer-status";
import { RecruitmentError } from "./trainer-recruitment";
import { parseViewMemory, safeRolePath, type ViewRole } from "@/util/role-view";
const cookieName = (email: string) => "salespt_view_" + createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0,16);
export async function restoreRolePath(email: string): Promise<string | null> {
  const memory = parseViewMemory((await cookies()).get(cookieName(email))?.value);
  if (!memory) return null;
  const state = await trainerStatus();
  if (!state || (memory.role === "trainer" ? !state.canTrainer : !state.canStudent)) return null;
  if ((await getActiveUserEmail()).toLowerCase() !== email.toLowerCase()) return state.canTrainer ? "/trainer" : null;
  return memory[memory.role] ?? (memory.role === "student" ? "/dashboard" : "/trainer");
}
export async function changeRoleView(raw: unknown) {
  const email = await getSessionEmail();
  if (!email) throw new RecruitmentError(401,"로그인이 필요합니다.");
  if (!raw || typeof raw !== "object" || !("role" in raw) || !["student","trainer"].includes(String(raw.role))) throw new RecruitmentError(400,"화면을 확인해 주세요.");
  const input = raw as {role:ViewRole;path?:unknown;switch?:unknown};
  const state = await trainerStatus();
  if (!state || (input.role === "trainer" ? !state.canTrainer : !state.canStudent)) throw new RecruitmentError(403,"이 화면을 사용할 수 없습니다.");
  // Background page tracking never records another student's view.
  if (state.impersonating && input.switch !== true) return {remembered:false};
  const jar = await cookies();
  const name = cookieName(email);
  const memory = parseViewMemory(jar.get(name)?.value) ?? {role:input.role};
  const path = safeRolePath(input.role,input.path);
  if (input.switch !== true && !path) throw new RecruitmentError(400,"저장할 수 없는 화면입니다.");
  if (path) memory[input.role] = path;
  memory.role = input.role;
  if (input.switch === true) {
    await setImpersonation(null);
    await setArenaSelfView(input.role === "student");
  }
  jar.set(name,JSON.stringify(memory),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV === "production",path:"/",maxAge:60*60*24*30});
  return {destination:memory[input.role] ?? (input.role === "student" ? "/dashboard" : "/trainer")};
}

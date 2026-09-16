import { recruitmentAction, recruitmentWriteAllowed, RecruitmentError } from "./trainer-recruitment";
import { revalidateAdminPages } from "@/auth/revalidate-admin";
/** Legacy admin UI adapter: mutations affect qualification only, never delete a registry row. */
export async function trainerAdminRequest(req: Request, action: "approve" | "reject" | "remove" | "department") {
  if (!recruitmentWriteAllowed(req)) throw new RecruitmentError(403,"요청 출처를 확인해 주세요.");
  const text = await req.text();
  if (text.length > 2048) throw new RecruitmentError(400,"입력을 확인해 주세요.");
  const body = JSON.parse(text);
  const result = await recruitmentAction({ action, email: body.email,
    ...(action === "department" ? {department:body.department === "trainer" ? "T" : body.department === "management" ? "관리" : ""} : {}),
  });
  revalidateAdminPages();
  return result;
}

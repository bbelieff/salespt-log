/**
 * Layer: service — 관리자가 사전등록 줄에 이메일을 직접 연결(2026-11-06 belie).
 *
 * 원래는 본인이 로그인해 /claim 에서 기수·이름을 넣어야 연결됐다. 0기 코스텝(트레이너 본인 페이지)처럼
 * 관리자가 대신 묶어야 할 때 쓴다. 쓰기는 클레임과 같은 claimRegistry(시트 + DB 미러) 한 길.
 * 이미 다른 수강생 줄로 쓰는 메일은 막는다(한 사람이 두 활성 수강생 화면을 갖지 않게).
 */
import { z } from "zod";
import { claimRegistry, findExistingSheetIdByCohortName, listAllUsers } from "@/repo/users";

export class PrepLinkError extends Error {}

const Email = z.string().trim().toLowerCase().email().max(254);

export async function linkPrepEmail(input: { cohort: string; name: string; email: string }): Promise<{ email: string; cohort: string; name: string; spreadsheetId: string }> {
  const cohort = String(input.cohort).replace(/기\s*$/, "").trim();
  const name = String(input.name).trim();
  const parsed = Email.safeParse(input.email);
  if (!cohort || !name) throw new PrepLinkError("기수와 이름을 넣어 주세요.");
  if (!parsed.success) throw new PrepLinkError("이메일 형식을 확인해 주세요.");
  const email = parsed.data;
  const spreadsheetId = await findExistingSheetIdByCohortName(cohort, name);
  if (!spreadsheetId) throw new PrepLinkError(`${cohort}기 ${name} 사전등록 줄을 찾지 못했어요. 먼저 사전 등록해 주세요.`);
  const other = (await listAllUsers()).find(u =>
    u.email.toLowerCase() === email && u.role === "trainee" && u.status !== "archived" &&
    !(String(u.cohort).replace(/기\s*$/, "").trim() === cohort && u.name.trim() === name));
  if (other) throw new PrepLinkError(`이 메일은 이미 ${other.cohort}기 ${other.name} 수강생 화면으로 쓰고 있어요.`);
  await claimRegistry(email, cohort, name, spreadsheetId, "trainee", "active");
  return { email, cohort, name, spreadsheetId };
}

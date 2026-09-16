import { redirect } from "next/navigation";
import { getSessionEmail, getEffectiveRole } from "@/auth/identity";
import WeeklyGoalPage from "@/components/weekly-goals/WeeklyGoalPage";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const email = await getSessionEmail();
  if (!email) redirect("/");
  const { role, status } = await getEffectiveRole(email);
  if (status === "pending" || (role === "trainer" && status !== "active")) redirect("/");
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  return <WeeklyGoalPage student={value("student")} date={value("date")} week={value("week")} returnTo={value("returnTo")} trainer={role === "trainer" || role === "admin"} />;
}

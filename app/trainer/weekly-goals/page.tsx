import { redirect } from "next/navigation";
import { getSessionEmail, getEffectiveRole } from "@/auth/identity";
import TrainerGoalOverview from "@/components/weekly-goals/TrainerGoalOverview";
export const dynamic = "force-dynamic";
export default async function Page() {
  const email = await getSessionEmail();
  if (!email) redirect("/");
  const { role, status } = await getEffectiveRole(email);
  if (role !== "admin" && !(role === "trainer" && status === "active")) redirect("/");
  return <TrainerGoalOverview />;
}

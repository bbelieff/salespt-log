import { getSessionEmail } from "@/auth/identity";
import LoginScene from "@/components/auth/LoginScene";
import TrainerApplication from "@/components/auth/TrainerApplication";
export const dynamic = "force-dynamic";
export default async function TrainerApplyPage() {
  if (!(await getSessionEmail())) return <LoginScene returnTo="/trainer/apply" />;
  return <TrainerApplication />;
}

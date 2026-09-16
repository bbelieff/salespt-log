import { getSessionEmail } from "@/auth/identity";
import TrainerInvitationEntry from "@/components/auth/TrainerInvitationEntry";
export const dynamic = "force-dynamic";
export const metadata = {referrer:"no-referrer"};
export default async function TrainerInvitePage() {
  return <TrainerInvitationEntry signedIn={!!(await getSessionEmail())} />;
}

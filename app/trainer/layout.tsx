import { getSessionEmail } from "@/auth/identity";
import TopHeader from "@/components/TopHeader";
import DirtyProvider from "@/components/DirtyGuard";
export default async function TrainerLayout({children}:{children:React.ReactNode}) {
  if (!(await getSessionEmail())) return children;
  return <DirtyProvider><TopHeader pageEmoji="" pageTitle="트레이너" />{children}</DirtyProvider>;
}

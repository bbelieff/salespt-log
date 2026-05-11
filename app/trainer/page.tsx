/**
 * /trainer — 트레이너 랜딩.
 * 본인 정보 + 마스터 시트 링크 + 담당 수강생 목록 (impersonation 진입점).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionEmail, getEffectiveRole, isAdminEmail } from "@/auth/identity";
import { findUserByEmail, listTraineesForTrainer } from "@/repo/users";
import { registry } from "@/config";
import TrainerLanding from "@/components/auth/TrainerLanding";

export default async function TrainerPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect("/");

  const { role, status } = await getEffectiveRole(sessionEmail);

  if (role === "admin") redirect("/admin");
  if (role !== "trainer") redirect("/");
  if (status === "pending") {
    return (
      <main className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-2">승인 대기 중</h1>
          <p className="text-sm text-gray-500">
            관리자 승인 후 담당 수강생을 조회할 수 있습니다.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-gray-700 underline">홈으로</Link>
        </div>
      </main>
    );
  }

  const trainer = await findUserByEmail(sessionEmail);
  const trainees = await listTraineesForTrainer(sessionEmail);
  const masterSheetUrl = `https://docs.google.com/spreadsheets/d/${registry().spreadsheetId}/edit`;

  return (
    <TrainerLanding
      sessionEmail={sessionEmail}
      trainerName={trainer?.name ?? sessionEmail}
      trainees={trainees}
      masterSheetUrl={masterSheetUrl}
      isAdmin={isAdminEmail(sessionEmail)}
    />
  );
}

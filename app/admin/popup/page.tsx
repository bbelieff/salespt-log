/**
 * /admin/popup — 팝업관리 (announcement-popup §4, admin 전용).
 *
 * 상단: 공지 작성/수정 (MD 에디터 + 이미지 업로드 + 노출 옵션).
 * 하단: 배포 시 자동 수집된 업데이트 현황 (title_user/visible/milestone 보정).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAnnouncementsAdmin } from "@/service";
import NoticeManager from "./_components/NoticeManager";
import UpdatesManager from "./_components/UpdatesManager";

export const dynamic = "force-dynamic";

export default async function AdminPopupPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) redirect("/");

  const { notices, updates } = await listAnnouncementsAdmin();

  return (
    <div className="min-h-dvh bg-slate-100 pb-16">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-12 max-w-4xl items-center gap-3 px-4">
          <Link href="/admin" className="text-sm font-bold text-gray-400 hover:text-gray-700">
            ← 메뉴
          </Link>
          <h1 className="text-sm font-black text-gray-900">📢 팝업관리</h1>
          <span className="ml-auto text-xs text-gray-400">
            새소식 팝업 — 공지 작성·업데이트 문구 보정
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <NoticeManager initialNotices={notices} />
        <UpdatesManager initialUpdates={updates} />
      </main>
    </div>
  );
}

/**
 * /admin — Master 진입 랜딩 (3 카드 선택).
 *
 * Admin이 로그인하면 첫 도착지. 두 가지 흐름 + 트레이너 페이지 진입:
 *   1. 수강생 시트 보기 → /admin/users (AdminUserPicker)
 *   2. 트레이너 관리   → /admin/trainers (승인·거절·담당부여)
 *   3. 트레이너 페이지 → /trainer (마스터가 트레이너 경험으로 진입)
 *
 * 사용자가 수강생으로 등록된 admin 도 본인 시트 흐름은 TopHeader 의
 * 상시 상태바를 통해 이동 (별도 카드 X — 자기 시트는 보통 모드).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";

export default async function AdminLandingPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    redirect("/");
  }

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {sessionEmail}
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          마스터 메뉴
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          어떤 작업을 하시겠어요?
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/admin/users"
            className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
          >
            <div className="text-3xl">🗂️</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
              수강생 시트 보기
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              모든 등록 사용자 목록. 클릭하면 그 사람의 5탭 UI를 조회·편집.
            </div>
          </Link>

          <Link
            href="/admin/trainers"
            className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
          >
            <div className="text-3xl">👥</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
              트레이너 관리
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              요청 승인/거절, 수강생 담당 부여.
            </div>
          </Link>

          <Link
            href="/trainer"
            className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
          >
            <div className="text-3xl">📊</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
              트레이너 페이지
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              마스터 시트 + 내 담당 수강생(있다면).
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}

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
import {
  getSessionEmail,
  getActiveUserEmail,
  canViewAdminPages,
  isAdminEmail,
} from "@/auth/identity";
import { listPendingTrainees, listPendingTrainers } from "@/repo/users";
import { getDbPilotStatus } from "@/service";
import LogoutButton from "@/components/auth/LogoutButton";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) {
    redirect("/");
  }
  const isMaster = isAdminEmail(sessionEmail);
  const activeEmail = await getActiveUserEmail();
  const impersonating =
    activeEmail !== sessionEmail ? activeEmail : null;
  // 카드 우측 상단 알림 배지 — 진입 전에도 한눈에 보이게.
  // + DB 파일럿 상태(마스터 확인용, db-migration-pilot §3) — 실패해도 랜딩은 뜬다.
  const [pendingTrainees, pendingTrainers, dbStatus] = await Promise.all([
    listPendingTrainees(),
    listPendingTrainers(),
    getDbPilotStatus().catch(() => null),
  ]);

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              {isMaster ? "Master" : "관리부서"}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {sessionEmail}
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl pc:max-w-5xl px-6 py-10">
        {impersonating && <ImpersonationBanner impersonating={impersonating} />}

        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          {isMaster ? "마스터 메뉴" : "관리부서 메뉴"}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          {isMaster
            ? "어떤 작업을 할까요?"
            : "수강생 관리·트레이너 관리·기수 조회 가능 (변경 권한 X)."}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/admin/users"
            className="group relative rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
          >
            {pendingTrainees.length > 0 && (
              <span className="absolute right-4 top-4 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                ⏳ 승인 대기 {pendingTrainees.length}
              </span>
            )}
            <div className="text-3xl">🗂️</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
              수강생 관리
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              등록 수강생 현황 — 담당 트레이너·시작일·종강일 + 시트 진입.
            </div>
          </Link>

          <Link
            href="/admin/trainers"
            className="group relative rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
          >
            {pendingTrainers.length > 0 && (
              <span className="absolute right-4 top-4 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                ⏳ 승인 대기 {pendingTrainers.length}
              </span>
            )}
            <div className="text-3xl">👥</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
              트레이너 관리
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              요청 승인/거절, 수강생 담당 부여.
            </div>
          </Link>

          <Link
            href="/admin/cohorts"
            className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
          >
            <div className="text-3xl">📅</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
              기수 관리
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              기수별 활성/보관 토글. 보관 기수도 언제든 열어볼 수 있습니다.
            </div>
          </Link>

          <Link
            href="/admin/arena"
            className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-purple-300 hover:shadow-lg"
          >
            <div className="text-3xl">🏆</div>
            <div className="mt-4 text-base font-black text-gray-900 group-hover:text-purple-600">
              아레나 관리
            </div>
            <div className="mt-1 text-xs text-gray-500 leading-relaxed">
              회장(기수임원) 지정 + 기수별 전광판(주차 평균).
            </div>
          </Link>

          {/* 팝업관리 — 마스터만 (공지 작성 + 업데이트 문구 보정, announcement-popup §4). */}
          {isMaster && (
            <Link
              href="/admin/popup"
              className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-lg"
            >
              <div className="text-3xl">📢</div>
              <div className="mt-4 text-base font-black text-gray-900 group-hover:text-red-600">
                팝업관리
              </div>
              <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                새소식 팝업 — 공지 작성(MD·이미지·노출 옵션) + 업데이트 문구 보정.
              </div>
            </Link>
          )}

          {/* 트레이너 페이지 — 마스터만 (관리부서는 본인 트레이너 페이지 따로). */}
          {isMaster && (
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
          )}
        </div>

        {/* DB 파일럿 연결 상태 — 마스터 전용 진단 스트립 (db-migration-pilot §3).
            운영자가 "DB 연결 OK" 를 화면에서 확인하는 용도. 미설정 시 회색 안내만. */}
        {isMaster && dbStatus && (
          <div
            className={`mt-6 flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${
              !dbStatus.enabled
                ? "border-gray-200 bg-gray-50 text-gray-500"
                : dbStatus.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <span className="text-base">🗄️</span>
            <span className="font-black">DB 파일럿</span>
            {!dbStatus.enabled && <span>미설정 (DATABASE_URL 없음 — 파일럿 전 정상)</span>}
            {dbStatus.enabled && dbStatus.ok && (
              <span>
                연결 OK · 응답 {dbStatus.latencyMs}ms · 기록 {dbStatus.rows ?? 0}행
              </span>
            )}
            {dbStatus.enabled && !dbStatus.ok && (
              <span>연결 실패 — {dbStatus.error ?? "unknown"}</span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

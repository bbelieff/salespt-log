/**
 * /admin/settings — 설정(admin-phase1, 2026-11-16). 마스터 전용.
 *
 * 지금은 「진단」 한 구역뿐이고 기본으로 접혀 있다 — 시트에서 DB 로 옮기던 때의 점검 도구를 모았다:
 *   · 시스템 상태(예전 홈의 「DB 파일럿」 띠)
 *   · 시트·DB 행수 대조(/admin/db-parity)
 *   · 동기화(예전 수강생 관리 머리줄의 MigrateCacheButton)
 * 도구의 동작·API 는 그대로다. 자리만 옮겼다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { getDbPilotStatus } from "@/service";
import CollapsibleSection from "@/components/auth/CollapsibleSection";
import MigrateCacheButton from "@/components/auth/MigrateCacheButton";
import SystemStatusStrip from "@/components/auth/SystemStatusStrip";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) redirect("/");
  // 상태 읽기 실패가 설정 화면을 막지 않는다.
  const status = await getDbPilotStatus().catch(() => null);

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-8 pc:max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">설정</h1>
            <p className="mt-1.5 text-sm text-slate-500">평소엔 쓸 일이 없는 점검 도구예요.</p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 pc:hidden"
          >
            ← 메뉴
          </Link>
        </div>

        <CollapsibleSection title="진단" persistKey="admin-settings:diagnostics">
          <div className="divide-y divide-slate-100 px-4 pb-2">
            <div className="py-3">
              <h2 className="text-sm font-bold text-slate-900">시스템 상태</h2>
              <div className="mt-2">
                {status ? (
                  <SystemStatusStrip status={status} />
                ) : (
                  <p className="text-xs text-slate-500">상태를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">시트·DB 행수 대조</h2>
                <p className="mt-0.5 text-xs text-slate-500">기수·탭별로 시트와 DB 의 행 수를 견줘요. 여는 데 시간이 걸려요.</p>
              </div>
              <Link
                href="/admin/db-parity"
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                대조 표 열기 →
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">수강생 표시 정보 동기화</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  기수·이름·시작일·종강일 표시가 비어 있는 수강생만 시트에서 다시 불러와요.
                </p>
              </div>
              <MigrateCacheButton />
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </main>
  );
}

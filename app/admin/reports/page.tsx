/**
 * /admin/reports — 오류 신고함(admin-phase1, 2026-11-16). 읽기 전용.
 *
 * 수강생이 「오류신고」로 보낸 건을 최신순으로 20건씩 보여 준다: 시각 · 보낸 사람 · 보던 화면 · 내용 · 상태 · 캡처.
 * 볼 수 있는 사람 = 마스터 + 관리부서(레이아웃·여기·service 세 곳에서 확인). 상태를 바꾸는 기능은 아직 없다.
 * 캡처는 무거워 목록에 싣지 않고 「캡처 보기」(?open=<id>)를 눌렀을 때 그 한 장만 읽는다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import { getBugReportImageForAdmin, listBugReportsForAdmin } from "@/service/bug-reports-admin";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { new: "새 신고", checking: "확인 중", done: "처리함" };
const WHEN = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; open?: string }>;
}) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");
  const sp = await searchParams;
  const list = await listBugReportsForAdmin(sessionEmail, Number(sp.page) || 1);
  const open = sp.open ? list.rows.find((r) => r.id === sp.open && r.hasImage) : undefined;
  const image = open ? await getBugReportImageForAdmin(sessionEmail, open.id) : null;
  const hrefOf = (page: number, openId?: string) =>
    `/admin/reports?page=${page}${openId ? `&open=${encodeURIComponent(openId)}` : ""}`;

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-8 pc:max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">오류 신고함</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {list.enabled ? `모두 ${list.total.toLocaleString("ko-KR")}건 · 최신순` : "DB 가 연결되지 않아 목록을 볼 수 없어요."}
            </p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 pc:hidden"
          >
            ← 메뉴
          </Link>
        </div>

        {open && (
          <section aria-label="캡처" className="surface-panel">
            <div className="section-head">
              <span className="min-w-0 flex-1 truncate">
                캡처 — {open.name || open.email} · {WHEN.format(new Date(open.createdAt))}
              </span>
              <Link href={hrefOf(list.page)} className="shrink-0 text-xs font-bold text-slate-500 hover:text-slate-900">
                닫기
              </Link>
            </div>
            {image ? (
              // 신고에 붙은 화면 한 장(data URL) — next/image 최적화 대상이 아니다.
              <img src={image} alt="신고에 붙은 화면 캡처" className="mt-3 max-h-screen w-full rounded-lg border border-slate-200 object-contain" />
            ) : (
              <p className="mt-3 text-sm text-slate-500">캡처를 불러오지 못했어요.</p>
            )}
          </section>
        )}

        <section aria-label="신고 목록" className="surface-panel">
          {list.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">들어온 신고가 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.rows.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <time dateTime={r.createdAt} className="font-bold tabular-nums text-slate-700">
                      {WHEN.format(new Date(r.createdAt))}
                    </time>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">{r.category}</span>
                    <span className={r.status === "new" ? "font-bold text-red-600" : ""}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  <div className="mt-1 min-w-0 text-sm">
                    <span className="font-bold text-slate-900">
                      {r.cohort ? `${r.cohort}기 ` : ""}
                      {r.name || "이름 없음"}
                    </span>{" "}
                    <span className="break-all text-xs text-slate-400">{r.email}</span>
                  </div>
                  {(r.pageTitle || r.pagePath) && (
                    <div className="mt-0.5 break-all text-xs text-slate-500">
                      화면: {r.pageTitle}
                      {r.pageTitle && r.pagePath ? " · " : ""}
                      {r.pagePath}
                    </div>
                  )}
                  {r.body && (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-800">{r.body}</p>
                  )}
                  {r.errors.length > 0 && (
                    <details className="mt-1.5 text-xs text-slate-500">
                      <summary className="cursor-pointer font-bold">그때 난 오류 {r.errors.length}개</summary>
                      <ul className="mt-1 space-y-0.5">
                        {r.errors.map((e, i) => (
                          <li key={i} className="break-all">{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {r.hasImage && (
                    <Link
                      href={hrefOf(list.page, r.id)}
                      className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-blue-700 hover:underline"
                    >
                      캡처 보기 →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {list.pageCount > 1 && (
          <nav aria-label="쪽 이동" className="flex items-center justify-between text-sm font-bold">
            {list.page > 1 ? (
              <Link href={hrefOf(list.page - 1)} className="text-slate-700 hover:text-red-600">← 최신</Link>
            ) : (
              <span />
            )}
            <span className="tabular-nums text-slate-500">
              {list.page} / {list.pageCount}
            </span>
            {list.page < list.pageCount ? (
              <Link href={hrefOf(list.page + 1)} className="text-slate-700 hover:text-red-600">이전 →</Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  );
}

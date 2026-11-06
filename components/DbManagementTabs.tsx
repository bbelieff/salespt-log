"use client";
/**
 * STEP 2 DB관리 탭 — [DB 목록 | 일별 기록](2026-11-07 belie 「1.5·2 통합: DB관리 = DB 목록 + 일별 기록」).
 * 화면 위 띠(TopHeader pageNavigation)에 들어간다. 주소는 그대로: DB 목록 = /db-sheet, 일별 기록 = /contact.
 * 이동은 미저장 확인(DirtyGuard)을 거친다 — 저장 안 된 숫자·DB 변경이 있으면 먼저 묻는다.
 */
import Link from "next/link";
import type { Route } from "next";
import { useGuardedRouter } from "@/components/DirtyGuard";

const TABS = [
  { href: "/db-sheet", label: "DB 목록" },
  { href: "/contact", label: "일별 기록" },
] as const;

export default function DbManagementTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  const router = useGuardedRouter();
  return (
    <nav aria-label="DB관리 메뉴" data-db-management-tabs className="ml-3 flex items-stretch self-stretch">
      {TABS.map((t) => {
        const on = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={on ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              if (!on) router.push(t.href);
            }}
            className={`flex items-center whitespace-nowrap border-b-2 px-2 text-xs font-semibold focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 sm:px-2.5 ${on ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

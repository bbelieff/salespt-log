"use client";
/**
 * 우하단 「오늘 챙길 일」 빠른 보기 — 로그인 후 화면 공통(대시보드는 카드가 있어 제외, belie 2026-10-23).
 * 대시보드 카드와 같은 조회(useTodayFollowUps)·같은 캐시를 쓴다. 새 API 없음.
 * 화면 자체의 첫 조회가 끝난 뒤(전역 fetching 0) 시작하고, 보조 조회로 표시해 전역 로딩 팝업을 띄우지 않는다.
 */
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { todayKST } from "@/util/week";
import FollowUpsLauncherView from "./FollowUpsLauncherView";
import { useTodayFollowUps } from "./useTodayFollowUps";
import { useGrantMatches } from "@/query/grant-match-hooks";
import { useAllTodos } from "@/query/todos-hooks";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { grantInbox, withoutTaken } from "@/lib/analytics/grant-match";
import { grantIdOfTodo, isGrantTodo } from "@/lib/analytics/todo-slot";
import { contractRef, normalizeContractRef } from "@/util/contract-ref";

const START_DELAY_MS = 300;

export default function FollowUpsLauncher() {
  const pathname = usePathname() ?? "";
  if (pathname === "/" || pathname.startsWith("/dashboard")) return null;
  return <LauncherData />;
}

function LauncherData() {
  const [today] = useState(() => todayKST());
  const fetching = useIsFetching();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || fetching > 0) return;
    const timer = setTimeout(() => setReady(true), START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [fetching, ready]);
  const { summary, loading, anyFailure, retry } = useTodayFollowUps(today, { enabled: ready, background: true });
  // 맞춤공고 4d — 「새 공고」 칸: 아직 담지 않은 맞는 공고. 담으면 할 일이 되어 「챙길 일」로 옮겨 간다.
  const grants = useGrantMatches({ enabled: ready }).data;
  const todos = useAllTodos({ enabled: ready, background: true }).data?.todos;
  const rows = useContractPayments({ enabled: ready, background: true }).data?.rows;
  const grantItems = useMemo(() => {
    if (!grants || grants.unavailable) return undefined;
    const taken = new Map<string, Set<string>>();
    for (const t of todos ?? []) if (isGrantTodo(t)) {
      const ref = normalizeContractRef(t.contractRef);
      taken.set(ref, (taken.get(ref) ?? new Set()).add(grantIdOfTodo(t)));
    }
    const rowOf = new Map((rows ?? []).map((cp) => [contractRef(cp.계약일, cp.업체명), cp.row]));
    return grantInbox(withoutTaken(grants, taken)).map((g) => ({ ...g, href: rowOf.get(g.ref) != null ? `/payment?row=${rowOf.get(g.ref)}` : "/payment" }));
  }, [grants, todos, rows]);
  return <FollowUpsLauncherView items={summary.items} loading={loading} incomplete={anyFailure} onRetry={retry} grantItems={grantItems} />;
}

"use client";
/**
 * 우하단 「오늘 챙길 일」 빠른 보기 — 로그인 후 화면 공통(대시보드는 카드가 있어 제외, belie 2026-10-23).
 * 대시보드 카드와 같은 조회(useTodayFollowUps)·같은 캐시를 쓴다. 새 API 없음.
 * 화면 자체의 첫 조회가 끝난 뒤(전역 fetching 0) 시작하고, 보조 조회로 표시해 전역 로딩 팝업을 띄우지 않는다.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { todayKST } from "@/util/week";
import FollowUpsLauncherView from "./FollowUpsLauncherView";
import { useTodayFollowUps } from "./useTodayFollowUps";

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
  return <FollowUpsLauncherView items={summary.items} loading={loading} incomplete={anyFailure} onRetry={retry} />;
}

import { useEffect } from "react";
import { CHANNEL_ORDER, type Channel } from "@/types";

/**
 * DB관리→컨택 교차탭 진입(2026-06-03 [교차탭1]): ?channel=&date=&focus= 를 파싱해
 * 초기 활성 채널·날짜·생산 강조를 설정한다. setter 는 useState 안정 참조라 1회 실행.
 */
export function useCrossTabParams(opts: {
  setActiveChannel: (c: Channel) => void;
  setDate: (d: string) => void;
  setHighlightProduction: (v: boolean) => void;
}) {
  const { setActiveChannel, setDate, setHighlightProduction } = opts;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ch = params.get("channel");
    const d = params.get("date");
    const focus = params.get("focus");
    if (ch && (CHANNEL_ORDER as readonly string[]).includes(ch)) setActiveChannel(ch as Channel);
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
    if (focus === "production") {
      setHighlightProduction(true);
      const t = setTimeout(() => setHighlightProduction(false), 4000);
      return () => clearTimeout(t);
    }
  }, [setActiveChannel, setDate, setHighlightProduction]);
}

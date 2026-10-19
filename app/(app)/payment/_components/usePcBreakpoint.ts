"use client";
import {useEffect,useState} from "react";

/** 1280px 이상 작업판 분기. SSR/하이드레이션은 모바일 기준으로 시작. */
export default function usePcBreakpoint(): boolean {
  const [isPc, setIsPc] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsPc(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isPc;
}


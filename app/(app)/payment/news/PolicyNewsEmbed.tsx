"use client";

import { useEffect, useRef, useState } from "react";
import { POLICY_NEWS_ORIGIN, POLICY_NEWS_URL } from "@/config/links";

export const POLICY_NEWS_LOAD_TIMEOUT_MS = 10_000;

function isAllowedPolicyNewsUrl(src: string): boolean {
  try {
    const intended = new URL(POLICY_NEWS_URL);
    const candidate = new URL(src);
    return src === POLICY_NEWS_URL
      && candidate.href === intended.href
      && candidate.origin === POLICY_NEWS_ORIGIN
      && candidate.username === ""
      && candidate.password === ""
      && candidate.port === intended.port;
  } catch {
    return false;
  }
}

/** same-origin iframe가 실제 뉴스 문서를 그렸는지, 빈 frame이 아닌지 확인한다. */
export function isLoadedPolicyNewsDocument(doc: Document | null): boolean {
  if (!doc) return false;
  const text = doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const hasHeading = [...doc.querySelectorAll("h1")].some((node) => node.textContent?.includes("정책자금 데일리"));
  const hasCountHeading = [...doc.querySelectorAll("h2")].some((node) => node.textContent?.includes("성격별 건수"));
  return doc.title.includes("정책자금 데일리")
    && hasHeading
    && hasCountHeading
    && /\b20\d{2}[-./](?:0[1-9]|1[0-2])[-./](?:0[1-9]|[12]\d|3[01])\b/.test(text)
    && doc.querySelectorAll("article").length > 0
    && Boolean(doc.querySelector("article a[href]"))
    && text.length >= 40;
}

function OriginalLink({ src }: { src: string }) {
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
    >
      원문 새 창에서 열기
    </a>
  );
}

/** 정적 same-origin 정책자금 데일리만 최소 sandbox 권한으로 앱 안에 표시한다. */
export default function PolicyNewsEmbed({ src }: { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const allowed = isAllowedPolicyNewsUrl(src);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!allowed || state !== "loading") return;
    const timer = window.setTimeout(() => setState("error"), POLICY_NEWS_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [allowed, attempt, state]);

  const retry = () => {
    setState("loading");
    setAttempt((value) => value + 1);
  };

  const confirmLoadedNews = () => {
    setState(isLoadedPolicyNewsDocument(frameRef.current?.contentDocument ?? null) ? "ready" : "error");
  };

  if (!allowed) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="정책자금 뉴스 원문 안내">
        <p className="mb-3 text-sm text-amber-900">허용된 정책자금 뉴스 원문만 앱 안에서 표시할 수 있어요.</p>
        <OriginalLink src={src} />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="정책자금 데일리 실제 뉴스">
      <div className="flex min-h-10 items-center justify-between gap-2 px-2 text-xs text-slate-500" aria-live="polite">
        <span role="status">{state === "loading" ? "정책자금 뉴스를 불러오는 중…" : "앱 안에서 최신 뉴스를 보고 있어요."}</span>
        {state === "ready" && <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">실시간 원문</span>}
      </div>
      {state === "error" ? (
        <div className="flex min-h-[28rem] flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
          <p className="text-sm font-semibold text-slate-800">뉴스 화면을 불러오지 못했어요.</p>
          <p className="text-sm text-slate-500">다시 시도하거나 원문을 새 창에서 열어 확인할 수 있어요.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={retry} className="min-h-11 rounded-lg bg-brand-red px-4 text-sm font-bold text-white hover:bg-red-700">다시 시도</button>
            <OriginalLink src={src} />
          </div>
        </div>
      ) : (
        <iframe
          key={attempt}
          src={src}
          title="정책자금 데일리 실제 뉴스"
          className="h-[65dvh] min-h-[28rem] w-full rounded-lg border border-slate-100 bg-white pc:h-[calc(100dvh-13rem)]"
          loading="eager"
          sandbox="allow-same-origin"
          referrerPolicy="strict-origin-when-cross-origin"
          ref={frameRef}
          onLoad={confirmLoadedNews}
          onError={() => setState("error")}
        />
      )}
    </section>
  );
}

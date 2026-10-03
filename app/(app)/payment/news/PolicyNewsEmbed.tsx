"use client";

import { useEffect, useState } from "react";
import { POLICY_NEWS_ORIGIN, POLICY_NEWS_URL } from "@/config/links";

export const POLICY_NEWS_LOAD_TIMEOUT_MS = 10_000;
export const POLICY_NEWS_SANDBOX = "allow-scripts allow-popups";

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

function OriginalLink() {
  return (
    <a
      href={POLICY_NEWS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
    >
      원문 새 창에서 열기
    </a>
  );
}

/**
 * 공개 정책자금 원문을 고정 URL의 opaque-origin iframe으로만 표시한다.
 * 부모는 sandboxed child DOM을 읽을 수 없으므로 load event 이상의 준비 상태를 주장하지 않는다.
 */
export default function PolicyNewsEmbed({ src }: { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const allowed = isAllowedPolicyNewsUrl(src);

  useEffect(() => {
    if (!allowed || state !== "loading") return;
    const timer = window.setTimeout(() => setState("error"), POLICY_NEWS_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [allowed, attempt, state]);

  const retry = () => {
    setState("loading");
    setAttempt((value) => value + 1);
  };

  if (!allowed) {
    return (
      <section
        className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center pc:h-full pc:min-h-0 pc:overflow-y-auto"
        aria-label="정책자금 뉴스 원문 안내"
        role="alert"
      >
        <p className="text-sm font-bold text-amber-950">허용된 정책자금 뉴스 원문만 앱 안에서 표시할 수 있어요.</p>
        <div className="mt-4">
          <OriginalLink />
        </div>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm pc:h-full pc:min-h-0 pc:overflow-hidden"
      aria-label="정책자금 데일리 원문"
      data-policy-news-frame-state={state}
    >
      {state === "loading" && <span className="sr-only" role="status">정책자금 원문 프레임을 불러오는 중…</span>}

      {state === "error" ? (
        <div className="flex h-[65dvh] min-h-[28rem] flex-col items-center justify-center gap-3 p-6 text-center pc:h-full pc:min-h-0" role="alert">
          <p className="text-sm font-semibold text-slate-800">뉴스 원문 프레임을 불러오지 못했어요.</p>
          <p className="text-sm text-slate-500">다시 시도하거나 원문을 새 창에서 열어 확인할 수 있어요.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={retry} className="min-h-11 rounded-lg bg-brand-red px-4 text-sm font-bold text-white hover:bg-red-700">
              다시 시도
            </button>
            <OriginalLink />
          </div>
        </div>
      ) : (
        <iframe
          key={attempt}
          src={src}
          title="정책자금 데일리 원문"
          className="h-[65dvh] min-h-[28rem] w-full flex-1 rounded-lg border border-slate-100 bg-white pc:h-full pc:min-h-0 pc:max-h-none"
          loading="eager"
          sandbox={POLICY_NEWS_SANDBOX}
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </section>
  );
}

/**
 * MarkdownView — 공지/업데이트 MD 렌더 래퍼 (announcement-popup §3).
 *
 * 보안: react-markdown 은 rehype-raw 없이는 raw HTML 을 렌더하지 않고(태그는
 * 텍스트로 표시), 기본 urlTransform 이 javascript: 등 위험 프로토콜을 차단한다
 * → HTML 직접 입력 XSS 경로 자체가 없음 (SoR §0 "MD + sanitize" 충족).
 * 이미지는 MD 문법(![](url)) + Drive URL — max-w-full 로 모바일 우선.
 */
"use client";

import ReactMarkdown from "react-markdown";

export default function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-700">
      <ReactMarkdown
        components={{
          h1: (p) => <h3 className="text-base font-black text-gray-900">{p.children}</h3>,
          h2: (p) => <h4 className="text-sm font-black text-gray-900">{p.children}</h4>,
          h3: (p) => <h5 className="text-sm font-bold text-gray-900">{p.children}</h5>,
          p: (p) => <p>{p.children}</p>,
          ul: (p) => <ul className="list-disc space-y-1 pl-5">{p.children}</ul>,
          ol: (p) => <ol className="list-decimal space-y-1 pl-5">{p.children}</ol>,
          a: (p) => (
            <a
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-red underline"
            >
              {p.children}
            </a>
          ),
          // eslint-disable-next-line @next/next/no-img-element
          img: (p) => (
            <img
              src={p.src}
              alt={p.alt ?? ""}
              className="max-w-full rounded-lg border border-gray-100"
            />
          ),
          strong: (p) => <strong className="font-bold text-gray-900">{p.children}</strong>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

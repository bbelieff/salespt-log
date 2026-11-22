"use client";
/**
 * PC 사이드탭 맨 위 — 로고와 「12기 ○○○ 대표님」(2026-11-22 belie 확정 머리줄 정리).
 * 펼침: 로고 | 이름 · 새소식 점. 접힘: 앱 아이콘만(점은 아이콘 모서리) — 이름은 본문 배너로 간다(TopHeader .banner-identity).
 * 로고·아이콘을 누르면 계정 메뉴(로그아웃·새소식 등)가 그 아래에 열린다 — 메뉴 자체는 TopHeader 가 그린다.
 * 폰 서랍(1024px 미만)에서는 숨는다(서랍 머리는 기존 「경영일지」).
 */
import { useRef } from "react";
import { openAccountMenu, useHeaderIdentity } from "./header-identity";

export default function SideIdentity({ compact }: { compact: boolean }) {
  const id = useHeaderIdentity();
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) openAccountMenu(r);
  };
  return (
    <div className={`hidden min-w-0 items-center pc:flex ${compact ? "justify-center" : "flex-1 gap-2"}`}>
      <button ref={btnRef} type="button" onClick={open} aria-label="계정 메뉴 열기" title="계정 메뉴" className="relative flex shrink-0 items-center rounded-lg p-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500">
        {compact ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/icons/mark.svg" alt="세일즈PT" className="h-7 w-7 rounded-lg" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/salespt-logo.png" alt="세일즈PT" className="h-4 w-auto" />
        )}
        {compact && id.dotLabel && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-red" aria-label={id.dotLabel} />}
      </button>
      {!compact && id.display && (
        <>
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-slate-200" />
          {id.sheetHref ? (
            <a href={id.sheetHref} target="_blank" rel="noopener noreferrer" title={id.display} className="min-w-0 truncate text-sm font-black text-slate-900 hover:underline">{id.display}</a>
          ) : (
            <span title={id.display} className="min-w-0 truncate text-sm font-black text-slate-900">{id.display}</span>
          )}
          {id.dotLabel && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-red" aria-label={id.dotLabel} />}
        </>
      )}
    </div>
  );
}

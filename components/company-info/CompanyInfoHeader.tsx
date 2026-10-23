"use client";

import React, { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import DisclosureChevron from '@/components/ui/DisclosureChevron';
import { shouldTogglePaymentHeader } from './payment-header';
import './company-info-header.css';

interface Props {
  open: boolean;
  onToggle: () => void;
  controlsId: string;
  desktopHeading?: boolean;
  payment: boolean;
  summary: string;
  status?: ReactNode;
  tools: ReactNode;
  fontControl: ReactNode;
}

/** Presentation only. Callers retain real save, document, TXT, popup and preference callbacks. */
export default function CompanyInfoHeader({open, onToggle, controlsId, desktopHeading, payment, summary, status, tools, fontControl}: Props) {
  const heading = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(0);
  const [more, setMore] = useState(false);
  const actions = Children.toArray(tools);
  const available = width - (status ? 64 : 0);
  const mode = available >= 560 ? 'text' : available >= 350 ? 'icons' : 'more';
  useEffect(() => {
    if (!payment) return;
    const box = heading.current?.parentElement;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    observer.observe(box);
    return () => observer.disconnect();
  }, [payment]);
  useEffect(() => { if (!open || mode === 'text') setMore(false); }, [open, mode]);
  useEffect(() => {
    if (!more) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !heading.current?.contains(event.target)) setMore(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [more]);
  const closeMore = () => { setMore(false); moreButton.current?.focus(); };
  return <div ref={heading} data-company-info-header data-payment-ci-responsive={payment ? '' : undefined}
    className={`flex flex-wrap items-center gap-2 ${desktopHeading ? `payment-sticky-title bg-white px-3 py-2 ${open ? 'rounded-t-lg' : 'rounded-lg'}` : 'px-2.5 py-1.5'}`}
    onClick={payment ? event => { if (shouldTogglePaymentHeader(event.currentTarget, event.target)) onToggle(); } : undefined}
    onKeyDown={event => { if (more && event.key === 'Escape' && event.target instanceof Node && heading.current?.contains(event.target)) { event.stopPropagation(); closeMore(); } }}>
    <button type="button" onClick={onToggle} data-payment-ci-toggle={payment ? '' : undefined}
      aria-expanded={open} aria-label={`업체정보 ${open ? '접기' : '펼치기'}`} aria-controls={controlsId}
      className={`flex min-w-0 flex-1 items-center gap-1.5 ${desktopHeading ? 'text-sm' : 'text-xs'}`}>
      <span className={`truncate ${desktopHeading ? 'font-bold text-slate-800' : 'font-semibold text-gray-700'}`}>🏢 업체정보{' '}{!payment && <span className="font-normal text-gray-400">{summary}</span>}</span>
      <span data-payment-ci-fold={payment ? '' : undefined} aria-hidden="true" className="shrink-0 text-gray-400"><DisclosureChevron open={open} /></span>
    </button>
    <div data-company-info-header-actions className={`flex min-w-0 flex-wrap items-center gap-1.5 ${desktopHeading ? 'basis-full justify-end sm:basis-auto sm:flex-1' : 'shrink-0'}`}>
      {!payment ? <>{open && status}{open && actions}{fontControl}</> : open && <div data-ci-header-tools data-mode={mode}>
        {status && <span data-ci-header-status>{status}</span>}
        <div data-ci-tools-primary>{mode === 'more' ? actions.slice(0, 1) : actions}{mode === 'text' && fontControl}</div>
        {mode !== 'text' && <button ref={moreButton} type="button" data-ci-more aria-label="업체정보 더보기" title="업체정보 더보기" aria-expanded={more} aria-controls={`${controlsId}-tools`} aria-haspopup="dialog" onClick={() => setMore(value => !value)}>더보기</button>}
        {more && mode !== 'text' && <div id={`${controlsId}-tools`} role="dialog" aria-label="업체정보 도구" data-ci-tools-menu onClick={event => event.stopPropagation()}>
          <div className="text-xs font-semibold text-slate-600">업체정보 도구</div>
          {mode === 'more' && actions.slice(1)}
          <div className="text-xs text-slate-500">글자 크기</div>{fontControl}
          <button type="button" onClick={closeMore}>닫기</button>
        </div>}
      </div>}
    </div>
  </div>;
}

"use client";
/**
 * 주간 보드 창 — PC 는 누른 칸 옆에 뜨는 작은 창, 폰은 아래에서 올라오는 시트.
 * Esc·바깥 누르기·X 로 닫힌다. 창 크기가 바뀌면 다시 만들지 않고 위치만 옮긴다(2026-11-11 belie 「X가 잘 안 눌린다」).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export default function BoardPopover({ anchor, title, onClose, children, label, width = 320, glass = false }: {
  /** glass = 시안 v44 미팅 창 재질(.wb-pop). 폰 시트에서는 쓰지 않는다. */
  anchor: DOMRect | null; title: ReactNode; label: string; onClose: () => void; children: ReactNode; width?: number; glass?: boolean;
}) {
  const W = width;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sheet, setSheet] = useState(false);

  useLayoutEffect(() => {
    const panel = ref.current;
    const place = () => {
      const mobile = window.innerWidth < 1024;
      setSheet(mobile || !anchor);
      if (mobile || !anchor || !panel) return;
      const right = anchor.right + 8;
      const left = Math.max(8, right + W > window.innerWidth - 8 ? anchor.left - W - 8 : right);
      const top = Math.max(8, Math.min(anchor.top, window.innerHeight - panel.offsetHeight - 8));
      setPos((previous) => previous?.left === left && previous.top === top ? previous : { left, top });
    };
    place();
    if (!anchor || !panel) return;
    // 결과·편집 폼이 열려 창이 커지면 아래쪽 버튼이 화면 밖으로 나가지 않게 한다.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(panel);
    window.addEventListener("resize", place);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); };
  }, [anchor, W]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      // 창 안, 또는 창이 띄운 달력·확인 창(포털) 안을 누른 건 닫지 않는다.
      if (!t || ref.current?.contains(t) || t.closest("[role=dialog],[role=alertdialog],[data-board-keep]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown, true); };
  }, [onClose]);

  return (
    <>
      {sheet && <div aria-hidden="true" className="fixed inset-0 z-[70] bg-slate-900/30" />}
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        style={sheet ? undefined : { left: pos?.left ?? -9999, top: pos?.top ?? 0, width: W }}
        className={sheet
          ? "fixed inset-x-0 bottom-0 z-[71] max-h-[86dvh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl"
          : glass ? "wb-pop fixed z-[71] max-h-[calc(100dvh-16px)] overflow-y-auto"
            : "fixed z-[71] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl"}
      >
        {sheet && <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" />}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{title}</div>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 -mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </>
  );
}

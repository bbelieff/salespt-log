/**
 * HintTooltip — 라벨 옆 작은 (?) 버튼 + 설명 말풍선.
 *
 * - 마우스: 올리면 열리고 벗어나면 닫힘. 키보드: 포커스 시 열림, blur·Esc 로 닫힘.
 * - 터치/클릭: 누르면 고정 열림 ↔ 다시 누르거나 바깥을 누르면 닫힘.
 * - 한 번에 하나만 열린다(모듈 단일 활성 슬롯).
 * - 말풍선은 document.body 로 portal + fixed 좌표 → overflow hidden/auto 부모(실무수납
 *   상세패널·모바일 아코디언)에 잘리지 않는다. 가로는 화면 안(8px 여백)으로 clamp,
 *   아래 공간이 없으면 버튼 위로 뒤집는다. 스크롤·리사이즈 시 좌표를 다시 잡는다.
 */
"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const EDGE = 8;
const GAP = 6;
// 편집 모달(z-[300]) 위 — 모달 안 (?) 도 보이도록. Tailwind arbitrary 대신 inline style.
const TIP_Z = 350;

let closeActive: (() => void) | null = null;

interface Props {
  /** 필드 라벨 — 버튼 aria-label "<라벨> 설명 보기". */
  label: string;
  /** 말풍선 본문 (\n 은 줄바꿈으로 표시). */
  text: string;
}

export default function HintTooltip({ label, text }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const pinned = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = `${useId()}-hint`;

  const close = useCallback(() => {
    pinned.current = false;
    setOpen(false);
    setPos(null);
    if (closeActive === close) closeActive = null;
  }, []);

  const show = (pin: boolean) => {
    if (closeActive && closeActive !== close) closeActive();
    closeActive = close;
    if (pin) pinned.current = true;
    setOpen(true);
  };

  const place = useCallback(() => {
    const btn = btnRef.current;
    const tip = tipRef.current;
    if (!btn || !tip) return;
    const r = btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, vw - w - EDGE));
    let top = r.bottom + GAP;
    if (top + h > vh - EDGE && r.top - GAP - h >= EDGE) top = r.top - GAP - h;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onMove = () => place();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, close, place]);

  // 언마운트 시 활성 슬롯 정리.
  useEffect(() => () => {
    if (closeActive === close) closeActive = null;
  }, [close]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`${label} 설명 보기`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") show(false);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !pinned.current) close();
        }}
        onFocus={() => show(false)}
        onBlur={close}
        onClick={() => {
          if (open && pinned.current) close();
          else show(true);
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold leading-none text-slate-500 hover:border-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        ?
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, zIndex: TIP_Z }}
            className={`pointer-events-none fixed max-w-60 whitespace-pre-line break-keep rounded-md bg-slate-800 px-2 py-1.5 text-xs leading-snug text-white shadow-md ${pos ? "" : "invisible"}`}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

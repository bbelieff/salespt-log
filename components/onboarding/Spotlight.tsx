"use client";
/**
 * Spotlight — 화면 위 한 곳만 밝히고 나머지는 어둡게 까는 단계 안내(2026-11-11 첫걸음 1차).
 * 모양은 DB 추가 확인 화면 스포트라이트와 같은 음영(--ui-scrim). 음영은 누르기를 막지 않는다(pointer-events 없음).
 *
 * - 단계마다 `target`(CSS 선택자) 중 화면에 보이는 첫 요소를 밝힌다. 아직 없으면 생길 때까지 기다린다.
 * - 넘어가는 법: `click`(그 요소를 누르면) · `gone`(밝히던 요소가 사라지면 — 예: 미팅 카드 등록 완료) · `next`(「다음」).
 * - 다른 창(모달)이 떠 있으면 잠시 숨는다 — 창과 겹치지 않게.
 * - 「나중에」·Esc 는 이번만 닫고, 「다시 보지 않기」는 부르는 쪽이 기억한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface SpotStep {
  target: string;
  title: string;
  body: string;
  advance: "click" | "gone" | "next";
  /** 참이면 이 단계를 건너뛴다(예: 이미 눌러 둘 필요가 없을 때). */
  skipIf?: () => boolean;
}

export interface SpotFinal {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}

interface Props {
  label: string;
  steps: SpotStep[];
  final: SpotFinal;
  onFinish: () => void;
  onLater: () => void;
  onNever: () => void;
}

const PAD = 6;
const visible = (el: Element) => el.getClientRects().length > 0;

function findTarget(selector: string): HTMLElement | null {
  try {
    return ([...document.querySelectorAll<HTMLElement>(selector)].find(visible) ?? null);
  } catch {
    return null;
  }
}

/** 우리 안내 말고 다른 창이 떠 있는지(밝힐 요소가 그 창 안이면 숨지 않는다). */
function blockedByModal(target: HTMLElement | null): boolean {
  const modals = [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"]')].filter(
    (m) => !m.closest("[data-spotlight-root]") && visible(m),
  );
  return modals.length > 0 && !(target && modals.some((m) => m.contains(target)));
}

export default function Spotlight({ label, steps, final, onFinish, onLater, onNever }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [paused, setPaused] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const seen = useRef(false);
  const goneAt = useRef<number | null>(null);
  const finished = useRef(false);
  const step = steps[idx];
  const done = idx >= steps.length;

  const next = useCallback(() => {
    seen.current = false;
    goneAt.current = null;
    setIdx((i) => i + 1);
  }, []);

  useEffect(() => {
    if (done && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [done, onFinish]);

  // 밝힐 자리 따라가기 — 스크롤·화면 크기 변화·요소가 새로 생기는 것까지 0.2초마다 맞춘다.
  useEffect(() => {
    if (!step) return;
    let scrolled = false;
    const tick = () => {
      setNarrow(window.innerWidth < 640);
      if (step.skipIf?.()) {
        next();
        return;
      }
      const el = findTarget(step.target);
      setPaused(blockedByModal(el));
      if (el) {
        seen.current = true;
        goneAt.current = null;
        if (!scrolled) {
          scrolled = true;
          const r = el.getBoundingClientRect();
          if (r.top < 64 || r.bottom > window.innerHeight - 160) el.scrollIntoView?.({ block: "center", behavior: "smooth" });
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
        if (step.advance === "gone" && seen.current) {
          goneAt.current ??= Date.now();
          if (Date.now() - goneAt.current > 500) next();
        }
      }
    };
    tick();
    const t = window.setInterval(tick, 200);
    return () => window.clearInterval(t);
  }, [step, next]);

  // 밝힌 요소를 누르면 다음 단계로(누른 동작 자체는 그대로 일어난다).
  useEffect(() => {
    if (!step || step.advance !== "click") return;
    const onClick = (e: MouseEvent) => {
      const el = findTarget(step.target);
      if (el && e.target instanceof Node && el.contains(e.target)) window.setTimeout(next, 250);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !paused) onLater();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onLater, paused]);

  if (paused) return null;

  const hole = !done && rect ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  // 말풍선 자리: 좁은 화면은 아래에 붙이고, 넓으면 밝힌 곳 아래(공간 없으면 위).
  const bubbleStyle: React.CSSProperties = narrow || !hole
    ? { left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }
    : hole.top + hole.height + 200 < window.innerHeight
      ? { top: hole.top + hole.height + 12, left: Math.max(12, Math.min(hole.left, window.innerWidth - 372)), width: 360 }
      : { top: Math.max(12, hole.top - 12 - 180), left: Math.max(12, Math.min(hole.left, window.innerWidth - 372)), width: 360 };

  return (
    <div data-spotlight-root aria-label={label} role="region">
      {hole && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[1000] rounded-xl border-2 border-amber-400 transition-all duration-200 motion-reduce:transition-none"
          style={{ ...hole, boxShadow: "0 0 0 200vmax var(--ui-scrim)" }}
        />
      )}
      <div className="fixed z-[1001] flex flex-col gap-2 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-2xl" style={bubbleStyle}>
        {done ? (
          <>
            <strong className="text-base text-slate-900">{final.title}</strong>
            <p aria-live="polite">{final.body}</p>
            <div className="flex items-center justify-end gap-2">
              {final.href && (
                <a href={final.href} className="btn-depth-blue hit-44 rounded-lg px-3 py-2 text-sm font-semibold">
                  {final.hrefLabel ?? "보러 가기"}
                </a>
              )}
              <button type="button" onClick={onLater} className="hit-44 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                닫기
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="inline-flex gap-1" aria-label={`${steps.length}단계 중 ${idx + 1}단계`}>
                {steps.map((_, i) => (
                  <i key={i} className={`h-1.5 rounded-full ${i === idx ? "w-5 bg-amber-600" : i < idx ? "w-2 bg-emerald-600" : "w-2 bg-slate-300"}`} />
                ))}
              </span>
              <span>{idx + 1} / {steps.length}</span>
            </div>
            <strong className="text-base text-slate-900" aria-live="polite">{step!.title}</strong>
            <p>{rect ? step!.body : "안내할 칸이 화면에 나오면 다시 밝혀 드릴게요."}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={onNever} className="hit-44 text-xs text-slate-500 underline underline-offset-2">
                다시 보지 않기
              </button>
              <span className="flex gap-2">
                <button type="button" onClick={onLater} className="hit-44 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                  나중에
                </button>
                {step!.advance === "next" && (
                  <button type="button" onClick={next} className="btn-depth-blue hit-44 rounded-lg px-3 py-2 text-sm font-semibold">
                    다음
                  </button>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * DateInputCustom — 커스텀 박스 + **우리가 직접 그리는 달력 팝오버**.
 * 정본: docs/design/components.md §2 Date Input
 *
 * 한국어 UX 요구: "2026-04-25 (목)" 처럼 요일까지 표시.
 *
 * ## 왜 네이티브 달력을 안 쓰나 (2026-08-30, 5번째 재발 후 전환)
 *
 * 원래는 투명한 `<input type="date">` 를 박스 위에 깔고 브라우저 기본 달력을 띄웠다.
 * 그 구조가 **네 번 연속으로 죽었다** — 매번 원인이 달랐고, 매번 브라우저 사정이었다:
 *
 *   #654  `<label>` 이 클릭을 재전달 → showPicker() 2차 호출 → 열린 달력이 닫힘
 *   #656  0×0 요소에는 iOS Safari·인앱 WKWebView 가 달력을 안 띄움
 *   #730  브라우저 기본 클릭-오픈이 조용히 안 먹기 시작
 *   #897  크롬이 `opacity:0` 인 입력의 showPicker() 를 **예외 없이 무시** (에러가 안 나서
 *         예외 기반 폴백도 안 켜짐 → 완전 무반응). 우리 코드는 그 사이 무변경 —
 *         **브라우저가 바뀐 것**이었다.
 *
 * 공통점: **"달력을 여는 주체가 브라우저"** 라서 우리가 통제할 수도, 실패를 감지할 수도
 * 없었다. showPicker() 는 실패해도 예외를 안 던지는 경우가 있어 폴백조차 못 건다.
 * 그래서 이 컴포넌트는 **달력을 직접 그린다.** 평범한 DOM 이라 모든 브라우저·인앱
 * 웹뷰에서 동일하게 동작하고, 자동화 테스트로 실제 표시 여부를 검증할 수 있다.
 *
 * 되돌리지 말 것: `<input type="date">` + showPicker 로 회귀하면 위 4건이 다시 열린다.
 * `tests/components/date-input-picker.test.ts` 가 이 계약을 기계 검증한다.
 */
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/* ────────────────────────── 순수 날짜 유틸 (타임존 무관) ──────────────────────────
   `new Date(iso)` 는 UTC 로 파싱돼 한국 시간대에서 하루 밀린다 — 문자열로만 다룬다. */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** "YYYY-MM-DD" → [y, m, d]. 형식이 아니면 null. */
export function parseIso(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 로컬 기준 오늘 ISO. */
export function todayIso(): string {
  const n = new Date();
  return toIso(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export interface GridCell {
  iso: string;
  day: number;
  /** 이번 달 날짜인가 (앞뒤 달 채움이면 false) */
  inMonth: boolean;
}

/**
 * 그 달의 6×7=42칸 그리드. 일요일 시작, 앞뒤 달로 채운다.
 * 42칸 고정이라 달을 넘겨도 팝오버 높이가 안 흔들린다.
 */
export function buildGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      iso: toIso(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1,
    });
  }
  return cells;
}

/** 문자열 비교로 범위 판정 — ISO 는 사전순 == 시간순이다. */
function outOfRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

function formatDisplay(iso: string): string {
  const p = parseIso(iso);
  if (!p) return iso;
  const [y, m, d] = p;
  const dayKo = DAY_KO[new Date(y, m - 1, d).getDay()];
  return `${iso} (${dayKo})`;
}

/* ────────────────────────────────── 컴포넌트 ────────────────────────────────── */

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  ariaLabel?: string;
  min?: string;
  max?: string;
  placeholder?: string;
}

export default function DateInputCustom({
  value,
  onChange,
  ariaLabel,
  min,
  max,
  placeholder = "날짜 선택",
}: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // 팝오버가 보고 있는 달. 열 때마다 현재 값(없으면 오늘) 기준으로 맞춘다.
  const [view, setView] = useState<[number, number]>(() => {
    const p = parseIso(value) ?? parseIso(todayIso())!;
    return [p[0], p[1]];
  });
  // 부모가 clip 하는 경우가 있어 position:fixed 로 띄우고 좌표를 직접 잰다.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const W = 288;
    const H = 340;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 아래가 좁으면 위로 띄운다. 좌우는 화면 안으로 물린다.
    const top = r.bottom + H + 8 > vh && r.top - H - 8 > 0 ? r.top - H - 8 : r.bottom + 6;
    const left = Math.max(8, Math.min(r.left, vw - W - 8));
    setPos({ top, left });
  }, []);

  const openPicker = useCallback(() => {
    const p = parseIso(value) ?? parseIso(todayIso())!;
    setView([p[0], p[1]]);
    place();
    setOpen(true);
  }, [value, place]);

  // 바깥 클릭 · Esc · 스크롤/리사이즈 대응
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const shift = (delta: number) => {
    setView(([y, m]) => {
      const n = m + delta;
      if (n < 1) return [y - 1, 12];
      if (n > 12) return [y + 1, 1];
      return [y, n];
    });
  };

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const [vy, vm] = view;
  const cells = buildGrid(vy, vm);
  const today = todayIso();

  return (
    <>
      <div
        ref={wrapRef}
        id={id}
        className="custom-date-wrapper"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <span className="custom-date-display">
          {value ? (
            formatDisplay(value)
          ) : (
            <span className="text-gray-400 font-normal">{placeholder}</span>
          )}
        </span>
        <span className="text-gray-400" aria-hidden="true">
          📅
        </span>
      </div>

      {open && pos && (
        <div
          ref={popRef}
          className="date-pop"
          role="dialog"
          aria-modal="false"
          aria-label={`${ariaLabel ?? "날짜"} 선택`}
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="date-pop-head">
            <button
              type="button"
              className="date-pop-nav"
              onClick={() => shift(-1)}
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className="date-pop-title" aria-live="polite">
              {vy}년 {vm}월
            </span>
            <button
              type="button"
              className="date-pop-nav"
              onClick={() => shift(1)}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          <div className="date-pop-dow" aria-hidden="true">
            {DAY_KO.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="date-pop-grid">
            {cells.map((c) => {
              const disabled = outOfRange(c.iso, min, max);
              const classes = ["date-pop-day"];
              if (!c.inMonth) classes.push("is-out");
              if (c.iso === value) classes.push("is-selected");
              else if (c.iso === today) classes.push("is-today");
              return (
                <button
                  key={c.iso}
                  type="button"
                  className={classes.join(" ")}
                  disabled={disabled}
                  aria-label={c.iso}
                  aria-current={c.iso === value ? "date" : undefined}
                  onClick={() => pick(c.iso)}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="date-pop-foot">
            <button
              type="button"
              className="date-pop-today"
              onClick={() => pick(today)}
              disabled={outOfRange(today, min, max)}
            >
              오늘
            </button>
            <button type="button" className="date-pop-close" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}

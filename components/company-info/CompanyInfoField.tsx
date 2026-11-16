/**
 * CompanyInfoField — 업체정보 편집기의 한 칸(라벨 + (?) 설명 + 입력). CompanyInfoEditor 에서 분리
 * (2026-09-28 company-info-restructure, 500줄 캡).
 *
 * - FieldLabel: 라벨 + (?) 툴팁(HintTooltip) + 화면낭독기용 상시 설명(sr-only). 회색 설명 줄 없음.
 * - 기대출·기타메모 같은 여러 줄 칸 = textarea 자동높이 — 줄바꿈 수뿐 아니라 긴 줄이 접혀 늘어난 만큼도 따라 늘어난다
 *   (2026-11-17 belie, useAutoGrow: 내용 높이에 맞춤 · 칸 너비가 바뀌면 다시 맞춤). 시트에는 줄바꿈 그대로 저장.
 *   칸 아래 손잡이(ResizeGrip)를 위아래로 끌면 높이를 직접 정하고(그때는 칸 안에서 스크롤), 두 번 누르면 최소(두 줄) ↔ 최대(내용 전체).
 * - 연락처통신사: blur 에만 formatPhone(괄호 통신사 보존).
 * - 주민등록번호: 13자리 전체(ADR-0035, belie 2026-10-23). 입력 중 7번째 숫자에서 하이픈 자동,
 *   13자리 초과분은 버림, blur 에 normalizeRrn 마무리(6자리 미만이면 비움) — 버리거나 비운 이유를
 *   칸 아래에 알린다. 서버 스키마도 같은 모양으로 한 번 더 맞춘다.
 * - 이메일(company-info-email-v2): blur 에만 tidyContactEmail(공백·전각 ＠·mailto: 정리, 대소문자 유지).
 *   모양이 아니어도 막지 않고 적은 그대로 저장 — 포커스가 없을 때 amber 안내(role=status)만. type=text
 *   (type=email 은 브라우저가 값을 고쳐 커서가 튄다) + 모바일 @ 키보드(inputMode=email), 자동완성·맞춤법·첫 글자 대문자 끔.
 */
"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CompanyInfo } from "@/types";
import { formatPhone } from "@/lib/format/phone";
import HintTooltip from "@/components/ui/HintTooltip";
import { RRN_MAX_DIGITS, normalizeRrn, sanitizeRrnTyping } from "@/util/rrn-front";
import type { FieldDef } from "@/components/company-info-defs";
import { bizNoTyping } from "@/util/live-format";
import { looksLikeContactEmail, tidyContactEmail } from "@/util/contact-email";
import { useLiveInput } from "./useLiveInput";

/** 위계(§3-2 contrast): 값 slate-900 / 테두리 slate-300 / 예시(placeholder)만 slate-300 옅게. */
export const inputCls =
  "w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-300 focus:border-brand-red focus:outline-none";
/** 자동 계산 칸 — 입력칸과 같은 크기, 회색 바탕(직접 고칠 수 없음). */
export const readOnlyCls =
  "w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 focus:outline-none";

const RRN_CUT_MSG = "주민등록번호는 13자리까지만 적을 수 있어요.";
const RRN_SHORT_MSG = "앞 6자리를 모두 입력해야 저장돼요.";
export const EMAIL_SHAPE_MSG = "이메일 모양이 아니에요(예: ceo@example.com). 적은 그대로 저장돼요.";

/** 설명이 라벨과 다를 때만 (?) 와 sr-only 설명을 단다 — 그 설명 요소 id. */
export function hintIdOf(inputId: string, label: string, hint?: string): string | undefined {
  return hint && hint !== label ? `${inputId}-hint` : undefined;
}

/**
 * 라벨 + (?) 설명. (?) 버튼은 <label> 밖 — 눌러도 입력칸이 포커스·활성되지 않는다.
 * tag = 라벨 옆 작은 회색 표시(자동 계산 칸의 "(자동)") — 입력칸 이름(label)에는 들어가지 않는다.
 */
export function FieldLabel({ htmlFor, label, hint, tag }: { htmlFor: string; label: string; hint?: string; tag?: string }) {
  const hintId = hintIdOf(htmlFor, label, hint);
  return (
    <>
      <div className="flex items-center gap-1">
        <label htmlFor={htmlFor} className="text-xs font-medium text-slate-800">
          {label}
        </label>
        {tag && <span className="text-xs text-slate-500">{tag}</span>}
        {hintId && <HintTooltip label={label} text={hint!} />}
      </div>
      {hintId && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
    </>
  );
}

/**
 * 여러 줄 칸 높이를 내용에 맞춘다 — 값이 바뀔 때, 그리고 칸 너비가 바뀔 때(창 넓히기·접힌 판 펴기).
 * rows 는 처음 그릴 때의 바탕값(줄바꿈 수)이고, 긴 줄이 접혀 생긴 줄은 여기서 잰다. 숨겨져 높이가 0 이면 건드리지 않는다.
 */
function useAutoGrow(value: string, on: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let width = -1;
    const fit = () => {
      el.style.height = "auto";
      if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
      width = el.clientWidth;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { if (el.clientWidth !== width) fit(); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, on]);
  return ref;
}

/** 손으로 정하는 높이의 위쪽 한계(px). */
export const GRIP_MAX = 800;
/** 최소 높이 = 두 줄 — 줄 높이·안쪽 여백·테두리를 그 칸에서 잰다(글자 배율에 따라 px 이 달라진다). */
export function gripMinOf(el: HTMLElement | null): number {
  if (!el) return 48;
  const cs = getComputedStyle(el), n = (v: string) => parseFloat(v) || 0;
  return Math.ceil(2 * (n(cs.lineHeight) || 20) + n(cs.paddingTop) + n(cs.paddingBottom) + n(cs.borderTopWidth) + n(cs.borderBottomWidth));
}
/** 두 번 누르기: 지금 최소면 최대(null = 내용 전체, 자동 높이)로, 아니면 최소로. */
export const toggleGrip = (manual: number | null, min: number): number | null => (manual !== null && manual <= min ? null : min);

/**
 * 여러 줄 칸 아래 테두리 손잡이 — 위아래로 끌어 높이를 늘리고 줄인다. 두 번 누르면 최소 ↔ 최대.
 * role=separator 라 폰 사이드 메뉴 밀기(mobile-nav SWIPE_SKIP)와 겹치지 않는다. 키보드: ↑↓ 20px, Enter = 두 번 누르기.
 */
function ResizeGrip({ label, current, min, onResize, onToggle }: { label: string; current: () => number; min: () => number; onResize: (h: number) => void; onToggle: () => void }) {
  const drag = useRef<{ y: number; h: number } | null>(null);
  const clamp = (h: number) => Math.min(GRIP_MAX, Math.max(min(), Math.round(h)));
  const move = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current) onResize(clamp(drag.current.h + e.clientY - drag.current.y)); };
  const end = () => { drag.current = null; };
  return (
    <div
      role="separator" aria-orientation="horizontal" tabIndex={0}
      aria-label={`${label} 칸 높이 조절`} title="끌어서 높이 조절 · 두 번 누르면 최소/최대"
      className="group -mt-0.5 flex h-3 cursor-ns-resize touch-none select-none items-center justify-center rounded-b-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
      onPointerDown={(e) => { drag.current = { y: e.clientY, h: current() }; e.currentTarget.setPointerCapture?.(e.pointerId); }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onDoubleClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); onResize(clamp(current() + (e.key === "ArrowDown" ? 20 : -20))); }
        else if (e.key === "Enter") { e.preventDefault(); onToggle(); }
      }}
    >
      <span aria-hidden className="h-0.5 w-8 rounded-full bg-slate-300 group-hover:bg-slate-500" />
    </div>
  );
}

interface Props {
  def: FieldDef;
  value: string;
  onChange: (k: keyof CompanyInfo, v: string) => void;
  /** 입력칸 id — 패널·모달이 같은 칸을 동시에 그리므로 위치까지 넣은 고유값. */
  id: string;
  className?: string;
}

export default function CompanyInfoField({ def, value: v, onChange, id, className = "block" }: Props) {
  const [k, label, hint, , multi] = def;
  // 주민등록번호 칸이 13자리 초과분을 버렸거나 비웠을 때 그 이유(말없이 사라지지 않게).
  const [rrnNotice, setRrnNotice] = useState("");
  // 이메일 칸에 포커스가 있는 동안은 모양 안내를 감춘다(적는 도중 깜빡이지 않게).
  const [focused, setFocused] = useState(false);
  const isPhone = k === "연락처통신사";
  const isRrn = k === "주민등록번호";
  const isEmail = k === "이메일";
  const hintId = hintIdOf(id, label, hint);
  // 손으로 정한 높이(px). null = 내용에 맞춰 자동(최대). 화면을 떠나면 잊는다(저장하지 않음).
  const [manual, setManual] = useState<number | null>(null);
  const growRef = useAutoGrow(v, !!multi && manual === null);
  const normalizeOnBlur = isPhone ? formatPhone : isRrn ? normalizeRrn : isEmail ? tidyContactEmail : null;
  const emailNotice = isEmail && !focused && !looksLikeContactEmail(v);
  const onBlur = normalizeOnBlur
    ? () => {
        if (isEmail) setFocused(false);
        const next = normalizeOnBlur(v);
        if (isRrn && v.trim() !== "" && next === "") setRrnNotice(RRN_SHORT_MSG);
        if (next !== v) onChange(k, next);
      }
    : undefined;
  const isBizNo = k === "사업자등록번호";
  // 사업자등록번호는 입력하는 동시에 000-00-00000(belie 2026-09-29). 숫자 아닌 글이면 그대로.
  const bizLive = useLiveInput((raw, caret, prev) => (isBizNo ? bizNoTyping(raw, caret, prev) : null), v, (next) => onChange(k, next));
  const onInput = (raw: string) => {
    if (!isRrn) return onChange(k, raw);
    // 숫자가 13자리를 넘으면 넘는 숫자는 버린다 — 버린 이유를 칸 아래에 알린다.
    setRrnNotice(raw.replace(/\D/g, "").length > RRN_MAX_DIGITS ? RRN_CUT_MSG : "");
    onChange(k, sanitizeRrnTyping(raw));
  };
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} hint={hint} />
      {multi ? (
        <>
        <textarea
          id={id}
          ref={growRef}
          className={`${inputCls} resize-none leading-5 ${manual === null ? "overflow-hidden" : "overflow-y-auto"}`}
          style={manual === null ? undefined : { height: manual }}
          rows={Math.max(2, v.split("\n").length)}
          aria-describedby={hintId}
          value={v}
          onChange={(e) => onChange(k, e.target.value)}
        />
        <ResizeGrip label={label} current={() => growRef.current?.offsetHeight ?? gripMinOf(growRef.current)} min={() => gripMinOf(growRef.current)}
          onResize={setManual} onToggle={() => setManual((m) => toggleGrip(m, gripMinOf(growRef.current)))} />
        </>
      ) : (
        <input
          id={id}
          className={inputCls}
          aria-describedby={hintId}
          inputMode={isPhone ? "tel" : isRrn || isBizNo ? "numeric" : isEmail ? "email" : undefined}
          autoComplete={isRrn || isEmail ? "off" : undefined}
          autoCapitalize={isEmail ? "none" : undefined}
          spellCheck={isEmail ? false : undefined}
          ref={isBizNo ? bizLive.ref : undefined}
          value={v}
          onChange={isBizNo ? bizLive.onChange : (e) => onInput(e.target.value)}
          onFocus={isEmail ? () => setFocused(true) : undefined}
          onBlur={onBlur}
        />
      )}
      {isRrn && rrnNotice && (
        <p className="mt-0.5 text-xs text-amber-700" role="status">
          {rrnNotice}
        </p>
      )}
      {emailNotice && (
        <p className="mt-0.5 text-xs text-amber-700" role="status">
          {EMAIL_SHAPE_MSG}
        </p>
      )}
    </div>
  );
}

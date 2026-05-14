/**
 * PersistentDetails — `<details>` 의 펼침/닫힘 상태를 localStorage 에 영구 저장
 * + 전 브라우저 동작하는 펼침/접힘 height 애니메이션.
 *
 * 사용처: /admin/users 의 기수 박스 · 팀 박스 · 유보 섹션.
 *
 * 동작:
 *   - **localStorage 영속**: 닫아둔 박스는 새로고침·재진입해도 닫힘 유지.
 *   - **JS height 애니메이션** (2026-05-14): 이전 `::details-content` CSS 방식은
 *     Chrome 131+ 전용이라 모바일(iOS Safari·삼성인터넷)에서 애니메이션 안 됨.
 *     summary 클릭을 가로채 `<div>` wrapper 의 height 를 직접 transition →
 *     전 브라우저 동작. prefers-reduced-motion 은 즉시 토글.
 *   - **중첩 안전**: summary 의 onClick 으로 처리 → 자식 details 의 토글이 부모
 *     까지 전파되던 사고(2026-05-14) 원천 차단 (summary 는 형제 subtree).
 *
 * 구조: children[0] = <summary>, children[1:] = 콘텐츠 → 콘텐츠를 애니메이션
 * wrapper <div> 로 감쌈.
 *
 * 저장 형식: 단일 JSON object 키 `salespt:admin:collapsed`.
 *   `{ "cohort:7": true, "team:7:서울": false, "reserved": true }` 형태.
 */
"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type DetailsHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

const STORAGE_KEY = "salespt:admin:collapsed";
const ANIM_MS = 240;

function readStore(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 가득 차거나 비활성 — silent fail.
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props
  extends Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "open" | "onToggle"> {
  /** 저장 키 — 같은 영역(예: "cohort:7") 은 항상 같은 키 사용해야 복원됨. */
  persistKey: string;
  /** SSR 및 localStorage 에 저장값 없을 때 사용. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function PersistentDetails({
  persistKey,
  defaultOpen = true,
  children,
  ...rest
}: Props) {
  // 초기 open — 클라이언트 첫 render 에서 localStorage 동기 read.
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const store = readStore();
    return persistKey in store ? (store[persistKey] ?? defaultOpen) : defaultOpen;
  });

  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);

  // DOM `open` 속성을 React 상태와 동기화 — **애니메이션 중엔 skip** (handler 가
  // 직접 제어). useLayoutEffect 라 paint 전 적용 → 첫 render flash 없음.
  // JSX 에 `open` prop 을 안 넣어서 hydration mismatch 도 없음.
  useLayoutEffect(() => {
    if (animatingRef.current) return;
    const d = detailsRef.current;
    if (d && d.open !== open) d.open = open;
  });

  function persist(next: boolean) {
    const store = readStore();
    store[persistKey] = next;
    writeStore(store);
  }

  function handleSummaryClick(e: MouseEvent<HTMLElement>) {
    // native 즉시 토글 차단 — 우리가 애니메이션 후 details.open 직접 set.
    e.preventDefault();
    if (animatingRef.current) return; // 애니메이션 중 재클릭 무시
    const details = detailsRef.current;
    const content = contentRef.current;
    if (!details || !content) return;

    const closing = details.open;
    const reduce = prefersReducedMotion();

    if (reduce) {
      details.open = !closing;
      setOpen(!closing);
      persist(!closing);
      return;
    }

    animatingRef.current = true;

    if (closing) {
      // 닫기: 현재 높이 → 0. details.open 은 애니메이션 끝까지 true 유지.
      content.style.overflow = "hidden";
      content.style.height = `${content.scrollHeight}px`;
      void content.offsetHeight; // reflow
      content.style.transition = `height ${ANIM_MS}ms ease`;
      content.style.height = "0px";
      const onEnd = () => {
        content.removeEventListener("transitionend", onEnd);
        details.open = false;
        content.style.height = "";
        content.style.transition = "";
        content.style.overflow = "";
        animatingRef.current = false;
        setOpen(false);
        persist(false);
      };
      content.addEventListener("transitionend", onEnd);
    } else {
      // 열기: details.open 먼저 true (콘텐츠 렌더) → 0 → scrollHeight → auto.
      details.open = true;
      content.style.overflow = "hidden";
      content.style.height = "0px";
      void content.offsetHeight; // reflow
      content.style.transition = `height ${ANIM_MS}ms ease`;
      content.style.height = `${content.scrollHeight}px`;
      const onEnd = () => {
        content.removeEventListener("transitionend", onEnd);
        content.style.height = "";
        content.style.transition = "";
        content.style.overflow = "";
        animatingRef.current = false;
        setOpen(true);
        persist(true);
      };
      content.addEventListener("transitionend", onEnd);
    }
  }

  // children[0] = <summary>, 나머지 = 콘텐츠.
  const childArray = Children.toArray(children);
  const summary = childArray[0];
  const content = childArray.slice(1);

  return (
    <details ref={detailsRef} {...rest} suppressHydrationWarning>
      {isValidElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }>(summary)
        ? cloneElement(summary, { onClick: handleSummaryClick })
        : summary}
      <div ref={contentRef}>{content}</div>
    </details>
  );
}

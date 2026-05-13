/**
 * PersistentDetails — `<details>` 의 펼침/닫힘 상태를 localStorage 에 영구 저장.
 *
 * 사용처: /admin/users 의 기수 박스 · 팀 박스 · 유보 섹션.
 *   매번 페이지 새로고침 시 모든 박스가 default(`open`) 로 리셋되어 admin 이 매번
 *   접어야 하는 불편 (2026-05-13 사용자 보고).
 *
 * 동작:
 *   - **서버 렌더**: `defaultOpen` 그대로 렌더. localStorage 접근 불가.
 *   - **클라이언트 첫 렌더**: localStorage 동기 read → 저장값으로 즉시 open 결정.
 *     서버와 다르면 `suppressHydrationWarning` 으로 React 경고 무음. SSR HTML 은
 *     React 가 commit phase 에 정정.
 *   - 사용자 토글 시 onToggle 이 localStorage 갱신.
 *
 * 이전 구현 (useEffect 로 정정) 은 첫 paint 가 default 로 잠깐 비치고 useEffect 가
 * 정정하는 flash 가 있어서 "수강생 관리 나갔다 들어오면 펼쳐짐" 사용자 사고
 * 의 원인으로 추정 (2026-05-14). 동기 read 로 flash 제거.
 *
 * 저장 형식: 단일 JSON object 키 `salespt:admin:collapsed`.
 *   `{ "cohort:7": true, "team:7:서울": false, "reserved": true }` 형태.
 */
"use client";

import {
  useEffect,
  useRef,
  useState,
  type DetailsHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react";

const STORAGE_KEY = "salespt:admin:collapsed";

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

interface Props
  extends Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "open" | "onToggle"> {
  /** 저장 키 — 같은 영역(예: "cohort:7") 은 항상 같은 키 사용해야 복원됨. */
  persistKey: string;
  /** SSR 및 첫 paint 시 사용. localStorage 에 저장값 있으면 클라이언트에서 즉시 덮어씀. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function PersistentDetails({
  persistKey,
  defaultOpen = true,
  children,
  ...rest
}: Props) {
  // Lazy initializer — 클라이언트 첫 render 에서 localStorage 동기 read.
  // SSR 에서는 window 없음 → defaultOpen 반환 → server HTML 은 defaultOpen 으로.
  // 클라이언트 hydration 시 stored value 사용 → SSR HTML 과 다를 수 있음 →
  // <details suppressHydrationWarning> 으로 경고 무음. React 는 commit phase
  // 에 DOM 정정. (이전 useEffect 패턴은 첫 paint 에 default 가 잠깐 보이는
  // flash 가 있어서 사용자가 "복귀 시 펼쳐짐" 으로 인지하는 사고 유발.)
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const store = readStore();
    return persistKey in store ? (store[persistKey] ?? defaultOpen) : defaultOpen;
  });

  // persistKey 변경 (드물지만 동적 키 케이스) 시에도 재적용.
  const lastPersistKey = useRef(persistKey);
  useEffect(() => {
    if (lastPersistKey.current === persistKey) return;
    lastPersistKey.current = persistKey;
    const store = readStore();
    if (persistKey in store) {
      setOpen(store[persistKey] ?? defaultOpen);
    } else {
      setOpen(defaultOpen);
    }
  }, [persistKey, defaultOpen]);

  function handleToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    const next = (e.target as HTMLDetailsElement).open;
    if (next === open) return; // React prop sync 로 인한 self-fire 무시.
    setOpen(next);
    const store = readStore();
    store[persistKey] = next;
    writeStore(store);
  }

  return (
    <details
      {...rest}
      open={open}
      onToggle={handleToggle}
      suppressHydrationWarning
    >
      {children}
    </details>
  );
}

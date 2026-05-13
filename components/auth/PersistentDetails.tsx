/**
 * PersistentDetails — `<details>` 의 펼침/닫힘 상태를 localStorage 에 영구 저장.
 *
 * 사용처: /admin/users 의 기수 박스 · 팀 박스 · 유보 섹션.
 *   매번 페이지 새로고침 시 모든 박스가 default(`open`) 로 리셋되어 admin 이 매번
 *   접어야 하는 불편 (2026-05-13 사용자 보고).
 *
 * 동작:
 *   - 첫 render (SSR + 클라이언트 hydration) 는 `defaultOpen` 그대로 — hydration
 *     mismatch 방지.
 *   - mount 후 useEffect 가 localStorage 에서 `persistKey` 값을 읽어 상태 복원.
 *   - 사용자가 토글 시 onToggle 이 localStorage 갱신.
 *
 * 저장 형식: 단일 JSON object 키 `salespt:admin:collapsed`.
 *   `{ "cohort:7": true, "team:7:서울": false, "reserved": true }` 형태.
 */
"use client";

import { useEffect, useState, type DetailsHTMLAttributes, type ReactNode } from "react";

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
  /** SSR 및 첫 paint 시 사용. localStorage 에 저장값 있으면 mount 후 덮어씀. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function PersistentDetails({
  persistKey,
  defaultOpen = true,
  children,
  ...rest
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  // mount 후 localStorage 값 적용. SSR 결과는 defaultOpen 그대로 보낸다 — 클라이언트
  // 첫 paint 도 defaultOpen → hydration mismatch 0. useEffect 가 동기적으로 다음
  // tick 에 새 값 적용 (사용자 인지 거의 없음).
  useEffect(() => {
    const store = readStore();
    if (persistKey in store) {
      setOpen(store[persistKey] ?? defaultOpen);
    }
  }, [persistKey, defaultOpen]);

  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    const next = (e.target as HTMLDetailsElement).open;
    setOpen(next);
    const store = readStore();
    store[persistKey] = next;
    writeStore(store);
  }

  return (
    <details {...rest} open={open} onToggle={handleToggle}>
      {children}
    </details>
  );
}

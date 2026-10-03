/**
 * useScopedDraft — 팝업관리(공지/업데이트) 로컬 초안 보관용 훅+헬퍼 (scope D).
 *
 * 의미 (scope C autosave-c 와 정반대 — 서버 자동제출 없음):
 * - 편집 중 입력은 sessionStorage 에만 자동 보관 (새로고침·탭 이동 복원용).
 * - 공개 API(POST/PATCH)는 명시적 게시 버튼에서만 호출. 하이드레이션·복원·
 *   타이머가 fetch 를 쏘지 않는다.
 * - 키는 `popup-draft:v1:<정규화 admin email>:<슬롯>` — 인증 admin 신원 키잉.
 *   scope(이메일)가 없으면 키를 만들지 않아 다른 admin 초안 노출·무범위 저장을 막는다.
 * - 저장소 사용 불가(차단·예외)면 ok:false 를 돌려 UI 가 '초안 보관됨' 을 거짓 표시하지 않는다.
 * - 초안 삭제는 "정확히 그 리비전의 서버 ACK" 일 때만. 저장 중 이어쓰기·늦은 응답은
 *   현재 입력을 덮어쓰거나 버리지 않는다.
 *
 * Framework-light: 순수 헬퍼는 vitest(environment node) 에서 직접 검증.
 */
"use client";

import { useEffect, useRef, useState } from "react";

/** 세션에 보관되는 초안 봉투. base=보관 당시 게시본 지문(버전 충돌 판정용). */
export interface DraftEnvelope<T> {
  value: T;
  base: string;
  rev: string;
  at: number;
}

/** 최소 Storage 모양 — 테스트에서 메모리 구현 주입 가능. */
export type DraftStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** admin 이메일 정규화 (소문자+trim). 빈값이면 "" — 키 생성 거부 신호. */
export function normalizeScope(scope: string | null | undefined): string {
  return (scope ?? "").trim().toLowerCase();
}

/**
 * 세션 초안 키. scope(인증 admin 이메일)나 slot 이 비면 null —
 * 호출자는 null 을 "보관 불가" 로 취급하고 성공처럼 표시하지 않는다.
 */
export function draftKey(
  scope: string | null | undefined,
  slot: string | null | undefined,
): string | null {
  const s = normalizeScope(scope);
  const k = (slot ?? "").trim();
  if (!s || !k) return null;
  return `popup-draft:v1:${s}:${k}`;
}

/** 값 지문 — 게시본/초안/ACK 리비전 비교용. 실패 시 "" (비교 불일치 취급). */
export function fingerprint(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}

/** 초안 읽기 — 키 없음·파싱 실패·저장소 예외면 null (없음으로 취급, throw 없음). */
export function loadDraft<T>(
  store: DraftStore | null | undefined,
  scope: string | null | undefined,
  slot: string | null | undefined,
): DraftEnvelope<T> | null {
  try {
    const key = draftKey(scope, slot);
    if (!key || !store) return null;
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>> | null;
    if (!parsed || typeof parsed !== "object" || !("value" in parsed)) return null;
    return {
      value: parsed.value as T,
      base: typeof parsed.base === "string" ? parsed.base : "",
      rev: typeof parsed.rev === "string" ? parsed.rev : fingerprint(parsed.value),
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

/**
 * 초안 쓰기 — 성공 시 { ok:true, rev }. 저장소 없음·차단·예외·무범위 키면
 * { ok:false } (UI 는 '초안 보관됨' 을 표시하지 않는다).
 */
export function saveDraft<T>(
  store: DraftStore | null | undefined,
  scope: string | null | undefined,
  slot: string | null | undefined,
  value: T,
  base: string,
): { ok: boolean; rev: string } {
  const rev = fingerprint(value);
  try {
    const key = draftKey(scope, slot);
    if (!key || !store) return { ok: false, rev };
    const env: DraftEnvelope<T> = { value, base, rev, at: Date.now() };
    store.setItem(key, JSON.stringify(env));
    return { ok: true, rev };
  } catch {
    return { ok: false, rev };
  }
}

/** 초안 삭제 — best-effort, throw 없음. */
export function clearDraft(
  store: DraftStore | null | undefined,
  scope: string | null | undefined,
  slot: string | null | undefined,
): void {
  try {
    const key = draftKey(scope, slot);
    if (!key || !store) return;
    store.removeItem(key);
  } catch {
    /* 보관 실패와 마찬가지로 조용히 무시 — 다음 저장이 덮어쓴다. */
  }
}

/**
 * ACK 정합 판정 (순수 — 테스트 대상):
 * 저장 중 이어쓰기(currentRev != ackedRev)면 false → 초안 유지·입력 보존.
 * 보관된 rev 가 ACK rev 와 다르면 false → 늦은/뒤바뀐 응답이 새 초안을 지우지 않음.
 */
export function shouldClearOnAck(
  storedRev: string | null | undefined,
  ackedRev: string,
  currentRev: string,
): boolean {
  if (!ackedRev) return false;
  if (currentRev !== ackedRev) return false;
  if (storedRev != null && storedRev !== ackedRev) return false;
  return true;
}

/**
 * ACK 후 초안 정리 — shouldClearOnAck 가 true 일 때만 삭제.
 * 저장된 초안이 없는데 현재값==ACK 값이면 정리된 것으로 true.
 * 저장소 예외면 false (보관된 것처럼 SelectorNode 거짓 표시 금지).
 */
export function clearDraftOnAck(
  store: DraftStore | null | undefined,
  scope: string | null | undefined,
  slot: string | null | undefined,
  ackedRev: string,
  currentRev: string,
): boolean {
  try {
    const key = draftKey(scope, slot);
    if (!key || !store || !ackedRev) return false;
    const raw = store.getItem(key);
    if (raw == null) return currentRev === ackedRev;
    let storedRev: string | null = null;
    try {
      storedRev = (JSON.parse(raw) as Partial<DraftEnvelope<unknown>>)?.rev ?? null;
    } catch {
      return false; // 깨진 봉투는 건드리지 않음 (덮어쓰기는 다음 자동보관이 담당)
    }
    if (!shouldClearOnAck(storedRev, ackedRev, currentRev)) return false;
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * 세션 초안 자동보관 훅 — value 변경을 debounce 로 sessionStorage 에만 쓴다.
 * 절대 fetch 하지 않는다. 복원은 호출자가 loadDraft 로 마운트 시 1회 수행
 * (SSR/하이드레이션 mismatch 방지 — effect 안에서 setState).
 */
export function useScopedSessionDraft<T>(
  scopeEmail: string | null | undefined,
  slot: string | null | undefined,
  value: T,
  opts?: { baseRev?: string; debounceMs?: number; enabled?: boolean },
): { draftSaved: boolean; storageOk: boolean } {
  const baseRev = opts?.baseRev ?? "";
  const debounceMs = opts?.debounceMs ?? 400;
  const enabled = opts?.enabled ?? true;
  const [draftSaved, setDraftSaved] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const written = useRef(new Map<string, string>());
  const baseRef = useRef(baseRev);
  baseRef.current = baseRev;

  useEffect(() => {
    const scope = normalizeScope(scopeEmail);
    const slotKey = (slot ?? "").trim();
    if (!enabled || !scope || !slotKey) return;
    const rev = fingerprint(value);
    const mapKey = `${scope}:${slotKey}`;
    if (written.current.get(mapKey) === rev) return;
    const t = setTimeout(() => {
      try {
        if (typeof window === "undefined" || !window.sessionStorage) {
          setStorageOk(false);
          setDraftSaved(false);
          return;
        }
        const r = saveDraft(window.sessionStorage, scope, slotKey, value, baseRef.current);
        setStorageOk(r.ok);
        setDraftSaved(r.ok);
        if (r.ok) written.current.set(mapKey, r.rev);
      } catch {
        setStorageOk(false);
        setDraftSaved(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
    // value 는 호출자가 메모한 스냅샷 — 매 렌더 새 객체면 호출자 책임.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeEmail, slot, enabled, debounceMs, value]);

  return { draftSaved, storageOk };
}

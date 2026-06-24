/**
 * DirtyGuard — 미저장 이탈 가드(전역). 데이터 유실 방지(unsaved-leave-guard).
 *
 * 저장 안 한 변경이 있을 때 화면(탭·날짜·소탭·카드·모달)을 떠나면 한 번 물어본다.
 *   - 인앱 이탈(탭 라우팅·날짜·채널·카드 접기·모달 닫기) → useGuardedNav()/useGuardedRouter() 로 감싸 모달.
 *   - 브라우저 닫기·새로고침 → dirty 일 때만 beforeunload(전역 1곳).
 *
 * 각 입력 컴포넌트는 useDirtyRegister() 로 dirty 일 때 {save, discard, label} 등록, 아니면 해제.
 *   isDirty = 등록 엔트리 ≥ 1. 통합 저장은 useSaveAllDirty().
 * 정본 패턴: contact 의 MeetingDirtyGuard.useDirtyGuard 를 전역 Provider 로 승격.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

/** dirty 입력 1개가 등록하는 항목. save=영속화(await), discard=편집 버림, label=사람이 읽는 이름. */
export interface DirtyEntry {
  save: () => Promise<void> | void;
  discard: () => void;
  label: string;
}

interface DirtyCtx {
  register: (id: string, entry: DirtyEntry | null) => void;
  guardedNav: (action: () => void) => void;
  saveAll: () => Promise<number>;
  /** dirty 라벨 목록 — 모달이 구독해 재렌더(ref 변경만으론 재렌더 안 됨). */
  labels: string[];
}

const Ctx = createContext<DirtyCtx>({
  register: () => {},
  guardedNav: (a) => a(),
  saveAll: async () => 0,
  labels: [],
});

/** dirty 입력 등록/해제. entry=null 이면 해제. */
export function useDirtyRegister() {
  return useContext(Ctx).register;
}
/** 인앱 이탈 액션을 감싸 dirty 면 모달, 아니면 즉시 실행. */
export function useGuardedNav() {
  return useContext(Ctx).guardedNav;
}
/** 등록 dirty 전부 저장(항목별 실패 격리, 실패 수 반환). 화면 하단 통합 저장용. */
export function useSaveAllDirty() {
  return useContext(Ctx).saveAll;
}
/**
 * dirty 일 때 {save,discard,label} 등록, 아니면 해제 — 화면별 등록 보일러플레이트(ref+effect) 제거.
 * save/discard 는 최신 클로저를 ref 로 잡아 stale 없이 호출(레지스트리에 박제돼도 안전).
 */
export function useDirtyEntry(
  id: string,
  dirty: boolean,
  save: () => Promise<void> | void,
  discard: () => void,
  label: string,
) {
  const register = useContext(Ctx).register;
  const saveRef = useRef(save);
  saveRef.current = save;
  const discardRef = useRef(discard);
  discardRef.current = discard;
  useEffect(() => {
    register(
      id,
      dirty
        ? { save: () => saveRef.current(), discard: () => discardRef.current(), label }
        : null,
    );
    return () => register(id, null);
  }, [id, dirty, label, register]);
}

/** 라우팅을 가드로 감싼 router. TabBar·페이지 이동에 사용. */
export function useGuardedRouter() {
  const { guardedNav } = useContext(Ctx);
  const router = useRouter();
  return {
    push: (href: string) => guardedNav(() => router.push(href as never)),
    replace: (href: string) => guardedNav(() => router.replace(href as never)),
  };
}

function ConfirmLeaveModal({
  labels,
  saving,
  failMsg,
  onSave,
  onDiscard,
  onCancel,
}: {
  labels: string[];
  saving: boolean;
  failMsg: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-black text-gray-900">저장하지 않고 나갈까요?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
          저장하지 않으면 입력한 내용이 사라져요.
        </p>
        {labels.length > 0 && (
          <ul className="mt-2 max-h-28 overflow-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-600">
            {labels.map((l, i) => (
              <li key={i} className="truncate">
                · {l}
              </li>
            ))}
          </ul>
        )}
        {failMsg && <p className="mt-2 text-xs font-medium text-red-600">{failMsg}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "저장 중…" : "💾 저장하고 이동"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              무시하고 이동
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 전역 미저장 가드 Provider — app/(app)/layout.tsx 에서 children + TabBar 를 감싼다. */
export default function DirtyProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef(new Map<string, DirtyEntry>());
  const [labels, setLabels] = useState<string[]>([]); // 재렌더용(모달 목록 + beforeunload 토글)
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [saving, setSaving] = useState(false);
  const [failMsg, setFailMsg] = useState("");

  const syncLabels = useCallback(() => {
    setLabels([...ref.current.values()].map((e) => e.label));
  }, []);

  const register = useCallback(
    (id: string, entry: DirtyEntry | null) => {
      if (entry) ref.current.set(id, entry);
      else ref.current.delete(id);
      syncLabels();
    },
    [syncLabels],
  );

  const guardedNav = useCallback((action: () => void) => {
    if (ref.current.size === 0) {
      action();
      return;
    }
    setPending(() => action);
  }, []);

  const saveAll = useCallback(async (): Promise<number> => {
    let fail = 0;
    for (const e of [...ref.current.values()]) {
      try {
        await e.save();
      } catch {
        fail++;
      }
    }
    return fail;
  }, []);

  // 브라우저 닫기·새로고침 — dirty 일 때만. labels 길이로 의존(레지스트리 변경마다 갱신).
  useEffect(() => {
    if (labels.length === 0) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [labels.length]);

  const onSave = async () => {
    setSaving(true);
    setFailMsg("");
    const fail = await saveAll();
    setSaving(false);
    if (fail > 0) {
      setFailMsg(`${fail}건 저장 실패 — 다시 시도해주세요`);
      return; // 이동 취소(머무름)
    }
    const a = pending;
    setPending(null);
    a?.();
  };
  const onDiscard = () => {
    for (const e of [...ref.current.values()]) e.discard();
    const a = pending;
    setPending(null);
    a?.();
  };
  const onCancel = () => {
    if (saving) return;
    setPending(null);
    setFailMsg("");
  };

  return (
    <Ctx.Provider value={{ register, guardedNav, saveAll, labels }}>
      {children}
      {pending && (
        <ConfirmLeaveModal
          labels={labels}
          saving={saving}
          failMsg={failMsg}
          onSave={onSave}
          onDiscard={onDiscard}
          onCancel={onCancel}
        />
      )}
    </Ctx.Provider>
  );
}

/**
 * MeetingDirtyGuard — 미저장 이탈 가드 (company-info-unified-save-guard / 데이터 손실 방지).
 *
 * 미팅카드가 dirty(편집됨·미저장)인 채로 화면을 떠나려 할 때 한 번 물어본다.
 *   - 인앱 이탈(채널 탭/날짜/주차 이동·카드 접기) → ConfirmLeaveModal [저장하기][무시하기]
 *   - 브라우저 이탈(닫기·새로고침) → beforeunload (각 카드가 등록)
 *
 * 페이지는 useDirtyGuard() 로 register(자식이 dirty 등록) + guardedNav(이동 래핑) +
 * confirmModal(렌더) 을 받는다. 자식(SavedItem)은 DirtyGuardContext 로 register 를 받아
 * dirty 상태 + save()/discard() 콜백을 등록한다.
 */
"use client";

import { createContext, useCallback, useRef, useState } from "react";
import { saveAllParallel } from "@/util/save-coalesce";

/** dirty 카드 1개가 등록하는 항목. save=영속화(await), discard=편집 버림. */
export interface DirtyEntry {
  save: () => Promise<void> | void;
  discard: () => void;
}

/** 자식 → 페이지 dirty 등록. entry=null 이면 해제. */
export const DirtyGuardContext = createContext<
  (id: string, entry: DirtyEntry | null) => void
>(() => {});

export function ConfirmLeaveModal({
  saving,
  onSave,
  onDiscard,
  onCancel,
}: {
  saving?: boolean;
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
        <h3 className="text-base font-black text-gray-900">
          저장하지 않고 나갈까요?
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
          업체정보가 아직 저장되지 않았어요. 저장하지 않으면 입력한 내용이
          사라집니다.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "저장 중…" : "💾 저장하기"}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            무시하기
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 페이지용 훅 — dirty 레지스트리 + 이동 가드 + 확인 모달을 캡슐화.
 * 페이지는 자식을 <DirtyGuardContext.Provider value={register}> 로 감싸고,
 * 모든 이동 액션을 guardedNav(action) 로 래핑한 뒤 {confirmModal} 을 렌더한다.
 */
export function useDirtyGuard() {
  const ref = useRef(new Map<string, DirtyEntry>());
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [saving, setSaving] = useState(false);

  const register = useCallback((id: string, entry: DirtyEntry | null) => {
    if (entry) ref.current.set(id, entry);
    else ref.current.delete(id);
  }, []);

  // 등록된 dirty 카드 전부 저장 — 통합 [저장하기]용. 병렬 실행(BBE-243, 항목별 실패 격리).
  const saveAllDirty = useCallback((): Promise<number> => saveAllParallel(
    [...ref.current.values()].map((e) => () => Promise.resolve(e.save())),
  ), []);

  // dirty 카드 없으면 즉시 진행, 있으면 확인 모달.
  const guardedNav = useCallback((action: () => void) => {
    if (ref.current.size === 0) {
      action();
      return;
    }
    setPending(() => action);
  }, []);

  const confirmModal = pending ? (
    <ConfirmLeaveModal
      saving={saving}
      onSave={async () => {
        setSaving(true);
        // saveAllDirty() 재사용(BBE-243) — 병렬 실행 + 항목별 실패 격리를 중복 구현하지 않는다.
        // 구판은 예외 무보호 for-await 라 항목 1개 실패 시 unhandled rejection 이 났었다.
        await saveAllDirty();
        setSaving(false);
        const a = pending;
        setPending(null);
        a();
      }}
      onDiscard={() => {
        for (const e of [...ref.current.values()]) e.discard();
        const a = pending;
        setPending(null);
        a();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { register, guardedNav, confirmModal, saveAllDirty };
}

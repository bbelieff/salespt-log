/**
 * BasicEditDetails — 미팅 기본 정보(날짜/시간/업체명/장소/예약비고) 자동 저장.
 * 정본: docs/design/prototypes/schedule-weekly.html `details` 섹션
 *
 * 루틴 편집은 별도 저장 버튼 없이 자동 영속화(aggressive autosave):
 * 텍스트(업체명·장소·예약비고)는 디바운스, 날짜·시간은 stage 후 그룹 blur 커밋.
 * 유효하지 않으면 보내지 않고 DirtyGuard 가 이탈을 보호한다.
 * 상태 전이(계약/완료/변경/취소)와 일정 삭제는 명시적 액션으로 유지.
 *
 * 저장 코어: components/autosave (Scope A 공유) — 본 파일은 배선만.
 * 예약 상태 카드에서만 사용 (처리완료 카드는 수정 불가).
 */
"use client";

import { useEffect, useRef } from "react";
import TimePicker15 from "@/components/ui/TimePicker15";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";

interface Initial {
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
  장소: string;
  예약비고: string;
}

interface Props {
  /** Save identity (meeting id) — queue target 에 고정. */
  targetKey: string;
  initial: Initial;
  onSave: (partial: Partial<Initial>) => Promise<void> | void;
  onDelete?: () => void;
  pending: boolean;
}

const isValidDraft = (d: Initial): boolean =>
  d.미팅날짜 !== "" &&
  d.미팅시간 !== "" &&
  d.업체명.trim() !== "" &&
  d.장소.trim() !== "";

const invalidMsg = (d: Initial): string =>
  d.미팅날짜 === "" || d.미팅시간 === ""
    ? "날짜와 시간은 비울 수 없습니다"
    : "업체명·장소는 필수입니다";

export default function BasicEditDetails({
  targetKey,
  initial,
  onSave,
  onDelete,
  pending,
}: Props) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const savedMirror = useRef(initial);
  const {
    draft,
    saved,
    status,
    error,
    dirty,
    savedAt,
    canUndo,
    update,
    stage,
    commit,
    syncServer,
    // C3: 공유 useAutosave.discard() — 큐 예약 취소 + draft=saved 강제(공유 코어 소유).
    discard,
    retry,
    flush,
    undo,
  } = useAutosave<Initial>({
    target: { kind: "schedule-basic", id: targetKey },
    initial,
    delayMs: 600,
    save: async ({ payload }) => {
      const base = savedMirror.current;
      const partial: Partial<Initial> = {};
      (Object.keys(payload) as Array<keyof Initial>).forEach((k) => {
        if (payload[k] !== base[k]) partial[k] = payload[k];
      });
      if (Object.keys(partial).length === 0) return;
      await onSaveRef.current(partial);
    },
  });
  savedMirror.current = saved;

  // 서버 refetch — clean 일 때만 재기준, 편집 중 입력은 유지.
  // (공유 syncServer 는 dirty 여도 큐 예약분을 취소해 미전송분이 고착되므로,
  // 여기서 호출 자체를 막는다 — 미해결 코어 이슈는 REPORT-C2.)
  const initialKey = JSON.stringify(initial);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    syncServer(JSON.parse(initialKey) as Initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const setText = (fn: (d: Initial) => Initial) => {
    const next = fn(draft);
    update(next, { valid: isValidDraft(next), error: invalidMsg(next) });
  };
  const setGroup = (fn: (d: Initial) => Initial) => {
    stage(fn(draft));
  };
  const commitGroup = () => commit(isValidDraft(draft), invalidMsg(draft));

  const showWarn = dirty && !isValidDraft(draft);
  const saving = pending || status === "pending";

  useDirtyEntry(
    `basic-${targetKey}`,
    dirty,
    async () => {
      if (!isValidDraft(draft)) throw new Error(invalidMsg(draft));
      commit(true);
      await flush();
    },
    // 파기는 큐 예약 취소 + draft=saved 강제인 discard() — syncServer(saved) 는
    // dirty draft 를 유지해 파기가 화면 초안을 되돌리지 못한다.
    () => discard(),
    `${draft.업체명 || "일정"} 기본정보`,
  );

  return (
    <details className="rounded-lg border border-gray-200 bg-white/60 px-3 py-2">
      <summary className="flex cursor-pointer select-none items-center gap-1 text-xs font-semibold text-gray-600">
        ✏️ 일정 수정 <span className="font-normal text-gray-400">· 날짜·시간·업체·장소·비고</span>
        {saving && (
          <span className="font-normal text-gray-400" aria-live="polite">· 저장 중…</span>
        )}
        {!saving && status === "error" && (
          <span className="font-normal text-red-500" aria-live="polite">· 저장 실패</span>
        )}
      </summary>

      <div
        className="mt-2 space-y-2"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            commitGroup();
          }
        }}
      >
        {(status === "pending" || status === "saved" || status === "error" || canUndo) && (
          <AutosaveStatus
            status={status}
            error={error}
            savedAt={savedAt}
            onRetry={retry}
            canUndo={canUndo}
            onUndo={undo}
          />
        )}
        <div className="flex gap-2">
          <div className="shrink-0" style={{ width: 130 }}>
            <label className="mb-1 block text-xs text-gray-500">미팅 날짜</label>
            <input
              type="date"
              value={draft.미팅날짜}
              onChange={(e) => setGroup((d) => ({ ...d, 미팅날짜: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-gray-500">시간</label>
            <TimePicker15
              value={draft.미팅시간}
              onChange={(v) => setGroup((d) => ({ ...d, 미팅시간: v }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">업체명</label>
          <input
            type="text"
            value={draft.업체명}
            onChange={(e) => setText((d) => ({ ...d, 업체명: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">장소</label>
          <input
            type="text"
            value={draft.장소}
            onChange={(e) => setText((d) => ({ ...d, 장소: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-600">
            <span>📝 예약비고</span>
          </label>
          <textarea
            rows={2}
            value={draft.예약비고}
            onChange={(e) => setText((d) => ({ ...d, 예약비고: e.target.value }))}
            placeholder="예: 사장님 부재 시간, 지참서류 등"
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {showWarn && (
          <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700" aria-live="polite">
            ⚠ {invalidMsg(draft)}
          </div>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="w-full rounded-lg border border-red-200 bg-white py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            🗑️ 일정 삭제
          </button>
        )}
      </div>
    </details>
  );
}

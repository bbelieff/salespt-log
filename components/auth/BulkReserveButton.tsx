/**
 * BulkReserveButton — 헤더에서 다수 trainee 선택 후 한번에 유보 처리 (2026-05-17 [A5]).
 *
 * 사용자 요청: 카드별 유보버튼 통합 + 헤더로 이동 + 카드 자리 텍스트뷰 확보.
 * 모달에 활성 trainee 체크박스 리스트 → 선택 → 확정 → 각 trainee 에
 * /api/admin/set-trainee-reserved (action=reserve) 호출.
 */
"use client";

import { useState } from "react";

interface TraineeBasic {
  email: string;
  name: string;
  cohort: string;
}

interface Props {
  trainees: TraineeBasic[];
  onDone: () => void;
}

export default function BulkReserveButton({ trainees, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(email: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0) return;
    if (
      !window.confirm(
        `선택한 ${selected.size}명을 유보 처리합니다. 계속할까요?\n(row 는 보존, 명단에서 숨김)`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const emails = Array.from(selected);
      for (const email of emails) {
        const res = await fetch("/api/admin/set-trainee-reserved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, action: "reserve" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(`${email}: ${data?.error ?? `HTTP ${res.status}`}`);
        }
      }
      setSelected(new Set());
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "유보 처리 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
        title="여러 수강생을 한 번에 유보 처리"
      >
        ✋ 유보 처리
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  ✋ 유보 처리할 수강생 선택
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  활성 명단 {trainees.length}명 중 선택 ({selected.size}명 선택됨)
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                disabled={busy}
                className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200">
              {trainees.length === 0 ? (
                <p className="p-4 text-center text-sm text-gray-400">
                  활성 수강생 없음
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {trainees.map((t) => {
                    const checked = selected.has(t.email);
                    return (
                      <li key={t.email}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors ${
                            checked ? "bg-amber-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(t.email)}
                            disabled={busy}
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-gray-900">
                              {t.name}
                            </span>
                            <span className="ml-1.5 text-[11px] text-gray-500">
                              · {t.cohort}
                            </span>
                            <span className="ml-1.5 break-all text-[10px] text-gray-400">
                              {t.email}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                disabled={busy}
                className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy || selected.size === 0}
                className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-gray-300"
              >
                {busy
                  ? "처리중..."
                  : selected.size === 0
                    ? "선택 없음"
                    : `✋ ${selected.size}명 유보`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

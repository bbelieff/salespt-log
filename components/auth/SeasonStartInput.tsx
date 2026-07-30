/**
 * SeasonStartInput — (아레나) 시즌 개강일 입력 (AR-2b, admin 전용).
 *
 * `/admin/cohorts` 의 **아레나 시즌 행**(label "A1"/"A2")에만 노출된다.
 * 여기 넣은 날짜가 **전광판 시즌 판정 정본**(cohorts J열 seasonStartISO).
 *  - 비어 있으면 전광판은 시즌 번호를 표시하지 않고("아레나") 집계 스코프도 걸지 않는다
 *    → 데이터를 감추지 않는다.
 *  - 날짜를 넣으면 **그 날부터** 해당 시즌으로 전환된다(개막 전엔 이전 시즌 유지).
 * 참가자별 registry K(courseStartISO)는 시트 템플릿 O1 이 스탬프돼 출처가 불확실하므로
 * 시즌 판정에 쓰지 않는다 — 그래서 이 입력이 필요하다.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeasonStartInput({
  label,
  initialISO,
  disabled = false,
}: {
  /** 시즌 레벨 라벨 "A{n}". */
  label: string;
  /** 현재 저장된 개강일(빈 문자열 = 미정). */
  initialISO: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialISO);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = value !== initialISO;

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/set-season-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, seasonStartISO: value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.hint ?? d.error ?? `HTTP ${res.status}`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="text-[11px] font-bold text-purple-700" htmlFor={`ss-${label}`}>
        시즌 개강일
      </label>
      <input
        id={`ss-${label}`}
        type="date"
        value={value}
        disabled={disabled || busy}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs num-mono disabled:bg-gray-50"
      />
      {!disabled && dirty && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? "저장중…" : "저장"}
        </button>
      )}
      {!disabled && value !== "" && !dirty && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="rounded-full border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50"
          title="개강일을 비우면 전광판이 시즌 번호를 표시하지 않습니다(데이터는 그대로)."
        >
          비우기
        </button>
      )}
      {saved && <span className="text-[11px] font-bold text-green-600">저장됨</span>}
      {value === "" && (
        <span className="text-[11px] text-gray-400">
          미정 — 전광판에 시즌 번호가 표시되지 않아요
        </span>
      )}
      {err && <span className="text-[11px] font-medium text-red-600">{err}</span>}
    </div>
  );
}

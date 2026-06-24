/**
 * GeneralEventModal — 캘린더 일반이벤트 생성 (consultation-log §4-3·§4-4).
 *
 * 입력: 카테고리(기존/기타)·이벤트명·업체명('기타'는 선택)·상세·날짜·시간 →
 * POST /api/todos (type="일반", contractRef 빈값, showOnCalendar=true) → onCreated.
 * 첫 추가 시 경고 모달(+"다시 보지 않기" localStorage hideGeneralEventHint).
 */
"use client";

import { useState } from "react";
import { useDirtyEntry } from "@/components/DirtyGuard";

const HINT_KEY = "hideGeneralEventHint";
const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";

interface Props {
  defaultDate: string; // YYYY-MM-DD (선택일)
  onClose: () => void;
  onCreated: () => void;
}

export default function GeneralEventModal({ defaultDate, onClose, onCreated }: Props) {
  const [분류, set분류] = useState<"기존" | "기타">("기존");
  const [제목, set제목] = useState("");
  const [업체명, set업체명] = useState("");
  const [상세, set상세] = useState("");
  const [날짜, set날짜] = useState(defaultDate);
  const [시각, set시각] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 경고 모달 — 저장 직전 1회 (localStorage 로 영구 숨김 가능).
  const [hint, setHint] = useState(false);
  const [hideForever, setHideForever] = useState(false);

  const valid = 제목.trim().length >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(날짜);

  // 검증·API 실패 시 throw 하는 코어 — 가드 save 가 호출해 실패 시 이동을 막는다.
  async function doSubmit() {
    if (!valid) throw new Error("제목과 날짜를 입력해주세요.");
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractRef: "",
        institutionRef: "",
        업체명: 업체명.trim(),
        type: "일반",
        분류,
        제목: 제목.trim(),
        예정일자: 날짜,
        예정시각: 시각,
        상세: 상세.trim(),
        showOnCalendar: true,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
    onCreated();
    onClose();
  }
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await doSubmit();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  // 미저장 이탈 가드 — 입력이 있으면 dirty. 저장하고 이동=doSubmit(검증 throw 시 차단), 무시=onClose(언마운트 폐기).
  useDirtyEntry(
    "calendar-general-event",
    제목.trim() !== "" || 업체명.trim() !== "" || 상세.trim() !== "" ||
      시각 !== "" || 날짜 !== defaultDate || 분류 !== "기존",
    doSubmit,
    onClose,
    `일반이벤트${제목.trim() ? ` · ${제목.trim()}` : ""}`,
  );

  function handleSave() {
    if (!valid || busy) return;
    const hidden =
      typeof window !== "undefined" && localStorage.getItem(HINT_KEY) === "1";
    if (!hidden) {
      setHint(true); // 첫 추가 경고 (§4-4)
      return;
    }
    void submit();
  }

  function confirmHint() {
    if (hideForever) localStorage.setItem(HINT_KEY, "1");
    setHint(false);
    void submit();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900">일반이벤트 추가</h3>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1">
            {(["기존", "기타"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set분류(c)}
                className={`h-8 rounded-full text-xs font-bold ${
                  분류 === c ? "bg-white text-teal-700 shadow-sm" : "text-gray-500"
                }`}
              >
                {c === "기존" ? "기존 고객" : "기타(개인)"}
              </button>
            ))}
          </div>
          <input className={inputCls} placeholder="이벤트명 *" value={제목} onChange={(e) => set제목(e.target.value)} />
          <input
            className={inputCls}
            placeholder={분류 === "기존" ? "업체명" : "업체명 (선택)"}
            value={업체명}
            onChange={(e) => set업체명(e.target.value)}
          />
          <textarea className={inputCls} rows={2} placeholder="상세 내용" value={상세} onChange={(e) => set상세(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={inputCls} value={날짜} onChange={(e) => set날짜(e.target.value)} />
            <input type="time" className={inputCls} value={시각} onChange={(e) => set시각(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button
            type="button"
            disabled={!valid || busy}
            onClick={handleSave}
            className="w-full rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: "#0d9488" }} // tokens 일반이벤트 teal
          >
            {busy ? "저장 중…" : "캘린더에 추가"}
          </button>
        </div>
      </div>

      {hint && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl">
            <p className="text-sm leading-relaxed text-gray-700">
              일반이벤트로 추가하는 일정은 다른 탭에 연동되지 않습니다. 기존업체
              관련 실적은 아레나에 포함되지 않지만 캘린더에서 관리할 수 있습니다.
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={hideForever}
                onChange={(e) => setHideForever(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-600"
              />
              다시 보지 않기
            </label>
            <button
              type="button"
              onClick={confirmHint}
              className="mt-3 w-full rounded-lg bg-gray-900 py-2 text-sm font-bold text-white hover:bg-black"
            >
              확인하고 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

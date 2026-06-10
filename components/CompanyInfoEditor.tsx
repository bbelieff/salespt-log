/**
 * CompanyInfoEditor — 미팅 업체정보(04 T~AN) 드롭다운 + 팝업 편집.
 * 정본: consultation-log-and-calendar.md §3. contact/schedule/payment 공용.
 *
 * value(현재 업체정보) → draft 편집 → onSave(전체 CompanyInfo) → 호출부가 patch({업체정보}).
 * [업체]12 + [대표자]8 + 커스텀(필드추가+). 빈값 허용.
 */
"use client";

import { useState } from "react";
import { CompanyInfo } from "@/types";

type CI = CompanyInfo;
type Grp = "업체" | "대표자";

// 키(식별자) → 표시 라벨.
const 업체_FIELDS: [keyof CI, string][] = [
  ["개업일", "개업일"],
  ["사업자구분", "사업자구분"],
  ["사업자등록번호", "사업자등록번호"],
  ["소재지", "소재지"],
  ["소유여부", "소유여부"],
  ["업종주생산품목", "업종/주생산품목"],
  ["과년도매출", "과년도 매출"],
  ["금년도매출", "금년도 매출"],
  ["기대출사업자", "기대출(사업자)"],
  ["사대보험직원", "4대보험 직원"],
  ["특허및인증", "특허/인증"],
  ["업체기타메모", "기타 메모"],
];
const 대표자_FIELDS: [keyof CI, string][] = [
  ["대표자이름", "대표자 이름"],
  ["연락처통신사", "연락처/통신사"],
  ["신용점수", "신용점수"],
  ["기대출개인", "기대출(개인)"],
  ["자택주소지", "자택 주소지"],
  ["대표소유여부", "소유여부"],
  ["동종업계경력", "동종업계 경력"],
  ["대표기타메모", "기타 메모"],
];

const emptyCi = (): CI => CompanyInfo.parse({});
const inputCls =
  "w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-brand-red focus:outline-none";

interface Props {
  value?: CI;
  onSave: (ci: CI) => void;
  busy?: boolean;
}

export default function CompanyInfoEditor({ value, onSave, busy }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState<CI>(() => ({ ...emptyCi(), ...value }));
  const [newLabel, setNewLabel] = useState<Record<Grp, string>>({
    업체: "",
    대표자: "",
  });

  const set = (k: keyof CI, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }) as CI);
  const customOf = (g: Grp): Record<string, string> => draft.커스텀?.[g] ?? {};
  const setCustom = (g: Grp, label: string, v: string) =>
    setDraft((d) => ({
      ...d,
      커스텀: {
        업체: d.커스텀?.업체 ?? {},
        대표자: d.커스텀?.대표자 ?? {},
        [g]: { ...(d.커스텀?.[g] ?? {}), [label]: v },
      },
    }));
  const removeCustom = (g: Grp, label: string) =>
    setDraft((d) => {
      const next = { ...(d.커스텀?.[g] ?? {}) };
      delete next[label];
      return {
        ...d,
        커스텀: { 업체: d.커스텀?.업체 ?? {}, 대표자: d.커스텀?.대표자 ?? {}, [g]: next },
      };
    });
  const addCustom = (g: Grp) => {
    const label = newLabel[g].trim();
    if (!label) return;
    setCustom(g, label, "");
    setNewLabel((n) => ({ ...n, [g]: "" }));
  };

  const filled = [...업체_FIELDS, ...대표자_FIELDS].filter(
    ([k]) => String(draft[k] ?? "").trim() !== "",
  ).length;
  const summary = draft.대표자이름?.trim()
    ? `${draft.대표자이름} 외 ${filled}항목`
    : filled > 0
      ? `${filled}항목 입력`
      : "미입력";

  const save = () => onSave(draft);

  const group = (g: Grp, fields: [keyof CI, string][]) => (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold text-gray-500">[{g}]</div>
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map(([k, label]) => (
          <label key={String(k)} className="block">
            <span className="text-[10px] text-gray-400">{label}</span>
            <input
              className={inputCls}
              value={String(draft[k] ?? "")}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
        {Object.entries(customOf(g)).map(([label, v]) => (
          <label key={`c-${label}`} className="block">
            <span className="flex items-center justify-between text-[10px] text-purple-500">
              {label}
              <button
                type="button"
                onClick={() => removeCustom(g, label)}
                className="text-gray-300 hover:text-red-500"
              >
                ✕
              </button>
            </span>
            <input
              className={inputCls}
              value={v}
              onChange={(e) => setCustom(g, label, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          className={`${inputCls} flex-1`}
          placeholder="필드 추가+ (라벨)"
          value={newLabel[g]}
          onChange={(e) => setNewLabel((n) => ({ ...n, [g]: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addCustom(g)}
        />
        <button
          type="button"
          onClick={() => addCustom(g)}
          className="shrink-0 rounded-md border border-purple-200 px-2 text-[11px] text-purple-600 hover:bg-purple-50"
        >
          추가
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="space-y-3">
      {group("업체", 업체_FIELDS)}
      {group("대표자", 대표자_FIELDS)}
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs"
      >
        <span className="font-semibold text-gray-700">
          🏢 업체정보{" "}
          <span className="font-normal text-gray-400">{summary}</span>
        </span>
        <span className="text-gray-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 px-2.5 py-2">
          {body}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-md bg-gray-900 py-1.5 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="rounded-md border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              팝업 편집
            </button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="mt-8 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">업체정보 편집</h3>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-full px-2 text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            {body}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  save();
                  setModal(false);
                }}
                disabled={busy}
                className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
              >
                {busy ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

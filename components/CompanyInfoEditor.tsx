/**
 * CompanyInfoEditor — 미팅 업체정보(04 T~AN + AQ~AS) 드롭다운 + 팝업 편집.
 * 정본: consultation-log-and-calendar.md §3-2 (2026-06-11 혼합 그리드 확정).
 * contact/schedule/payment 공용 — 탭별 분기 금지.
 *
 * 반응형 3단계: 기본(<390) 1열 강하 · sm(390+) 혼합 그리드(2열, short=span1,
 * long=span2) · 2xl(768+) [업체]|[대표자] 그룹 좌우 2단(모달·PC 카드).
 * placeholder = 필드 안 옅은 안내(별도 설명 줄 없음). 기대출 2필드 = textarea
 * 자동높이(줄 수 따라) — 시트에 \n 그대로 저장.
 */
"use client";

import { useState } from "react";
import { CompanyInfo } from "@/types";

type CI = CompanyInfo;
type Grp = "업체" | "대표자";

// 필드 정의: [키, 라벨, placeholder, span(1|2), multiline?]
type FieldDef = [keyof CI, string, string, 1 | 2, boolean?];

// §3-2 확정 배치 순서 그대로.
const 업체_DEFS: FieldDef[] = [
  ["개업일", "개업일", "25.01.24", 1],
  ["사업자구분", "사업자구분", "개인/법인", 1],
  ["사업자등록번호", "사업자등록번호", "000-00-0000", 1],
  ["사대보험직원", "4대보험 직원", "0명 + 프리0명", 1],
  ["소재지", "소재지", "주소지", 2],
  ["소유여부", "소유여부", "자가 / 임차 : 보 00만, 월 00만", 2],
  ["업종주생산품목", "업종/주생산품목", "제조/필름 등", 2],
  ["금년도매출", "금년도 매출", "26' 6월 100백만", 1],
  ["과년도매출", "과년도 매출 Y-1", "25' 250백만", 1],
  ["과년도매출Y2", "과년도 매출 Y-2", "24' 148백만", 1],
  ["과년도매출Y3", "과년도 매출 Y-3", "23' 70백만", 1],
  ["기대출사업자", "기대출 사업자", "신보 100백만\n재단 50백만\n중진공 150백만", 2, true],
  ["특허및인증", "특허 및 인증", "특허, ISO, 연구소, 벤처, 메인/이노비즈 등", 2],
  ["업체기타메모", "기타메모", "자유 메모", 2, true],
];
const 대표자_DEFS: FieldDef[] = [
  ["대표자이름", "이름", "이름", 1],
  ["대표자생년월일", "생년월일", "88.01.24", 1],
  ["신용점수", "신용점수(KCB/NCB)", "919/855", 1],
  ["연락처통신사", "연락처/통신사", "010-0000-0000(통신사)", 2],
  ["기대출개인", "기대출 개인", "캐피탈 38백만\n카드론 10백만\n00은행 20백만", 2, true],
  ["자택주소지", "자택주소지", "주소지", 2],
  ["대표소유여부", "소유여부", "자가 / 임차 : 보 00만, 월 00만", 2],
  ["동종업계경력", "동종업계경력", "연차 및 경력기록", 2],
  ["대표기타메모", "기타메모", "자유 메모", 2, true],
];

const emptyCi = (): CI => CompanyInfo.parse({});
const inputCls =
  // 위계(§3-2 contrast): 값 gray-900 / 테두리 gray-300 / 예시(placeholder)만 gray-300 옅게.
  "w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-300 focus:border-brand-red focus:outline-none";

interface Props {
  value?: CI;
  onSave: (ci: CI) => void;
  busy?: boolean;
  /** 있으면 "업체정보생성(TXT)" 버튼 노출 — O 폴더에 1본 덮어쓰기 (§3-3). */
  txtCompanyName?: string;
}

export default function CompanyInfoEditor({
  value,
  onSave,
  busy,
  txtCompanyName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState<CI>(() => ({ ...emptyCi(), ...value }));
  const [newLabel, setNewLabel] = useState<Record<Grp, string>>({
    업체: "",
    대표자: "",
  });
  const [txtMsg, setTxtMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const [txtBusy, setTxtBusy] = useState(false);

  async function exportTxt() {
    if (!txtCompanyName || txtBusy) return;
    setTxtBusy(true);
    setTxtMsg(null);
    try {
      const res = await fetch("/api/company-info/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 업체명: txtCompanyName, 업체정보: draft }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setTxtMsg({
          ok: true,
          text: d.updated ? "TXT 갱신 완료(1본 유지)" : "TXT 생성 완료",
          link: d.webViewLink || undefined,
        });
      } else {
        setTxtMsg({ ok: false, text: d.error ?? `실패 (HTTP ${res.status})` });
      }
    } catch (e) {
      setTxtMsg({ ok: false, text: e instanceof Error ? e.message : "네트워크 오류" });
    } finally {
      setTxtBusy(false);
    }
  }

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

  const filled = [...업체_DEFS, ...대표자_DEFS].filter(
    ([k]) => String(draft[k] ?? "").trim() !== "",
  ).length;
  const summary = draft.대표자이름?.trim()
    ? `${draft.대표자이름} 외 ${filled}항목`
    : filled > 0
      ? `${filled}항목 입력`
      : "미입력";

  const save = () => onSave(draft);

  // 한 필드 입력 — multiline=textarea(줄 수 따라 자동높이), 아니면 input.
  const field = ([k, label, ph, span, multi]: FieldDef) => {
    const v = String(draft[k] ?? "");
    return (
      <label key={String(k)} className={span === 2 ? "block sm:col-span-2" : "block"}>
        <span className="text-[10px] font-medium text-gray-800">{label}</span>
        {multi ? (
          <textarea
            className={`${inputCls} resize-none leading-5`}
            rows={Math.max(2, v.split("\n").length)}
            placeholder={ph}
            value={v}
            onChange={(e) => set(k, e.target.value)}
          />
        ) : (
          <input
            className={inputCls}
            placeholder={ph}
            value={v}
            onChange={(e) => set(k, e.target.value)}
          />
        )}
      </label>
    );
  };

  // 그룹 = 혼합 그리드 (기본 1열 → sm 2열; span2 필드는 전폭).
  const group = (g: Grp, defs: FieldDef[]) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-900">
        <span className="h-3 w-1 rounded-sm bg-brand-red" aria-hidden />
        [{g}]
      </div>
      {/* 신용점수(span1) 옆 빈 칸은 grid auto-flow 가 자연 확보 — 다음 항목(연락처)이
          span2 라 줄바꿈되며 col2 가 빈다 (§3-2 배치표). */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {defs.map(field)}
        {Object.entries(customOf(g)).map(([label, v]) => (
          <label key={`c-${label}`} className="block sm:col-span-2">
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

  // 2xl(768+)에서 [업체]|[대표자] 좌우 2단 — 그 미만은 세로.
  const body = (
    <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2 2xl:gap-4">
      {group("업체", 업체_DEFS)}
      {group("대표자", 대표자_DEFS)}
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
            {txtCompanyName && (
              <button
                type="button"
                onClick={exportTxt}
                disabled={txtBusy}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {txtBusy ? "생성 중…" : "📄 업체정보생성"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setModal(true)}
              className="rounded-md border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              팝업 편집
            </button>
          </div>
          {txtMsg && (
            <p className={`text-[11px] ${txtMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
              {txtMsg.ok ? "✓" : "✕"} {txtMsg.text}
              {txtMsg.link && (
                <>
                  {" · "}
                  <a href={txtMsg.link} target="_blank" rel="noopener noreferrer" className="underline">
                    파일 열기
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          {/* PC(2xl+) 모달은 좌우 2단이 펼쳐지도록 넓게 */}
          <div className="mt-8 mb-8 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl 2xl:max-w-3xl">
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

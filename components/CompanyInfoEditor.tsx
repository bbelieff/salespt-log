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

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CompanyInfo } from "@/types";
import { formatPhone } from "@/lib/format/phone";

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
  /** 사용자 편집마다 호출 — 부모(파란 저장)가 미저장 드래프트를 함께 영속화하도록. */
  onChange?: (ci: CI) => void;
  /** true 면 자체 인라인 '저장' 버튼 숨김 — 영속화는 부모(파란 저장)가 담당. */
  hideSave?: boolean;
}

export default function CompanyInfoEditor({
  value,
  onSave,
  busy,
  txtCompanyName,
  onChange,
  hideSave,
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

  // 사용자 편집(draft 변경)마다 부모에 통지 — 마운트(초기값)는 건너뛴다(가짜 dirty 방지).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onChangeRef.current?.(draft);
  }, [draft]);

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
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setTxtMsg({ ok: false, text: d.error ?? `실패 (HTTP ${res.status})` });
        return;
      }
      // 드라이브 미사용 — 응답(TXT)을 브라우저로 바로 다운로드.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `업체정보_${txtCompanyName.trim()}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setTxtMsg({ ok: true, text: "TXT 다운로드 완료" });
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
    // 연락처통신사 = "010-1234-5678(SKT)" **합본 자유문자열**. 매 키 입력 마스킹은 괄호부를
    // 깨뜨리므로, blur 시에만 formatPhone 으로 정규화한다(선행 숫자 런만 포맷·접미 보존).
    // 기존 저장분(하이픈 없음·시트가 숫자로 먹어 선행 0 소실)도 이때 흡수된다.
    const isPhone = String(k) === "연락처통신사";
    const onBlurNormalize = isPhone
      ? () => {
          const next = formatPhone(v);
          if (next !== v) set(k, next);
        }
      : undefined;
    return (
      <label key={String(k)} className={span === 2 ? "block sm:col-span-2" : "block"}>
        <span className="text-xs font-medium text-gray-800">{label}</span>
        {ph && (
          <span className="mt-0.5 block break-keep text-[11px] leading-tight text-gray-400">
            {ph}
          </span>
        )}
        {multi ? (
          <textarea
            className={`${inputCls} resize-none leading-5`}
            rows={Math.max(2, v.split("\n").length)}
            placeholder={undefined}
            value={v}
            onChange={(e) => set(k, e.target.value)}
          />
        ) : (
          <input
            className={inputCls}
            placeholder={undefined}
            inputMode={isPhone ? "tel" : undefined}
            value={v}
            onChange={(e) => set(k, e.target.value)}
            onBlur={onBlurNormalize}
          />
        )}
      </label>
    );
  };

  // 그룹 = 흰 카드(틴트 배경 위) + 혼합 그리드 (기본 1열 → sm 2열; span2 필드는 전폭).
  const group = (g: Grp, defs: FieldDef[]) => (
    <div className="space-y-1.5 rounded-md border border-gray-100 bg-white p-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5 text-xs font-bold text-gray-900">
        <span className="h-3 w-1 rounded-sm bg-brand-red" aria-hidden />
        [{g}]
      </div>
      {/* 신용점수(span1) 옆 빈 칸은 grid auto-flow 가 자연 확보 — 다음 항목(연락처)이
          span2 라 줄바꿈되며 col2 가 빈다 (§3-2 배치표). */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {defs.map(field)}
        {Object.entries(customOf(g)).map(([label, v]) => (
          <label key={`c-${label}`} className="block sm:col-span-2">
            <span className="flex items-center justify-between text-xs text-purple-500">
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
      {/* 헤더: 제목+요약(클릭=접기/펴기) 좌, 액션버튼(편집·저장) 우 — '따로 저장' 인지 강화. */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-xs"
        >
          <span className="truncate font-semibold text-gray-700">
            🏢 업체정보{" "}
            <span className="font-normal text-gray-400">{summary}</span>
          </span>
          <span className="shrink-0 text-gray-400">{open ? "▴" : "▾"}</span>
        </button>
        {open && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModal(true)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              편집
            </button>
            {!hideSave && (
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-md bg-brand-red px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "저장 중…" : "저장"}
              </button>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-gray-100 bg-slate-50 px-2.5 py-2">
          {body}
          {txtCompanyName && (
            <div className="flex">
              <button
                type="button"
                onClick={exportTxt}
                disabled={txtBusy}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {txtBusy ? "생성 중…" : "📄 업체정보생성(TXT)"}
              </button>
            </div>
          )}
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

      {/* overflow-hidden·sticky 부모(실무수납 상세패널)에 fixed 모달이 클리핑되는 문제 →
          document.body 로 portal 해 화면 전체를 덮는다. (컨택탭엔 해당 부모 없어 무관) */}
      {modal &&
        typeof document !== "undefined" &&
        createPortal(
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
          </div>,
          document.body,
        )}
    </div>
  );
}

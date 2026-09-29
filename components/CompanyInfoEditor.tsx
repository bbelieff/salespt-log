/**
 * CompanyInfoEditor — 미팅 업체정보(04 T~AN + AQ~AS + AU~CD) 드롭다운 + 팝업 편집.
 * 정본: consultation-log-and-calendar.md §3-2 (2026-06-11 혼합 그리드 확정)
 *       + company-info-restructure · company-finance-won-grid(belie 2026-09-28).
 * contact/schedule/payment 공용 — 탭별 분기 금지.
 *
 * 섹션 순서 = [대표자] → [기업정보] → [재무]. 반응형 3단계: 기본(<390) 1열 강하 · sm(390+) 혼합
 * 그리드(2열, short=span1, long=span2) · 2xl(768+) [대표자]|[기업정보] 그룹 좌우 2단(모달·PC 카드).
 * [재무] = 두 그룹 아래 전폭 섹션, 같은 카드·그리드 규격(커스텀 추가 없음). 금액은 백만원.
 * 필드 정의 = company-info-defs.ts, 칸 그리기 = components/company-info/*(CompanyInfoItem).
 * 저장 직전(apply) 연도별 합계·매출증가율·재무 비율·기준 연도·주민등록번호 앞자리를 다시 채운다
 * (deriveCompanyInfo) — 직접 입력·문서 자동입력 어느 경로든 같은 값이 저장된다. 열기만 해선 저장 없음.
 * 기업정보 그룹의 커스텀 저장 키는 "업체" 그대로.
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CompanyInfo } from "@/types";
import { useAutosave } from "@/components/autosave/useAutosave";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { resolveBaseYear } from "@/util/company-sales";
import { companyInfoForExport, deriveCompanyInfo } from "@/service/company-finance";
import {
  type EditorItem,
  companyInfoFieldList,
  기업정보_ITEMS,
  대표자_ITEMS,
  재무_ITEMS,
} from "./company-info-defs";
import { inputCls } from "./company-info/CompanyInfoField";
import CompanyInfoItem from "./company-info/CompanyInfoItem";
import CompanyDocAutofillButton from "./company-doc/CompanyDocAutofillButton";
import FontScaleControl from "./FontScaleControl";
import { useFontStep } from "./font-scale/useFontStep";
import { fontScaleOf } from "@/util/font-scale";

type CI = CompanyInfo;
type Grp = "업체" | "대표자";

const emptyCi = (): CI => CompanyInfo.parse({});

interface Props {
  value?: CI;
  /** 단독 모드 자동 저장 영속화(ACK 후에만 저장 표시). 임베드(hideSave)에서는 호출하지 않음. */
  onSave: (ci: CI) => Promise<void> | void;
  busy?: boolean;
  /** 있으면 "업체정보생성(TXT)" 버튼 노출 — O 폴더에 1본 덮어쓰기 (§3-3). */
  txtCompanyName?: string;
  /** 자동 저장 라우팅용 안정 레코드 신원(미팅 id·계약 행키 등).
   * txtCompanyName 은 개명 시 바뀌는 표시명이라 신원으로 쓰면 안 된다 —
   * 빠른 대상 전환·개명 때 다른 레코드로 필드가 전송되는 것을 막는다.
   * additive optional: 생략 시 기존 동작(txtCompanyName ?? "standalone") — A 소유
   * contact 호출자 서명 변경 없음. 대상 전환 시 부모가 key={identityKey} 로
   * 리마운트하면 진행 중 저장이 이전 대상으로 전송되지 않는다. */
  identityKey?: string;
  /** 사용자 편집마다 호출 — 부모(파란 저장)가 미저장 드래프트를 함께 영속화하도록. */
  onChange?: (ci: CI) => void;
  /** true 면 자체 자동 저장 없음 — 영속화는 부모가 담당(중복 요청 방지). */
  hideSave?: boolean;
  /** PC 실무/수납의 다른 1레벨 섹션과 같은 헤더 규격. */
  desktopHeading?: boolean;
  splitInline?: boolean;
}

export default function CompanyInfoEditor({
  value,
  onSave,
  busy,
  txtCompanyName,
  identityKey,
  onChange,
  hideSave,
  desktopHeading,
  splitInline = false,
}: Props) {
  const [open, setOpen] = useState(hideSave === true);
  const [modal, setModal] = useState(false);
  const [newLabel, setNewLabel] = useState<Record<Grp, string>>({
    업체: "",
    대표자: "",
  });
  const [txtMsg, setTxtMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const [txtBusy, setTxtBusy] = useState(false);
  // 매출 기준 연도가 비었을 때 쓰는 오늘 — 편집기를 연 날(렌더마다 바뀌지 않게 고정).
  const [today] = useState(() => new Date());
  // 패널·모달이 같은 필드를 동시에 그리므로 위치(where)까지 넣어 id 충돌을 막는다.
  const uid = useId();

  // 단독 모드는 자동 저장, 임베드는 stage 전용(부모가 영속화 — 중복 요청 없음).
  const auto = !hideSave;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const {
    draft,
    status,
    error,
    dirty,
    savedAt,
    canUndo,
    update,
    stage,
    commit,
    syncServer,
    retry,
    undo,
  } = useAutosave<CI>({
    target: { kind: "company-info", key: identityKey ?? txtCompanyName ?? "standalone" },
    initial: { ...emptyCi(), ...value },
    delayMs: 700,
    save: ({ payload }) => Promise.resolve(onSaveRef.current(payload)),
  });

  // 사용자 편집마다 부모에 통지 — 마운트·재기준(동일값)은 건너뛴다.
  const mounted = useRef(false);
  const lastNotified = useRef<string | null>(null);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const key = JSON.stringify(draft);
    if (lastNotified.current === key) return;
    lastNotified.current = key;
    onChangeRef.current?.(draft);
  }, [draft]);

  // 서버값 변경 — clean 일 때만 재기준, 편집 중 입력은 유지.
  // (공유 syncServer 는 dirty 여도 큐 예약분은 취소하므로, 여기서 호출 자체를
  // 막아야 진행 중 자동 저장이 유실되지 않는다 — 미해결 코어 이슈는 REPORT-C2.)
  const valueKey = JSON.stringify(value ?? null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    const server = { ...emptyCi(), ...(JSON.parse(valueKey) as Partial<CI>) } as CI;
    syncServer(server);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  async function exportTxt() {
    if (!txtCompanyName || txtBusy) return;
    setTxtBusy(true);
    setTxtMsg(null);
    try {
      const res = await fetch("/api/company-info/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 아직 편집 전이라 합계·증가율·비율 칸이 비어 있어도 TXT 엔 저장할 때와 같은 계산값이 들어가게.
        body: JSON.stringify({ 업체명: txtCompanyName, 업체정보: companyInfoForExport(draft, today) }),
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

  // 모든 편집(직접 입력·선택·문서 자동입력)이 지나는 한 곳 — 합계·증가율·비율 등을 여기서 다시 채운다.
  const apply = (fn: (d: CI) => CI) => {
    const next = deriveCompanyInfo(draft, fn(draft), today);
    if (auto) update(next);
    else stage(next);
  };
  const set = (k: keyof CI, v: string) =>
    apply((d) => ({ ...d, [k]: v }) as CI);
  const patch = (p: Partial<CI>) => apply((d) => ({ ...d, ...p }));
  const customOf = (g: Grp): Record<string, string> => draft.커스텀?.[g] ?? {};
  const setCustom = (g: Grp, label: string, v: string) =>
    apply((d) => ({
      ...d,
      커스텀: {
        업체: d.커스텀?.업체 ?? {},
        대표자: d.커스텀?.대표자 ?? {},
        [g]: { ...(d.커스텀?.[g] ?? {}), [label]: v },
      },
    }));
  const removeCustom = (g: Grp, label: string) =>
    apply((d) => {
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

  const filled = companyInfoFieldList(resolveBaseYear(draft.매출기준연도, today)).filter(
    ([k]) => String(draft[k] ?? "").trim() !== "",
  ).length;
  const summary = draft.대표자이름?.trim()
    ? `${draft.대표자이름} 외 ${filled}항목`
    : filled > 0
      ? `${filled}항목 입력`
      : "미입력";

  const closeModal = () => {
    if (auto) commit(true);
    setModal(false);
  };

  // 한 항목 그리기 — components/company-info/CompanyInfoItem.tsx.
  const item = (it: EditorItem, i: number, inline: boolean, where: string) => (
    <CompanyInfoItem
      key={i}
      it={it}
      draft={draft}
      inline={inline}
      idBase={`${uid}-${where}`}
      today={today}
      onField={set}
      onPatch={patch}
    />
  );

  // 그룹 = 흰 카드(틴트 배경 위) + 혼합 그리드 (기본 1열 → sm 2열; span2 필드는 전폭).
  // g = 커스텀 필드 그룹(업체/대표자). 재무처럼 커스텀이 없는 그룹은 null.
  const group = (
    title: string,
    g: Grp | null,
    items: EditorItem[],
    inline: boolean,
    where: string,
  ) => (
    <div
      className="min-w-0 space-y-1.5 rounded-md border border-gray-100 bg-white p-2.5 shadow-sm"
      role="group"
      aria-label={title}
    >
      <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5 text-xs font-bold text-gray-900">
        <span className="h-3 w-1 rounded-sm bg-brand-red" aria-hidden />
        [{title}]
      </div>
      {/* 신용점수(span1) 옆 빈 칸은 grid auto-flow 가 자연 확보 — 다음 항목(연락처)이
          span2 라 줄바꿈되며 col2 가 빈다 (§3-2 배치표). */}
      <div className={inline ? "grid grid-cols-1 gap-1.5" : "grid grid-cols-1 gap-1.5 sm:grid-cols-2"}>
        {items.map((it, i) => item(it, i, inline, where))}
        {g && Object.entries(customOf(g)).map(([label, v]) => (
          <label key={`c-${label}`} className={inline ? "block" : "block sm:col-span-2"}>
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
      {g && (
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
            className="shrink-0 rounded-md border border-purple-200 px-2 text-px-11 text-purple-600 hover:bg-purple-50"
          >
            추가
          </button>
        </div>
      )}
    </div>
  );

  // PC 상세에서만 너비 비율을 따른다. 편집 팝업은 원래 반응형 배치를 유지한다.
  // 순서 = [대표자] → [기업정보] → [재무](두 그룹 아래 전폭 — 모든 단 너비 걸침).
  // 기업정보의 커스텀 저장 키는 "업체"(기존 데이터 호환).
  const body = (inline: boolean, where: "panel" | "modal") => (
    <div className={desktopHeading ? inline ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 2xl:grid-cols-2 2xl:gap-4"}>
      {group("대표자", "대표자", 대표자_ITEMS, inline, where)}
      {group("기업정보", "업체", 기업정보_ITEMS, inline, where)}
      {/* PC 상세 2단(inline)에서 [재무] 는 두 단 전폭이라 내부도 2열(짧은 칸 짝) — 1열이면 13칸이
          전폭으로 길게 늘어진다. 그 외는 대표자/기업정보와 같은 규격. */}
      <div className={desktopHeading ? inline ? "col-span-2 min-w-0" : "min-w-0" : "min-w-0 2xl:col-span-2"}>
        {group("재무", null, 재무_ITEMS, inline && !desktopHeading, where)}
      </div>
    </div>
  );

  const [fontStep, setFontStep] = useFontStep("company-info");
  const fontControl = <FontScaleControl step={fontStep} onChange={setFontStep} label="업체정보" />;
  const ciSaving = busy || (auto && status === "pending");
  return (
    // 글자 크기 단계(belie 2026-09-29 — 업체정보는 작게 느껴져 +−). 글자만 커지고 배치는 그대로.
    <div className="rounded-lg border border-gray-200 bg-white" style={{ ["--font-scale" as string]: String(fontScaleOf(fontStep)) }}>
      <div className={`flex items-center justify-between gap-2 ${desktopHeading ? "px-3 py-2" : "px-2.5 py-1.5"}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex min-w-0 flex-1 items-center gap-1.5 ${desktopHeading ? "text-sm" : "text-xs"}`}
        >
          <span className={`truncate ${desktopHeading ? "font-bold text-slate-800" : "font-semibold text-gray-700"}`}>
            🏢 업체정보{" "}
            <span className="font-normal text-gray-400">{summary}</span>
          </span>
          <span className="shrink-0 text-gray-400">{open ? "▴" : "▾"}</span>
        </button>
        {/* 실무/수납(desktopHeading)은 도구 앞, 컨택관리·일정·계약은 박스 맨 오른쪽(belie 2026-09-29). */}
        {desktopHeading && fontControl}
        {open && (
          <div className="flex shrink-0 items-center gap-1.5">
            {auto && ciSaving && (
              <span className="text-px-11 text-gray-400" aria-live="polite">저장 중…</span>
            )}
            {auto && !ciSaving && status === "error" && (
              <span className="text-px-11 font-medium text-red-500" aria-live="polite">저장 실패</span>
            )}
            {/* 서류 OCR 로 칸 채우기 — 체크한 칸만 같은 set 경로(apply)로 반영 → 기존 자동저장이 영속화. */}
            <CompanyDocAutofillButton current={draft} onApply={(p) => apply((d) => ({ ...d, ...p }))} />
            {/* 업체정보생성(TXT) — 편집 옆, 흰 바탕(belie 2026-09-29). */}
            {txtCompanyName && (
              <button
                type="button"
                onClick={exportTxt}
                disabled={txtBusy}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {txtBusy ? "생성 중…" : "업체정보생성(TXT)"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setModal(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              팝업
            </button>
          </div>
        )}
        {!desktopHeading && fontControl}
      </div>

      {open && (
        <div
          className="space-y-3 border-t border-gray-100 bg-slate-50 px-2.5 py-2"
          onBlur={(e) => {
            if (auto && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
              commit(true);
            }
          }}
        >
          {auto && (status !== "idle" || canUndo) && (
            <AutosaveStatus
              status={status}
              error={error}
              savedAt={savedAt}
              onRetry={retry}
              canUndo={canUndo}
              onUndo={undo}
            />
          )}
          {body(splitInline, "panel")}
          {txtMsg && (
            <p className={`text-px-11 ${txtMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
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
          <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-4" style={{ ["--font-scale" as string]: String(fontScaleOf(fontStep)) }}>
          {/* PC(2xl+) 모달은 좌우 2단이 펼쳐지도록 넓게 */}
          <div className="mt-8 mb-8 w-full max-w-md rounded-2xl bg-white p-4 shadow-xl 2xl:max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">업체정보 편집</h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="닫기"
                className="rounded-full px-2 text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            {body(false, "modal")}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-bold text-white hover:bg-black"
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

"use client";
/**
 * 업무도구 — 사업계획서 작성도구 본문(docs/plans/active/bizplan-tool.md, ADR-0039, belie 2026-11-22 기획 승인).
 * 1단계 = ① 내 구독: 자료 올리기 → (서류에서 숫자 읽기) → 팩트시트 → 자료 꾸러미(ZIP) + 시작 프롬프트.
 *
 * - 고객 파일은 브라우저 안에서만 묶는다(서버 저장 없음). 공식 빌더·양식만 /api/bizplan/kit 에서 받는다.
 * - 글자 입력(팩트시트)은 이 브라우저에 임시저장해서 새로고침해도 남는다. 파일은 남지 않는다.
 * - PC 는 왼쪽 입력 · 오른쪽 「어떻게 만들까요?」(따라 내려옴), 좁은 화면은 위아래.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { bizplanMissing, emptyBizplanDraft, normalizeBizplanDraft, type BizplanDraft, type BizplanSlotKey } from "@/util/bizplan-pack";
import BizplanFiles from "./BizplanFiles";
import BizplanFactsForm from "./BizplanFactsForm";
import BizplanKitPanel from "./BizplanKitPanel";
import BizplanOcr from "./BizplanOcr";
import { applySuggestions, type BizplanSuggestion } from "@/lib/document-ocr/bizplan-map";
import {
  PACK_MAX_BYTES,
  buildPack,
  downloadKitFile,
  emptySlotFiles,
  fileRefs,
  saveBytes,
  startPromptFor,
  totalBytes,
  type KitInfo,
  type SlotFiles,
} from "./pack-client";

const DRAFT_KEY = "salespt.bizplan.draft.v1";
const baseYear = () => new Date().getFullYear();

function loadDraft(): BizplanDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? normalizeBizplanDraft(JSON.parse(raw), baseYear()) : emptyBizplanDraft(baseYear());
  } catch {
    return emptyBizplanDraft(baseYear());
  }
}

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);

export default function BizplanTool() {
  const [draft, setDraft] = useState<BizplanDraft>(() => emptyBizplanDraft(baseYear()));
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState<SlotFiles>(emptySlotFiles);
  const [kit, setKit] = useState<KitInfo | null>(null);
  const [kitError, setKitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
    setLoaded(true);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/bizplan/kit", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { error?: string }).error ?? "공식 빌더 정보를 불러오지 못했어요.");
        if (alive) setKit(j as KitInfo);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setKitError(e instanceof Error ? e.message : "공식 빌더 정보를 불러오지 못했어요.");
        setKit({ ready: false, builder: null, clinic: null, interview: null });
      });
    return () => { alive = false; };
  }, []);

  // 글자 입력은 0.4초 쉬면 임시저장.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* 저장 공간 없음 — 화면은 계속 */ }
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, loaded]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.error ? 8000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = useCallback((p: Partial<BizplanDraft>) => setDraft((d) => ({ ...d, ...p })), []);
  const addFiles = useCallback((key: BizplanSlotKey, list: File[]) => setFiles((f) => ({ ...f, [key]: [...f[key], ...list] })), []);
  const removeFile = useCallback((key: BizplanSlotKey, index: number) => setFiles((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) })), []);

  const applyOcr = useCallback((chosen: BizplanSuggestion[]) => {
    setDraft((d) => applySuggestions(d, chosen));
    setToast({ text: chosen.length ? `${chosen.length}칸을 채웠어요. 숫자를 한 번 더 확인해 주세요.` : "채운 칸이 없어요.", error: false });
  }, []);

  const refs = useMemo(() => fileRefs(files), [files]);
  const missing = useMemo(() => bizplanMissing(draft, refs, !!kit?.builder), [draft, refs, kit]);
  const bytes = totalBytes(files);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const pack = await buildPack(draft, files, kit);
      saveBytes(pack.name, pack.bytes);
      setToast({ text: "꾸러미를 받았어요. 압축을 풀고 아래 순서대로 해 주세요.", error: false });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "꾸러미를 만들지 못했어요.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(startPromptFor(draft, kit));
      setToast({ text: "지시문을 복사했어요. 대화창에 붙여 넣어 보내세요.", error: false });
    } catch {
      setToast({ text: "복사하지 못했어요. 꾸러미 안의 00_AI지시_먼저읽기.txt 를 열어 복사해 주세요.", error: true });
    }
  }

  async function template(kind: "interview" | "clinic") {
    const name = kind === "interview" ? kit?.interview?.name : kit?.clinic?.name;
    if (!name) return;
    try { await downloadKitFile(kind, name); } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "양식을 받지 못했어요.", error: true });
    }
  }

  function reset() {
    if (!window.confirm("적은 내용과 올린 파일을 모두 지우고 새로 시작할까요?")) return;
    setDraft(emptyBizplanDraft(baseYear()));
    setFiles(emptySlotFiles());
  }

  return (
    <div className="pb-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          고객사 자료를 올리고 숫자를 확인하면, 내 AI 대화창에서 사업계획서 PPT · 슬라이드별 설명 · 현장클리닉 보고서를 만들 자료 꾸러미를 드려요.
        </p>
        <button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          새로 시작
        </button>
      </div>
      <div className="flex flex-col gap-4 pc:flex-row pc:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <BizplanFiles files={files} kit={kit} onAdd={addFiles} onRemove={removeFile} />
          <BizplanOcr files={files} draft={draft} onApply={applyOcr} />
          <BizplanFactsForm draft={draft} onPatch={patch} />
        </div>
        <div className="pc:sticky pc:top-4 pc:w-96 pc:shrink-0">
          <BizplanKitPanel
            kit={kit}
            kitError={kitError}
            missing={missing}
            fileCount={refs.length}
            sizeText={sizeLabel(bytes)}
            overLimit={bytes > PACK_MAX_BYTES}
            busy={busy}
            onDownload={download}
            onCopy={copyPrompt}
            onTemplate={template}
          />
        </div>
      </div>
      {toast && (
        <div role={toast.error ? "alert" : "status"} className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md">
          <p className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.error ? "bg-red-600 text-white" : "bg-slate-900 text-white"}`}>{toast.text}</p>
        </div>
      )}
    </div>
  );
}

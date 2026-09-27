/**
 * CompanyDocAutofillDialog — 업체정보 「문서로 자동입력」 팝업.
 *
 * 흐름: 파일 여러 개 끌어놓기/고르기 → 파일마다 이 기기 안에서 OCR(한 번에 하나씩) → 문서 종류 자동 판별
 * (고르기 상자로 바꿀 수 있음) → 등록된 파서가 칸 제안 → 비교표에서 체크한 칸만 onApply.
 *
 * 개인정보(belie 결정): 파일은 서버로 보내지 않고 저장하지 않는다. 읽은 글자는 **가린 뒤**(redactOcrText —
 * 주민등록번호 뒷자리·운전면허번호) 이 팝업 메모리에만 있다가(문서 종류를 바꾸면 다시 읽으려고) 팝업을 닫으면
 * 사라진다. 로그로 남기지 않는다.
 * OCR 실행기(@/lib/document-ocr/ocr-client → tesseract/pdfjs)는 파일을 읽는 순간 dynamic import.
 */
"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { CompanyInfo } from "@/types";
import { OCR_ACCEPT_ATTR, OCR_UNAVAILABLE_MESSAGE, validateOcrFile } from "@/lib/document-ocr/limits";
import { redactOcrText } from "@/lib/document-ocr/text-utils";
import { classifyDocumentText, isSupportedDocType, parseDocument } from "@/lib/document-ocr/registry";
import { buildDiffRows, defaultCheckFor, selectedPatch } from "@/lib/document-ocr/diff";
import { DOC_TYPES, DOC_TYPE_LABEL, type CompanyInfoKey, type DocType } from "@/lib/document-ocr/types";
import { 대표자_DEFS, 업체_DEFS, 재무_DEFS } from "@/components/company-info-defs";
import CompanyDocDiffTable from "./CompanyDocDiffTable";

type Status = "queued" | "reading" | "done" | "error";
type Row = {
  id: number;
  name: string;
  file?: File; // 읽기 전까지만 들고 있다 — 읽고 나면 버린다.
  status: Status;
  ratio: number;
  message: string;
  text: string;
  docType: DocType;
};

const DEFS = [...업체_DEFS, ...대표자_DEFS, ...재무_DEFS];
const ORDER = DEFS.map(([k]) => String(k));
const LABEL = new Map<string, string>(DEFS.map(([k, l]) => [String(k), l]));
const labelOf = (k: string) => LABEL.get(k) ?? k;

interface Props {
  current: CompanyInfo;
  onApply: (patch: Partial<Record<CompanyInfoKey, string>>) => void;
  onClose: () => void;
}

export default function CompanyDocAutofillDialog({ current, onApply, onClose }: Props) {
  const [files, setFiles] = useState<Row[]>([]);
  const [userChecked, setUserChecked] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 열릴 때 제목에 포커스, 닫힐 때 원래 버튼으로 복귀. 닫히면 진행 중 OCR 취소.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.getElementById(titleId)?.focus({ preventScroll: true });
    return () => {
      abortRef.current?.abort();
      opener?.focus?.();
    };
  }, [titleId]);

  // 포커스가 대화상자 밖(예: body)으로 빠져도 Esc·Tab 이 뒤 화면으로 새지 않게.
  useEffect(() => {
    const onDocKey = (e: globalThis.KeyboardEvent) => {
      const dlg = dialogRef.current;
      if (!dlg || dlg.contains(document.activeElement)) return; // 안쪽은 onKeyDown 이 처리
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        e.preventDefault();
        document.getElementById(titleId)?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onDocKey);
    return () => document.removeEventListener("keydown", onDocKey);
  }, [titleId]);

  // 한 번에 한 파일씩 읽는다(기기 메모리 보호).
  const busy = files.some((f) => f.status === "reading");
  const next = files.find((f) => f.status === "queued");
  useEffect(() => {
    if (busy || !next?.file) return;
    const { id, file } = next;
    const patch = (p: Partial<Row>) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)));
    patch({ status: "reading", message: "읽을 준비 중", file: undefined });
    const ac = new AbortController();
    abortRef.current = ac;
    void (async () => {
      try {
        const { runDocumentOcr } = await import("@/lib/document-ocr/ocr-client");
        const out = await runDocumentOcr(file, {
          signal: ac.signal,
          onProgress: (p) => patch({ ratio: p.ratio, message: p.message }),
        });
        if (ac.signal.aborted) return;
        // 원문은 가린 뒤에만 state 에 둔다(주민등록번호 뒷자리 등이 메모리·DevTools 에 남지 않게).
        const text = redactOcrText(out.text);
        patch({ status: "done", ratio: 1, message: "다 읽었어요", text, docType: classifyDocumentText(text) });
      } catch (e) {
        if (ac.signal.aborted) return;
        // 실행기가 사용자용으로 정리한 오류(code 있음)만 그대로 보여 준다.
        const known = e instanceof Error && typeof (e as { code?: unknown }).code === "string";
        patch({ status: "error", message: known ? (e as Error).message : OCR_UNAVAILABLE_MESSAGE });
      }
    })();
  }, [busy, next]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const rows: Row[] = [...list].map((file) => {
      const v = validateOcrFile({ size: file.size, type: file.type, name: file.name });
      seq.current += 1;
      const base = { id: seq.current, name: file.name, ratio: 0, text: "", docType: "unknown" as DocType };
      return "error" in v
        ? { ...base, status: "error" as const, message: v.error.message }
        : { ...base, status: "queued" as const, message: "기다리는 중", file };
    });
    setFiles((fs) => [...fs, ...rows]);
  };

  const parsed = useMemo(
    () =>
      files
        .filter((f) => f.status === "done")
        .map((f) => ({ f, result: parseDocument(f.docType, f.text) })),
    [files],
  );
  const rows = useMemo(
    () =>
      buildDiffRows(
        current,
        parsed.flatMap(({ f, result }) => (result ? [{ fileName: f.name, fields: result.fields }] : [])),
        ORDER,
      ),
    [current, parsed],
  );
  const checked = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const r of rows) {
      const c = r.candidates[choice[r.key] ?? 0] ?? r.candidates[0]!;
      out[r.key] = r.key in userChecked ? userChecked[r.key]! : defaultCheckFor(r.current, c);
    }
    return out;
  }, [rows, userChecked, choice]);
  const patch = selectedPatch(rows, checked, choice);
  const count = Object.keys(patch).length;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.getAttribute("aria-hidden") !== "true" && !el.classList.contains("sr-only"));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement?.id === titleId)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const body = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      onMouseDown={(e) => {
        // 어두운 바깥을 눌러도 포커스가 대화상자 밖(body)으로 빠지지 않게.
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className="my-4 w-full max-w-2xl rounded-2xl bg-white p-3 shadow-xl sm:my-8 sm:p-4"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 id={titleId} tabIndex={-1} className="text-sm font-black text-gray-900 focus:outline-none">
            문서로 자동입력
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>
        <p id={descId} className="mb-3 text-xs text-gray-500">
          🔒 파일은 이 기기 안에서만 읽고 저장하지 않아요.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`rounded-lg border-2 border-dashed p-3 text-center text-xs ${dragOver ? "border-gray-900 bg-gray-50" : "border-gray-300"}`}
        >
          <p className="text-gray-600">사업자등록증 같은 서류를 여기에 끌어놓거나</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 rounded-md border border-gray-300 bg-white px-3 py-1 font-medium text-gray-700 hover:bg-gray-50"
          >
            파일 고르기
          </button>
          <p className="mt-1 text-gray-400">JPG·PNG·WebP·PDF, 15MB 이하 · PDF 는 첫 페이지만 읽어요</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={OCR_ACCEPT_ATTR}
            className="sr-only"
            tabIndex={-1}
            aria-label="서류 파일 고르기"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5" aria-label="올린 파일">
            {files.map((f) => {
              const result = parsed.find((p) => p.f.id === f.id)?.result;
              const info = result?.info ?? [];
              return (
                <li key={f.id} className="rounded-md border border-gray-200 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{f.name}</span>
                    {f.status === "done" && (
                      <select
                        aria-label={`${f.name} 문서 종류`}
                        className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                        value={f.docType}
                        onChange={(e) =>
                          setFiles((fs) => fs.map((x) => (x.id === f.id ? { ...x, docType: e.target.value as DocType } : x)))
                        }
                      >
                        {DOC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {DOC_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {f.status === "reading" || f.status === "queued" ? (
                    <div className="mt-1">
                      <div
                        className="h-1.5 overflow-hidden rounded bg-gray-100"
                        role="progressbar"
                        aria-label={`${f.name} 읽는 중`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(f.ratio * 100)}
                      >
                        <div className="h-full bg-gray-900 transition-all" style={{ width: `${Math.round(f.ratio * 100)}%` }} />
                      </div>
                      <p className="mt-0.5 text-gray-500">{f.message}</p>
                    </div>
                  ) : f.status === "error" ? (
                    <p className="mt-1 text-red-600" role="alert">✕ {f.message}</p>
                  ) : f.docType === "unknown" ? (
                    <p className="mt-1 text-gray-500">어떤 서류인지 알아보지 못했어요. 옆에서 서류 종류를 골라 주세요.</p>
                  ) : !isSupportedDocType(f.docType) ? (
                    <p className="mt-1 text-gray-500">이 문서는 곧 지원돼요</p>
                  ) : (
                    <div className="mt-1 text-gray-500">
                      {(result?.fields.length ?? 0) > 0 ? (
                        <p>✓ {result!.fields.length}칸을 읽었어요</p>
                      ) : (
                        <p>채울 수 있는 칸을 찾지 못했어요.</p>
                      )}
                      {info.map((i) => (
                        <p key={i.label}>
                          {i.label}: <span className="text-gray-800">{i.value}</span> (참고 — 저장하지 않아요)
                        </p>
                      ))}
                      {result?.documentWarnings.map((w) => (
                        <p key={w} className="text-amber-700">⚠ {w}</p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {rows.length === 0 && files.length > 0 && files.every((f) => f.status === "done" || f.status === "error") && (
          <p className="mt-3 text-center text-xs text-gray-400">문서에서 채울 수 있는 값이 아직 없어요.</p>
        )}
        <div className="mt-3">
          <CompanyDocDiffTable
            rows={rows}
            labelOf={labelOf}
            checked={checked}
            choice={choice}
            onCheck={(k, v) => setUserChecked((u) => ({ ...u, [k]: v }))}
            onChoose={(k, i) => {
              setChoice((c) => ({ ...c, [k]: i }));
              setUserChecked((u) => {
                const rest = { ...u };
                delete rest[k];
                return rest;
              });
            }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 text-xs text-gray-500" aria-live="polite">
            {count}개 선택
          </span>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              onApply(patch);
              onClose();
            }}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-40"
          >
            선택 항목 적용
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}

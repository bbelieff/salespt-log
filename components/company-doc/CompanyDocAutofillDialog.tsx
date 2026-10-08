/**
 * CompanyDocAutofillDialog — 업체정보 「문서로 자동입력」 팝업.
 *
 * 흐름: 파일 여러 개 끌어놓기/고르기 → 파일마다 이 기기 안에서 OCR(한 번에 하나씩) → 문서 종류 자동 판별
 * (고르기 상자로 바꿀 수 있음) → 등록된 파서가 칸 제안 → 비교표에서 체크한 칸만 onApply.
 *
 * 미팅 메모(txt·붙여넣기)는 OCR 없이 바로 읽고, 계정·계좌·주민번호는 칸이 아니라 계정 보관함 후보로 보여 준다.
 * 개인정보(belie 결정): 파일은 서버로 보내지 않고 저장하지 않는다. 서류 사진·PDF 에서 읽은 글자는 **가린 뒤**(redactOcrText —
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
import { buildDiffRows, defaultCheckFor, selectedPatch, withBaseYear } from "@/lib/document-ocr/diff";
import { DOC_TYPES, DOC_TYPE_LABEL, type CompanyInfoKey, type DocType } from "@/lib/document-ocr/types";
import { MEMO_MAX_BYTES, decodeMemoBytes, isMemoFile } from "@/lib/document-ocr/memo-file";
import type { MemoParseResult } from "@/lib/document-ocr/parse-memo";
import type { VaultItem } from "@/types/company-vault";
import CompanyDocMemoExtras from "./CompanyDocMemoExtras";

/** 팝업에 안내하는 서류 목록 [서류, 채워 주는 칸] — 파서 레지스트리(lib/document-ocr/registry.ts)와 같게 유지. */
export const SUPPORTED_DOCS: readonly (readonly [string, string])[] = [
  ["사업자등록증", "사업자등록번호·개업일·사업자구분/과세유형·업태·종목·소재지·법인등록번호"],
  ["부가세 과세표준증명원", "연도별 상·하반기 매출(백만원)·면세 수입금액"],
  ["재무제표(표준재무제표증명)", "영업이익·당기순이익·이자비용·자산/부채/자본총계"],
  ["신분증(주민등록증·운전면허증)", "대표자 이름·주민등록번호 앞자리·자택주소"],
  ["임대차계약서", "소유여부(임차)·보증금·월세·면적"],
  ["미팅 메모(txt·붙여넣기)", "업체·대표자 칸·연도별 매출 + 아이디·비번·계좌·주민번호는 계정 보관함으로"],
];
import { resolveBaseYear } from "@/util/company-sales";
import { companyInfoFieldList } from "@/components/company-info-defs";
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

/** 비교표 행 순서·라벨 = 편집기 화면 순서([대표자] → [기업정보] → [재무]) · 같은 라벨(매출은 기준 연도 포함). */
function fieldOrder(baseYear: number) {
  const fields = companyInfoFieldList(baseYear);
  const label = new Map<string, string>(fields.map(([k, l]) => [String(k), l]));
  return { order: fields.map(([k]) => String(k)), labelOf: (k: string) => label.get(k) ?? k };
}

interface Props {
  current: CompanyInfo;
  onApply: (patch: Partial<Record<CompanyInfoKey, string>>) => void;
  /** 미팅 메모에서 뽑은 계정·계좌 — 편집기의 계정 보관함으로 넘긴다. */
  onVault?: (items: VaultItem[]) => void;
  onClose: () => void;
}

export default function CompanyDocAutofillDialog({ current, onApply, onVault, onClose }: Props) {
  const [files, setFiles] = useState<Row[]>([]);
  const [userChecked, setUserChecked] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [vaultOff, setVaultOff] = useState<Record<string, boolean>>({});
  const [leftoverOn, setLeftoverOn] = useState(false);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // 매출 칸 기준 연도 = 업체 저장값, 없으면 오늘 연도 — 파서가 문서 연도를 Y~Y-3 칸에 놓는 기준.
  const baseYear = resolveBaseYear(current.매출기준연도, new Date());
  const { order, labelOf } = useMemo(() => fieldOrder(baseYear), [baseYear]);

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

  // 미팅 메모는 OCR 없이 글자를 바로 읽는다(가리지 않음 — 계정·주민번호를 보관함으로 옮기려고, 팝업 메모리에만 있다).
  const addMemo = (name: string, text: string) => {
    seq.current += 1;
    const row: Row = { id: seq.current, name, status: "done", ratio: 1, message: "다 읽었어요", text, docType: "미팅메모" };
    setFiles((fs) => [...fs, row]);
  };

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    for (const file of [...list].filter(isMemoFile)) {
      if (file.size > MEMO_MAX_BYTES) {
        seq.current += 1;
        setFiles((fs) => [...fs, { id: seq.current, name: file.name, status: "error", ratio: 0, message: "메모 파일은 1MB 이하만 읽어요.", text: "", docType: "unknown" }]);
        continue;
      }
      void file.arrayBuffer().then((buf) => addMemo(file.name, decodeMemoBytes(buf)));
    }
    const rows: Row[] = [...list].filter((file) => !isMemoFile(file)).map((file) => {
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
        .map((f) => ({ f, result: parseDocument(f.docType, f.text, { baseYear }) })),
    [files, baseYear],
  );
  const rows = useMemo(
    () =>
      buildDiffRows(
        current,
        parsed.flatMap(({ f, result }) => (result ? [{ fileName: f.name, fields: result.fields }] : [])),
        order,
      ),
    [current, parsed, order],
  );
  const checked = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const r of rows) {
      const c = r.candidates[choice[r.key] ?? 0] ?? r.candidates[0]!;
      out[r.key] = r.key in userChecked ? userChecked[r.key]! : defaultCheckFor(r.current, c);
    }
    return out;
  }, [rows, userChecked, choice]);
  const memos = parsed.flatMap(({ f, result }) =>
    result && "vault" in result ? [{ id: f.id, ...(result as MemoParseResult) }] : [],
  );
  const vaultItems = memos.flatMap((m) => m.vault.map((v, i) => ({ key: `${m.id}:${i}`, v })));
  const vaultOn = vaultItems.map(({ key }) => !vaultOff[key]);
  const pickedVault = vaultItems.filter((_, i) => vaultOn[i]).map(({ v }) => v);
  const leftover = memos.map((m) => m.leftover).filter(Boolean).join("\n\n");
  const patch = selectedPatch(rows, checked, choice);
  const memoNote = leftoverOn && leftover ? [current.업체기타메모?.trim(), leftover].filter(Boolean).join("\n") : null;
  const count = Object.keys(patch).length + (memoNote ? 1 : 0) + pickedVault.length;

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
          <p className="text-gray-600">아래 서류를 여기에 끌어놓거나</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 rounded-md border border-gray-300 bg-white px-3 py-1 font-medium text-gray-700 hover:bg-gray-50"
          >
            파일 고르기
          </button>
          <button
            type="button"
            onClick={() => setPasteText((t) => (t === null ? "" : null))}
            className="ml-2 mt-2 rounded-md border border-gray-300 bg-white px-3 py-1 font-medium text-gray-700 hover:bg-gray-50"
          >
            메모 붙여넣기
          </button>
          <p className="mt-1 text-gray-400">JPG·PNG·WebP·PDF 15MB 이하 · PDF 는 10쪽까지(스캔본은 첫 쪽) · 미팅 메모 TXT</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={`${OCR_ACCEPT_ATTR},.txt,text/plain`}
            className="sr-only"
            tabIndex={-1}
            aria-label="서류 파일 고르기"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {pasteText !== null && (
          <div className="mt-2 space-y-1.5">
            <label htmlFor={`${titleId}-paste`} className="sr-only">미팅 메모 붙여넣기</label>
            <textarea
              id={`${titleId}-paste`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder="메모장에 적은 미팅 메모를 그대로 붙여넣어 주세요."
              className="w-full rounded-md border border-gray-300 p-2 text-xs text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <button
              type="button"
              disabled={!pasteText.trim()}
              onClick={() => {
                addMemo("붙여넣은 메모", pasteText);
                setPasteText(null);
              }}
              className="rounded-md bg-gray-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
            >
              메모 읽기
            </button>
          </div>
        )}
        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs" aria-label="읽을 수 있는 서류">
          <p className="font-semibold text-gray-700">읽을 수 있는 서류</p>
          <ul className="mt-1 space-y-0.5">
            {SUPPORTED_DOCS.map(([doc, fills]) => (
              <li key={doc} className="flex gap-1.5 text-gray-600">
                <span className="shrink-0 font-medium text-gray-800">{doc}</span>
                <span className="min-w-0 text-gray-500">— {fills}</span>
              </li>
            ))}
          </ul>
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
                  ) : !isSupportedDocType(f.docType) ? (
                    // 다섯 서류 파서가 모두 등록돼 있어 여기 오는 건 "모르는 문서" 뿐이다.
                    <p className="mt-1 text-gray-500">어떤 서류인지 알아보지 못했어요. 옆에서 서류 종류를 골라 주세요.</p>
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

        <CompanyDocMemoExtras
          vault={vaultItems.map(({ v }) => v)}
          vaultOn={vaultOn}
          onVault={(i, on) => setVaultOff((o) => ({ ...o, [vaultItems[i]!.key]: !on }))}
          leftover={leftover}
          leftoverOn={leftoverOn}
          onLeftover={setLeftoverOn}
        />

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
              onApply(withBaseYear(memoNote ? { ...patch, 업체기타메모: memoNote } : patch, current, baseYear));
              if (pickedVault.length > 0) onVault?.(pickedVault);
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

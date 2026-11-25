"use client";
/**
 * 사업계획서 작성도구 — 「서류에서 숫자 읽기」(docs/plans/active/bizplan-tool.md 다음 PR 1, 2026-11-24).
 *
 * 사업자등록증·재무제표·부가세 칸에 올린 사진·PDF 를 이 기기 안에서 읽어 팩트시트 칸 제안을 보여 준다.
 * 사용자가 고른 칸만 채운다. 이미 적힌 칸은 기본으로 고르지 않는다(지금 값을 함께 보여 준다).
 * OCR 은 업체정보 「문서로 자동입력」과 같은 것(@/lib/document-ocr) — 서버로 파일을 보내지 않는다.
 */
import { useEffect, useRef, useState } from "react";
import { ScanText } from "lucide-react";
import { OCR_UNAVAILABLE_MESSAGE } from "@/lib/document-ocr/limits";
import { bizplanBaseYear, resolveSuggestions, type BizplanSuggestion } from "@/lib/document-ocr/bizplan-map";
import type { BizplanDraft } from "@/util/bizplan-pack";
import { ocrJobs, readOcrFile, readTaxInvFile, suggestionsFromPieces, taxInvFiles, type ReadPiece } from "./ocr-run";
import type { SlotFiles } from "./pack-client";

type Progress = { index: number; total: number; name: string; ratio: number; message: string };

const BTN = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";

export default function BizplanOcr({ files, draft, onApply }: {
  files: SlotFiles;
  draft: BizplanDraft;
  onApply: (chosen: BizplanSuggestion[]) => void;
}) {
  const cache = useRef(new WeakMap<File, ReadPiece[]>());
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rows, setRows] = useState<BizplanSuggestion[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string[]>([]);
  /** 읽어 낸 숫자 개수(팩트시트와 같아서 빠진 것 포함) — 「바꿀 칸 없음」 안내를 고르는 데 쓴다. */
  const [readCount, setReadCount] = useState(0);

  useEffect(() => () => {
    abortRef.current?.abort();
    // Paddle 모델이 잡은 메모리를 돌려준다.
    void import("@/lib/document-ocr/ocr-paddle").then((m) => m.releasePaddle()).catch(() => undefined);
  }, []);

  const { jobs, skipped } = ocrJobs(files);
  const sheets = taxInvFiles(files);
  const total = jobs.length + sheets.length;
  const reading = progress !== null;

  async function run() {
    if (reading || total === 0) return;
    const ac = new AbortController();
    abortRef.current = ac;
    const pieces: ReadPiece[] = [];
    const failed: string[] = [];
    try {
      for (const [i, job] of jobs.entries()) {
        const hit = cache.current.get(job.file);
        if (hit) { pieces.push(...hit); continue; }
        setProgress({ index: i + 1, total: jobs.length, name: job.file.name, ratio: 0, message: "읽을 준비 중" });
        try {
          const got = await readOcrFile(job, ac.signal, (p) =>
            setProgress({ index: i + 1, total: jobs.length, name: job.file.name, ratio: p.ratio, message: p.message }));
          cache.current.set(job.file, got);
          pieces.push(...got);
        } catch (e) {
          if (ac.signal.aborted) return;
          const known = e instanceof Error && typeof (e as { code?: unknown }).code === "string";
          failed.push(`${job.file.name}: ${known ? (e as Error).message : OCR_UNAVAILABLE_MESSAGE}`);
        }
      }
      const partnerRaw: Awaited<ReturnType<typeof readTaxInvFile>>[] = [];
      for (const [i, file] of sheets.entries()) {
        setProgress({ index: jobs.length + i + 1, total, name: file.name, ratio: 0, message: "엑셀 읽는 중" });
        try { partnerRaw.push(await readTaxInvFile(file)); } catch { failed.push(`${file.name}: 엑셀을 열지 못했어요.`); }
      }
      if (ac.signal.aborted) return;
      const baseYear = bizplanBaseYear(draft, new Date().getFullYear() - 1);
      const ocr = suggestionsFromPieces(pieces, baseYear);
      const raw = { suggestions: [...ocr.suggestions, ...partnerRaw.flatMap((p) => p.suggestions)], notes: [...ocr.notes, ...partnerRaw.flatMap((p) => p.notes)] };
      const resolved = resolveSuggestions(raw.suggestions, draft);
      setReadCount(raw.suggestions.length);
      setRows(resolved.rows);
      setChecked(new Set(resolved.rows.filter((r) => r.check).map((r) => r.id)));
      setNotes([
        ...failed,
        ...skipped.map((n) => `${n}: 사진(JPG·PNG·WEBP)이나 PDF만 읽을 수 있어요.`),
        ...raw.notes,
        ...resolved.notes,
      ]);
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setProgress(null);
    }
  }

  function apply() {
    if (!rows) return;
    const chosen = rows.filter((r) => checked.has(r.id));
    onApply(chosen);
    setRows(null);
    setNotes([]);
  }

  const toggle = (id: string) => setChecked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <section aria-labelledby="bizplan-ocr-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <ScanText className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="bizplan-ocr-title" className="text-base font-bold text-slate-900">서류에서 숫자 읽기</h2>
          <p className="text-sm text-slate-600">
            사업자등록증·재무제표·부가세 서류와 세금계산서 엑셀(매출처·매입처 TOP3)을 이 기기 안에서 읽어 아래 팩트시트 칸을 채워 드려요. 고른 칸만 들어가요.
          </p>
        </div>
        {reading ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className={`${BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
            그만 읽기
          </button>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={total === 0}
            className={`${BTN} bg-blue-700 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`}
          >
            {total === 0 ? "읽을 서류 없음" : `서류 ${total}개 읽기`}
          </button>
        )}
      </div>

      {reading && progress && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="flex gap-2 text-sm text-slate-700">
            <span className="shrink-0 tabular-nums">{progress.index}/{progress.total}</span>
            <span className="min-w-0 flex-1 truncate" title={progress.name}>{progress.name}</span>
            <span className="shrink-0 text-slate-500">{progress.message}</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)} aria-label="읽는 중">
            <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">처음 한 번은 읽기 도구를 받느라 조금 더 걸려요. 스캔 PDF 는 쪽마다 10초쯤 걸려요.</p>
        </div>
      )}

      {rows && (
        <div className="mt-3">
          {rows.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              {readCount > 0
                ? "읽은 내용이 팩트시트와 모두 같아요. 바꿀 칸이 없어요."
                : notes.length > 0
                  ? "숫자를 찾지 못했어요. 아래 안내를 보시고 직접 적어 주세요."
                  : "숫자를 찾지 못했어요. 더 선명한 사진이나 홈택스 PDF로 다시 해 보세요."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
              {rows.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                    <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)} className="mt-1 h-4 w-4 shrink-0 accent-blue-700" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-slate-800">{r.label}</span>
                        <span className="break-all text-sm tabular-nums text-slate-900">{r.value}</span>
                        {r.confidence < 0.5 && <span className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800">확인 필요</span>}
                      </span>
                      {r.current && <span className="block text-xs text-amber-800">지금 적힌 값: {r.current} — 고르면 바뀌어요</span>}
                      {r.warnings.map((w) => <span key={w} className="block text-xs text-slate-600">{w}</span>)}
                      <span className="block truncate text-xs text-slate-500" title={r.source}>{r.source}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {notes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {notes.map((n, i) => <li key={`${i}-${n}`} className="break-words">{n}</li>)}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setRows(null); setNotes([]); }} className={`${BTN} text-slate-600 hover:bg-slate-100`}>닫기</button>
            {rows.length > 0 && (
              <button type="button" onClick={apply} disabled={checked.size === 0} className={`${BTN} bg-blue-700 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`}>
                고른 {checked.size}칸 채우기
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

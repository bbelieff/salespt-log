"use client";
/**
 * 간편인증 서류 조회 — 업체별 서류함(목업). 받은 증명서 목록 + 「업체정보에 반영」.
 * 반영 비교표는 「문서로 자동입력」과 같은 CompanyDocDiffTable·buildDiffRows 를 그대로 쓴다.
 */
import { useMemo, useState } from "react";
import { CheckCircle2, FileText, RotateCcw, X, XCircle } from "lucide-react";
import CompanyDocDiffTable from "@/components/company-doc/CompanyDocDiffTable";
import { buildDiffRows, selectedPatch, type FileProposal } from "@/lib/document-ocr/diff";
import { CURRENT_INFO, FIELD_LABEL, PROPOSAL, docLabel, type AuthRequest, type DocKey } from "./data";

const BTN2 = "inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";

export default function DocBox({ req, onClose, onRetry, onApplied }: { req: AuthRequest; onClose: () => void; onRetry: (id: string, key: DocKey) => void; onApplied: (n: number) => void }) {
  const [preview, setPreview] = useState<DocKey | null>(null);
  const [applying, setApplying] = useState(false);
  const okKeys = req.results.filter(r => r.ok).map(r => r.key);
  const rows = useMemo(() => {
    const byDoc = new Map<DocKey, FileProposal>();
    for (const p of PROPOSAL) {
      if (!okKeys.includes(p.source)) continue;
      const f = byDoc.get(p.source) ?? { fileName: docLabel(p.source), fields: [] };
      f.fields.push({ key: p.key, value: p.value, confidence: 0.97, warnings: [] });
      byDoc.set(p.source, f);
    }
    return buildDiffRows(CURRENT_INFO, [...byDoc.values()]);
  }, [okKeys.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map(r => [r.key, r.defaultChecked])));
  const [choice, setChoice] = useState<Record<string, number>>({});
  const patchCount = Object.keys(selectedPatch(rows, checked, choice)).length;

  return (
    <section aria-label={`${req.company} 서류함`} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900" title={req.company}>{req.company} 서류함</h2>
          <p className="text-xs text-gray-500">{req.sentAt} 요청 · {req.method} 인증 · 원문은 암호화해 90일 보관 후 지워져요</p>
        </div>
        <button type="button" onClick={onClose} aria-label="서류함 닫기" className="rounded-md p-1 text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><X className="h-4 w-4" /></button>
      </header>

      <ul className="flex flex-col gap-2">
        {req.results.map(d => (
          <li key={d.key} className={`rounded-lg border px-3 py-2.5 ${d.ok ? "border-gray-200" : "border-red-200 bg-red-50"}`}>
            <div className="flex min-w-0 items-center gap-2">
              {d.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{docLabel(d.key)}</span>
              {d.ok ? <>
                <span className="text-xs text-gray-500 tabular-nums">{d.issuedAt} 발급</span>
                <button type="button" onClick={() => setPreview(p => (p === d.key ? null : d.key))} aria-expanded={preview === d.key} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><FileText className="h-3.5 w-3.5" aria-hidden />원문</button>
              </> : <button type="button" onClick={() => onRetry(req.id, d.key)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><RotateCcw className="h-3.5 w-3.5" aria-hidden />이 서류만 다시 요청</button>}
            </div>
            {d.ok
              ? <ul className="mt-1 pl-6 text-sm text-gray-700">{d.facts.map(f => <li key={f} className="tabular-nums">{f}</li>)}</ul>
              : <p className="mt-1 pl-6 text-sm text-red-700">{d.reason}</p>}
            {preview === d.key && (
              <div className="mt-2 ml-6 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
                원문 미리보기 자리 — 실제로는 홈택스가 발급한 증명서(PDF)를 이 자리에서 보여 주고, 내려받을 수 있어요. (목업이라 합성 문구만 보여요)
              </div>
            )}
          </li>
        ))}
      </ul>

      {rows.length > 0 && (applying ? (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">업체정보에 반영 <span className="font-normal text-gray-500">— 체크한 칸만 바뀌어요</span></h3>
          <div className="overflow-x-auto">
            <CompanyDocDiffTable rows={rows} labelOf={k => FIELD_LABEL[k] ?? k} checked={checked} choice={choice}
              onCheck={(k, v) => setChecked(c => ({ ...c, [k]: v }))} onChoose={(k, i) => setChoice(c => ({ ...c, [k]: i }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setApplying(false)} className={BTN2}>닫기</button>
            <button type="button" disabled={patchCount === 0} onClick={() => { onApplied(patchCount); setApplying(false); }}
              className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
              {patchCount}칸 반영하기
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setApplying(true)} className={`${BTN2} self-start`}>업체정보에 반영…</button>
      ))}
    </section>
  );
}

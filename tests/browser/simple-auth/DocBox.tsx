"use client";
/**
 * 간편인증 서류 조회 — 사업자 한 곳의 서류함(목업). ① DB 연결 ② 받은 증명서 ③ 업체정보에 반영.
 * 반영 비교표는 「문서로 자동입력」과 같은 CompanyDocDiffTable·buildDiffRows 를 그대로 쓴다.
 */
import { useId, useMemo, useState } from "react";
import { CheckCircle2, Download, Link2, RotateCcw, X, XCircle } from "lucide-react";
import CompanyDocDiffTable from "@/components/company-doc/CompanyDocDiffTable";
import { buildDiffRows, selectedPatch, type FileProposal } from "@/lib/document-ocr/diff";
import { CURRENT_INFO, DB_ROWS, FIELD_LABEL, PROPOSAL, dbRow, docLabel, type AuthRequest, type Biz, type DocKey, type Link } from "./data";

const BTN2 = "inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";
const BTN1 = "rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500";

const ALL_DB = () => DB_ROWS.map(r => ({ id: r.id, why: `${r.owner} · ${r.channel}` }));

/** 합성 PDF 를 「사업자명 서류이름.pdf」로 내려받는다. 실제 구현은 서버의 원문(Base64)을 같은 이름으로 내려준다. */
function downloadPdf(fileName: string) {
  const pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 72 760 Td (MOCKUP PDF) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DbLinkPanel({ biz, onLink }: { biz: Biz; onLink: (l: Link) => void }) {
  const id = useId();
  const l = biz.link;
  const cands = l.state === "pick" ? l.candidates : [];
  const [pick, setPick] = useState<string>(cands[0]?.id ?? "");
  const change = <button type="button" onClick={() => onLink({ state: "pick", candidates: ALL_DB() })} className="text-xs font-medium text-blue-700 hover:underline">바꾸기</button>;
  if (l.state === "auto" || l.state === "linked" || l.state === "created" || l.state === "later") {
    const text = l.state === "created"
      ? (l.extra ? <>추가 DB 생성 <span className="text-xs text-gray-500">· 대표 정보는 {l.sameOwnerAs}와 같음</span></> : <>새 DB 생성</>)
      : l.state === "later" ? <>연결 안 함</> : <>DB: <b>{dbRow(l.dbId)?.name}</b></>;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <Link2 className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-gray-800">{text}</span>
        {change}
      </div>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <legend className="sr-only">DB 연결</legend>
      <p className="text-sm font-semibold text-amber-900">어느 DB인가요?</p>
      {cands.length > 0 && (
        <ul className="flex flex-col gap-1">
          {cands.map(c => { const row = dbRow(c.id); return (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm text-gray-800">
                <input type="radio" name={`${id}-db`} value={c.id} checked={pick === c.id} onChange={() => setPick(c.id)} className="accent-blue-600" />
                <span className="min-w-0 flex-1 truncate" title={row?.name}>{row?.name}</span>
                <span className="shrink-0 text-xs text-gray-500">{c.why}</span>
              </label>
            </li>); })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {cands.length > 0 && <button type="button" disabled={!pick} onClick={() => onLink({ state: "linked", dbId: pick, why: "" })} className={BTN1}>이 DB에 연결</button>}
        <button type="button" onClick={() => onLink({ state: "created", extra: false, sameOwnerAs: "" })} className={BTN2}>새 DB로 추가</button>
        <button type="button" onClick={() => onLink({ state: "later" })} className="px-2 text-sm text-gray-600 hover:underline">나중에</button>
      </div>
    </fieldset>
  );
}

type Props = { req: AuthRequest; biz: Biz; onClose: () => void; onRetry: (key: DocKey) => void; onLink: (l: Link) => void; onApplied: (n: number) => void };

export default function DocBox({ req, biz, onClose, onRetry, onLink, onApplied, inline = false }: Props & { inline?: boolean }) {
  const [applying, setApplying] = useState(false);
  const okKeys = biz.results.filter(r => r.ok).map(r => r.key);
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
  const linked = biz.link.state === "auto" || biz.link.state === "linked" || biz.link.state === "created";

  return (
    <section aria-label={`${biz.name} 서류함`} className={`flex flex-col gap-4 bg-white ${inline ? "border-t border-blue-200 p-3" : "rounded-xl border border-gray-200 p-4 shadow-sm"}`}>
      {/* 목록 안에 펼칠 때(inline)는 업체 이름 줄이 바로 위에 있으므로 머리글을 뺀다. */}
      {!inline && <header className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900" title={biz.name}>{biz.name} <span className="text-sm font-normal text-gray-500 tabular-nums">{biz.bizNo}</span></h2>
          <p className="text-xs text-gray-500">{req.owner} 대표 · {req.sentAt}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="서류함 닫기" className="rounded-md p-1 text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><X className="h-4 w-4" /></button>
      </header>}

      <DbLinkPanel key={biz.link.state} biz={biz} onLink={onLink} />

      <ul className="flex flex-col gap-2">
        {biz.results.map(d => (
          <li key={d.key} className={`rounded-lg border px-3 py-2.5 ${d.ok ? "border-gray-200" : "border-red-200 bg-red-50"}`}>
            <div className="flex min-w-0 items-center gap-2">
              {d.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{docLabel(d.key)}</span>
              {d.ok ? <>
                <span className="hidden text-xs text-gray-500 tabular-nums 2xl:inline">{d.issuedAt} 발급</span>
                <button type="button" onClick={() => downloadPdf(`${biz.name} ${docLabel(d.key)}.pdf`)} title={`${biz.name} ${docLabel(d.key)}.pdf 내려받기`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><Download className="h-3.5 w-3.5" aria-hidden />원문</button>
              </> : <button type="button" onClick={() => onRetry(d.key)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><RotateCcw className="h-3.5 w-3.5" aria-hidden />이 서류만 다시 요청</button>}
            </div>
            {d.ok
              ? <ul className="mt-1 pl-6 text-base text-gray-700">{d.facts.map(f => <li key={f} className="tabular-nums">{f}</li>)}</ul>
              : <p className="mt-1 pl-6 text-base text-red-700">{d.reason}</p>}
          </li>
        ))}
      </ul>

      {rows.length > 0 && (applying ? (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">업체정보에 반영</h3>
          <div className="overflow-x-auto">
            <CompanyDocDiffTable rows={rows} labelOf={k => FIELD_LABEL[k] ?? k} checked={checked} choice={choice}
              onCheck={(k, v) => setChecked(c => ({ ...c, [k]: v }))} onChoose={(k, i) => setChoice(c => ({ ...c, [k]: i }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setApplying(false)} className={BTN2}>닫기</button>
            <button type="button" disabled={patchCount === 0} onClick={() => { onApplied(patchCount); setApplying(false); }} className={BTN1}>{patchCount}칸 반영하기</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" disabled={!linked} onClick={() => setApplying(true)} className={`${BTN2} disabled:cursor-not-allowed disabled:text-gray-400`}>업체정보에 반영…</button>
          {!linked && <span className="text-xs text-gray-500">DB 연결 후 가능</span>}
        </div>
      ))}
    </section>
  );
}

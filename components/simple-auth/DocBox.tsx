"use client";
/**
 * 간편인증 서류 조회 — 사업자 한 곳의 서류함(목록의 업체 줄 밑에 펼친다). ① DB 연결 ② 받은 증명서·원문 ③ 업체정보에 반영.
 * 반영 비교표는 「문서로 자동입력」과 같은 CompanyDocDiffTable·buildDiffRows·selectedPatch 를 그대로 쓴다.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, Download, Link2, XCircle } from "lucide-react";
import CompanyDocDiffTable from "@/components/company-doc/CompanyDocDiffTable";
import { companyInfoFieldList } from "@/components/company-info-defs";
import { buildDiffRows, selectedPatch, withBaseYear, type FileProposal } from "@/lib/document-ocr/diff";
import type { CompanyInfoKey } from "@/lib/document-ocr/types";
import type { CompanyInfo } from "@/types";
import { docLabel, type AuthRequest, type Biz } from "./view";

const BTN2 = "inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:text-gray-400";
const BTN1 = "rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500";

export type LinkTo = { to: "db"; dbId: string } | { to: "new" } | { to: "later" };

function DbLinkPanel({ biz, busy, onLink }: { biz: Biz; busy: boolean; onLink: (l: LinkTo) => void }) {
  const id = useId();
  const l = biz.link;
  const [changing, setChanging] = useState(false);
  const cands = l.state === "pick" ? l.candidates : [];
  const [pick, setPick] = useState<string>(cands[0]?.dbId ?? "");
  if ((l.state === "linked" || l.state === "later") && !changing) {
    const text = l.state === "later" ? <>연결 안 함</> : <>{l.why === "created" ? "새 DB 생성 · " : "DB: "}<b>{l.company}</b></>;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <Link2 className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-gray-800">{text}</span>
        <button type="button" onClick={() => setChanging(true)} className="text-xs font-medium text-blue-700 hover:underline">바꾸기</button>
      </div>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <legend className="sr-only">DB 연결</legend>
      <p className="text-sm font-semibold text-amber-900">{cands.length ? "어느 DB인가요?" : "이 사업자를 DB에 연결할까요?"}</p>
      {cands.length > 0 && (
        <ul className="flex flex-col gap-1">
          {cands.map((c) => (
            <li key={c.dbId}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm text-gray-800">
                <input type="radio" name={`${id}-db`} value={c.dbId} checked={pick === c.dbId} onChange={() => setPick(c.dbId)} className="accent-blue-600" />
                <span className="min-w-0 flex-1 truncate" title={c.company}>{c.company}</span>
                <span className="shrink-0 text-xs text-gray-500">{[c.owner, c.phone].filter(Boolean).join(" · ")}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {cands.length > 0 && <button type="button" disabled={!pick || busy} onClick={() => onLink({ to: "db", dbId: pick })} className={BTN1}>이 DB에 연결</button>}
        <button type="button" disabled={busy} onClick={() => onLink({ to: "new" })} className={BTN2}>새 DB로 추가</button>
        <button type="button" disabled={busy} onClick={() => onLink({ to: "later" })} className="px-2 text-sm text-gray-600 hover:underline">나중에</button>
        {changing && <button type="button" onClick={() => setChanging(false)} className="px-2 text-sm text-gray-600 hover:underline">그대로 두기</button>}
      </div>
    </fieldset>
  );
}

/** 원문 PDF 링크 — 재무제표는 연도마다 따로. 서버가 「사업자명 서류이름.pdf」 이름으로 내려준다. */
function originals(req: AuthRequest, biz: Biz, key: string, facts: string[]) {
  const base = `/api/simple-auth/${req.id}/original?biz=${encodeURIComponent(biz.bizNo)}&doc=`;
  if (key !== "fs") return [{ href: base + key, label: "원문" }];
  return facts.map((f) => f.match(/^(\d{4})년/)?.[1]).filter((y): y is string => !!y).map((y) => ({ href: base + `fs-${y}`, label: `${y} 원문` }));
}

type Props = { req: AuthRequest; biz: Biz; busy: boolean; onLink: (l: LinkTo) => void; onApply: (patch: Record<string, string>) => Promise<boolean> };

export default function DocBox({ req, biz, busy, onLink, onApply }: Props) {
  const [applying, setApplying] = useState(false);
  const [current, setCurrent] = useState<{ ci: CompanyInfo; readOnly: boolean } | null>(null);
  const [loadError, setLoadError] = useState("");
  const baseYear = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
  const { order, labelOf } = useMemo(() => {
    const fields = companyInfoFieldList(baseYear);
    const label = new Map<string, string>(fields.map(([k, l]) => [String(k), l]));
    return { order: fields.map(([k]) => String(k)), labelOf: (k: string) => label.get(k) ?? k };
  }, [baseYear]);
  const linked = biz.link.state === "linked";

  useEffect(() => {
    if (!applying || current) return;
    let alive = true;
    fetch(`/api/simple-auth/${req.id}/company?biz=${encodeURIComponent(biz.bizNo)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "불러오지 못했어요."); if (alive) setCurrent(j); })
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => { alive = false; };
  }, [applying, current, req.id, biz.bizNo]);

  const rows = useMemo(() => {
    if (!current) return [];
    const proposals: FileProposal[] = biz.results.filter((r) => r.ok && r.fields.length).map((r) => ({
      fileName: docLabel(r.key),
      fields: r.fields.map((f) => ({ key: f.key as CompanyInfoKey, value: f.value, confidence: f.confidence, warnings: [], ...(f.sourceWon !== undefined ? { sourceWon: f.sourceWon } : {}) })),
    }));
    return buildDiffRows(current.ci, proposals, order);
  }, [current, biz.results, order]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState<Record<string, number>>({});
  useEffect(() => { setChecked(Object.fromEntries(rows.map((r) => [r.key, r.defaultChecked]))); setChoice({}); }, [rows]);
  const patch = current ? withBaseYear(selectedPatch(rows, checked, choice), current.ci, baseYear) : {};
  const patchCount = Object.keys(selectedPatch(rows, checked, choice)).length;
  const canApply = biz.results.some((r) => r.ok && r.fields.length);

  return (
    <section aria-label={`${biz.name} 서류함`} className="flex flex-col gap-4 border-t border-blue-200 bg-white p-3">
      <DbLinkPanel key={`${biz.link.state}`} biz={biz} busy={busy} onLink={onLink} />

      <ul className="flex flex-col gap-2">
        {biz.results.map((d) => (
          <li key={d.key} className={`rounded-lg border px-3 py-2.5 ${d.ok ? "border-gray-200" : "border-red-200 bg-red-50"}`}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {d.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{docLabel(d.key)}</span>
              {d.ok && d.issuedAt && <span className="hidden text-xs text-gray-500 tabular-nums 2xl:inline">{d.issuedAt} 발급</span>}
              {d.ok && d.hasOriginal && originals(req, biz, d.key, d.facts).map((o) => (
                <a key={o.href} href={o.href} download className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                  <Download className="h-3.5 w-3.5" aria-hidden />{o.label}
                </a>
              ))}
            </div>
            {d.ok
              ? <ul className="mt-1 pl-6 text-base text-gray-700">{d.facts.map((f) => <li key={f} className="tabular-nums">{f}</li>)}</ul>
              : <p className="mt-1 pl-6 text-base text-red-700">{d.reason}</p>}
          </li>
        ))}
      </ul>

      {canApply && (applying ? (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">업체정보에 반영</h3>
          {loadError ? <p className="text-sm text-red-700">{loadError}</p>
            : !current ? <p className="text-sm text-gray-500">지금 업체정보를 불러오는 중…</p>
            : current.readOnly ? <p className="text-sm text-amber-800">미팅에 연결된 DB예요. 업체정보는 미팅 화면에서 고쳐 주세요.</p>
            : rows.length === 0 ? <p className="text-sm text-gray-500">반영할 칸이 없어요.</p>
            : <div className="overflow-x-auto">
                <CompanyDocDiffTable rows={rows} labelOf={labelOf} checked={checked} choice={choice}
                  onCheck={(k, v) => setChecked((c) => ({ ...c, [k]: v }))} onChoose={(k, i) => setChoice((c) => ({ ...c, [k]: i }))} />
              </div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setApplying(false)} className={BTN2}>닫기</button>
            <button type="button" disabled={patchCount === 0 || busy || !current || current.readOnly}
              onClick={async () => { if (await onApply(patch as Record<string, string>)) setApplying(false); }} className={BTN1}>{patchCount}칸 반영하기</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" disabled={!linked} onClick={() => setApplying(true)} className={BTN2}>업체정보에 반영…</button>
          {!linked && <span className="text-xs text-gray-500">DB 연결 후 가능</span>}
        </div>
      ))}
    </section>
  );
}

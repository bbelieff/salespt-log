"use client";
/**
 * 사업계획서 작성도구 — 팩트시트 입력(회사·재무 3개년·과세표준·거래처 TOP3·자금·주안점).
 * 숫자를 미리 정리해 넣으면 AI 가 PDF 를 다시 읽지 않아도 되고 틀릴 일이 줄어든다. 빈칸은 「빠진 것」 목록으로 간다.
 * 금액 단위는 백만원(업체정보와 같음). 입력한 글자는 그대로 두고, 증감률만 계산해 보여 준다.
 */
import { useId } from "react";
import {
  BIZPLAN_STORIES,
  BIZPLAN_YEAR_COLUMNS,
  growthLabel,
  type BizplanDraft,
  type BizplanPartner,
  type BizplanStory,
  type BizplanYear,
} from "@/util/bizplan-pack";

const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none";
const CELL = "w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none";
const LABEL = "text-sm font-medium text-slate-700";

type Patch = (p: Partial<BizplanDraft>) => void;

function Field({ label, value, onChange, placeholder, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "numeric" | "text";
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete="off" className={`${INPUT} mt-1`} />
    </div>
  );
}

function growthTone(label: string): string {
  if (label.startsWith("▲")) return "text-emerald-700";
  if (label.startsWith("▼")) return "text-red-600";
  return "text-slate-400";
}

function YearTable({ years, onChange }: { years: BizplanYear[]; onChange: (years: BizplanYear[]) => void }) {
  const set = (i: number, key: keyof BizplanYear, v: string) => onChange(years.map((y, j) => (j === i ? { ...y, [key]: v } : y)));
  const cols = [...BIZPLAN_YEAR_COLUMNS, "과세표준"] as const;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-1 text-sm wide:min-w-0 wide:table-fixed">
        <caption className="sr-only">재무 3개년과 부가세 과세표준, 단위 백만원</caption>
        <thead>
          <tr className="text-xs text-slate-500">
            <th scope="col" className="w-16 text-left font-medium">연도</th>
            {cols.map((c) => (
              <th key={c} scope="col" className="min-w-20 text-right font-medium">{c === "과세표준" ? "과세표준" : c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((y, i) => (
            <tr key={i}>
              <th scope="row" className="text-left">
                <input aria-label={`${i + 1}번째 연도`} value={y.year} onChange={(e) => set(i, "year", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className={`${CELL} text-left`} />
              </th>
              {cols.map((c) => {
                const g = i > 0 && (c === "매출액" || c === "과세표준") ? growthLabel(years[i - 1]![c], y[c]) : "";
                return (
                  <td key={c} className="w-24 align-top wide:w-auto">
                    <input aria-label={`${y.year}년 ${c}`} value={y[c]} onChange={(e) => set(i, c, e.target.value)} inputMode="decimal" className={CELL} />
                    {g && g !== "-" && <p className={`mt-0.5 text-right text-xs font-semibold ${growthTone(g)}`}>{g}</p>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerTable({ title, list, onChange }: { title: string; list: BizplanPartner[]; onChange: (list: BizplanPartner[]) => void }) {
  const set = (i: number, key: keyof BizplanPartner, v: string) => onChange(list.map((p, j) => (j === i ? { ...p, [key]: v } : p)));
  return (
    <div className="min-w-0">
      <p className={LABEL}>{title}</p>
      <ol className="mt-1 flex flex-col gap-1.5">
        {list.map((p, i) => (
          <li key={i} className="grid grid-cols-12 items-center gap-1.5">
            <span className="col-span-1 text-center text-xs font-bold text-slate-500">{i + 1}</span>
            <input aria-label={`${title} ${i + 1}위 거래처`} placeholder="거래처" value={p.name} onChange={(e) => set(i, "name", e.target.value)} className={`${CELL} col-span-5 text-left`} />
            <input aria-label={`${title} ${i + 1}위 품목`} placeholder="품목" value={p.item} onChange={(e) => set(i, "item", e.target.value)} className={`${CELL} col-span-3 text-left`} />
            <input aria-label={`${title} ${i + 1}위 연 거래액(백만원)`} placeholder="연 거래액" value={p.amount} onChange={(e) => set(i, "amount", e.target.value)} inputMode="decimal" className={`${CELL} col-span-3`} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function BizplanFactsForm({ draft, onPatch }: { draft: BizplanDraft; onPatch: Patch }) {
  const focusId = useId();
  const storyId = useId();
  return (
    <section aria-labelledby="bizplan-facts-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="bizplan-facts-title" className="text-base font-bold text-slate-900">팩트시트 — 숫자 확인</h2>
      <p className="mt-1 text-sm text-slate-600">위 「서류에서 숫자 읽기」로 채우거나 직접 적어 주세요. 모르는 칸은 비워 두면 AI 가 만들기 전에 물어봐요. 금액은 백만원 단위예요.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
        <Field label="업체명" value={draft.company} onChange={(v) => onPatch({ company: v })} placeholder="(주)한빛정밀" />
        <Field label="대표자" value={draft.ceo} onChange={(v) => onPatch({ ceo: v })} />
        <Field label="사업자등록번호" value={draft.bizNo} onChange={(v) => onPatch({ bizNo: v })} inputMode="numeric" />
        <Field label="업태·종목" value={draft.industry} onChange={(v) => onPatch({ industry: v })} />
        <Field label="설립일" value={draft.founded} onChange={(v) => onPatch({ founded: v })} placeholder="예: 2019년 3월" />
        <Field label="상시 근로자" value={draft.employees} onChange={(v) => onPatch({ employees: v })} placeholder="18명" />
        <div className="2xl:col-span-2">
          <Field label="소재지" value={draft.address} onChange={(v) => onPatch({ address: v })} />
        </div>
      </div>

      <h3 className="mt-5 text-sm font-bold text-slate-800">재무 3개년 · 부가세 과세표준 <span className="font-normal text-slate-500">(백만원)</span></h3>
      <div className="mt-1">
        <YearTable years={draft.years} onChange={(years) => onPatch({ years })} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 pc:grid-cols-2">
        <PartnerTable title="매출처 TOP3" list={draft.sales} onChange={(sales) => onPatch({ sales })} />
        <PartnerTable title="매입처 TOP3" list={draft.purchases} onChange={(purchases) => onPatch({ purchases })} />
      </div>

      <h3 className="mt-5 text-sm font-bold text-slate-800">신청 자금</h3>
      <div className="mt-1 grid grid-cols-1 gap-3 2xl:grid-cols-3">
        <Field label="기관·상품" value={draft.fundAgency} onChange={(v) => onPatch({ fundAgency: v })} placeholder="중진공 신성장기반" />
        <Field label="금액" value={draft.fundAmount} onChange={(v) => onPatch({ fundAmount: v })} placeholder="6억 원" />
        <Field label="용도" value={draft.fundUse} onChange={(v) => onPatch({ fundUse: v })} placeholder="CNC 설비 2대" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 2xl:grid-cols-3">
        <div className="min-w-0">
          <label htmlFor={storyId} className={LABEL}>매출 흐름</label>
          <select id={storyId} value={draft.story} onChange={(e) => onPatch({ story: e.target.value as BizplanStory })} className={`${INPUT} mt-1`}>
            {BIZPLAN_STORIES.map((s) => (
              <option key={s || "none"} value={s}>{s || "모름 (서류로 판단)"}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0 2xl:col-span-2">
          <label htmlFor={focusId} className={LABEL}>이번 사업계획서 주안점</label>
          <textarea
            id={focusId}
            rows={3}
            value={draft.focus}
            onChange={(e) => onPatch({ focus: e.target.value })}
            placeholder="예: 수출 실적을 앞세우고 신규 CNC 설비 투자 필요성을 강조. 고용 2명 증가 계획 포함."
            className={`${INPUT} mt-1 resize-y`}
          />
        </div>
      </div>
    </section>
  );
}

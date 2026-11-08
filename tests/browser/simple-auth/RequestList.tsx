"use client";
/** 간편인증 서류 조회 — 보낸 인증 목록(목업). 대표 한 명 = 한 줄, 서류가 오면 그 아래에 사업자별로 DB 연결 상태. */
import { CheckCircle2, ChevronRight, Clock, Loader2, RotateCcw, Smartphone, X, XCircle } from "lucide-react";
import { dbRow, docLabel, type AuthRequest, type Biz, type Link } from "./data";

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const GHOST = "rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";

/** DB 연결 상태. 확인이 필요한 것만 눈에 띄게. */
function LinkChip({ link }: { link: Link }) {
  const map: Record<Link["state"], [string, string]> = {
    auto: ["DB 연결됨", "bg-gray-100 text-gray-700"],
    linked: ["DB 연결됨", "bg-gray-100 text-gray-700"],
    added: ["새 DB로 추가함", "bg-gray-100 text-gray-700"],
    later: ["연결 안 함", "bg-gray-100 text-gray-500"],
    pick: ["DB 확인 필요", "bg-amber-50 text-amber-800"],
    none: ["DB에 없음", "bg-amber-50 text-amber-800"],
  };
  const [label, cls] = map[link.state];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
const linkNote = (l: Link) => (l.state === "auto" || l.state === "linked" ? `→ ${dbRow(l.dbId)?.name ?? ""}${l.state === "auto" ? ` (${l.why})` : ""}` : l.state === "pick" ? `후보 ${l.candidates.length}곳` : "");

function StatusPill({ r, now }: { r: AuthRequest; now: number }) {
  if (r.status === "waiting") {
    const left = r.deadline - now;
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${left < 60_000 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}><Clock className="h-3.5 w-3.5" aria-hidden />승인 대기 {fmt(left)}</span>;
  }
  if (r.status === "scraping") return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 tabular-nums"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />서류 받는 중 {r.progress}/{r.docs.length}</span>;
  if (r.status === "done") {
    const all = r.businesses.flatMap(b => b.results), bad = all.filter(x => !x.ok).length;
    return <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />사업자 {r.businesses.length}곳 도착</span>
      {bad > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700"><XCircle className="h-3.5 w-3.5" aria-hidden />{bad}건 실패</span>}
    </span>;
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{r.status === "expired" ? "시간 초과" : "취소함"}</span>;
}

type Props = {
  items: AuthRequest[]; now: number; selected: { reqId: string; bizNo: string } | null;
  onSelect: (reqId: string, bizNo: string) => void; onApproved: (id: string) => void; onResend: (id: string) => void; onCancel: (id: string) => void;
};

function BizRow({ b, active, onOpen }: { b: Biz; active: boolean; onOpen: () => void }) {
  const needs = b.link.state === "pick" || b.link.state === "none";
  return (
    <li className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900" title={b.name}>{b.name} <span className="text-xs font-normal text-gray-500 tabular-nums">{b.bizNo}</span></p>
        {linkNote(b.link) && <p className="truncate text-xs text-gray-500" title={linkNote(b.link)}>{linkNote(b.link)}</p>}
      </div>
      <LinkChip link={b.link} />
      <button type="button" onClick={onOpen} aria-pressed={active} className={`${GHOST} inline-flex shrink-0 items-center gap-0.5 text-blue-700 hover:bg-blue-100`}>
        {needs ? "연결하기" : "서류 보기"}<ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  );
}

export default function RequestList({ items, now, selected, onSelect, onApproved, onResend, onCancel }: Props) {
  if (items.length === 0) return (
    <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <Smartphone className="h-6 w-6 text-gray-400" aria-hidden />
      <h2 className="font-semibold text-gray-900">아직 보낸 인증이 없어요</h2>
      <p className="max-w-sm text-sm text-gray-600">왼쪽에서 대표 정보를 넣고 「인증 보내기」를 누르면, 고객이 휴대폰에서 승인하는 대로 서류가 여기에 쌓여요.</p>
    </section>
  );
  return (
    <section aria-label="보낸 인증" className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <h2 className="border-b border-gray-200 px-4 py-3 text-base font-semibold text-gray-900">보낸 인증 <span className="text-sm font-normal text-gray-500 tabular-nums">{items.length}건</span></h2>
      <ul className="divide-y divide-gray-100">
        {items.map(r => (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{r.owner} 대표 <span className="text-sm font-normal text-gray-500">· {r.phone}</span></p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{r.method} · {r.sentAt} 보냄{r.resends ? ` · 다시 보냄 ${r.resends}번` : ""} · {r.docs.map(docLabel).join(" · ")}</p>
              </div>
              <div className="shrink-0 pt-0.5"><StatusPill r={r} now={now} /></div>
            </div>
            {r.status === "waiting" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-auto text-xs text-gray-600">고객이 {r.method} 앱에서 승인하면 서류를 받아요.</span>
                <button type="button" onClick={() => onApproved(r.id)} className={`${GHOST} border border-blue-200 text-blue-700 hover:bg-blue-50`}>고객이 승인했어요</button>
                <button type="button" onClick={() => onResend(r.id)} className={`${GHOST} inline-flex items-center gap-1 text-gray-700 hover:bg-gray-100`}><RotateCcw className="h-3.5 w-3.5" aria-hidden />다시 보내기</button>
                <button type="button" onClick={() => onCancel(r.id)} className={`${GHOST} inline-flex items-center gap-1 text-gray-500 hover:bg-gray-100`}><X className="h-3.5 w-3.5" aria-hidden />취소</button>
              </div>
            )}
            {r.status === "expired" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-auto text-xs text-gray-600">4분 30초 안에 승인이 없었어요. 고객과 통화한 뒤 다시 보내 주세요.</span>
                <button type="button" onClick={() => onResend(r.id)} className={`${GHOST} inline-flex items-center gap-1 border border-gray-300 text-gray-700 hover:bg-gray-50`}><RotateCcw className="h-3.5 w-3.5" aria-hidden />다시 보내기</button>
              </div>
            )}
            {r.status === "done" && (
              <ul className="flex flex-col gap-1.5">
                {r.businesses.map(b => <BizRow key={b.bizNo} b={b} active={selected?.reqId === r.id && selected.bizNo === b.bizNo} onOpen={() => onSelect(r.id, b.bizNo)} />)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

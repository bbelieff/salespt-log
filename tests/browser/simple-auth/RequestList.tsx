"use client";
/**
 * 간편인증 서류 조회 — 보낸 인증 목록(목업, belie 2026-11-08).
 * 진행 중(승인 대기·받는 중)은 위에 펼쳐 두고, 나머지는 날짜별로 묶어 접는다(가장 최근 날짜만 펼침).
 * 날짜 묶음 안에서는 대표 이름별로 한 줄. DB 연결 + 업체정보 반영이 끝난 사업자는 빠지고, 안 된 건은 기록 삭제.
 */
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, RotateCcw, Smartphone, Trash2, X, XCircle } from "lucide-react";
import { isFinished, type AuthRequest, type Biz, type Link } from "./data";

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const GHOST = "rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";
const CHIP = "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold";

function LinkChip({ link }: { link: Link }) {
  const map: Record<Link["state"], [string, string]> = {
    auto: ["DB 연결됨", "bg-gray-100 text-gray-700"],
    linked: ["DB 연결됨", "bg-gray-100 text-gray-700"],
    created: [link.state === "created" && link.extra ? "추가 DB 생성" : "새 DB 생성", "bg-gray-100 text-gray-700"],
    later: ["연결 안 함", "bg-gray-100 text-gray-500"],
    pick: ["DB 확인 필요", "bg-amber-50 text-amber-800"],
  };
  const [label, cls] = map[link.state];
  return <span className={`${CHIP} ${cls}`}>{label}</span>;
}

function StatusPill({ r, now }: { r: AuthRequest; now: number }) {
  if (r.status === "waiting") {
    const left = r.deadline - now;
    return <span className={`${CHIP} tabular-nums ${left < 60_000 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}><Clock className="h-3.5 w-3.5" aria-hidden />승인 대기 {fmt(left)}</span>;
  }
  if (r.status === "scraping") return <span className={`${CHIP} bg-blue-50 text-blue-700 tabular-nums`}><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />서류 받는 중 {r.progress}/{r.docs.length}</span>;
  if (r.status === "done") {
    const bad = r.businesses.flatMap(b => b.results).filter(x => !x.ok).length;
    return <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`${CHIP} bg-emerald-50 text-emerald-700`}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />사업자 {r.businesses.length}곳</span>
      {bad > 0 && <span className={`${CHIP} bg-red-50 text-red-700`}><XCircle className="h-3.5 w-3.5" aria-hidden />{bad}건 실패</span>}
    </span>;
  }
  return <span className={`${CHIP} bg-gray-100 text-gray-600`}>{r.status === "expired" ? "시간 초과" : "취소함"}</span>;
}

type Sel = { reqId: string; bizNo: string } | null;
type Actions = { onSelect: (reqId: string, bizNo: string) => void; onApproved: (id: string) => void; onResend: (id: string) => void; onCancel: (id: string) => void; onDelete: (id: string) => void };
type Props = Actions & { items: AuthRequest[]; now: number; selected: Sel };

/** 요청 한 건 — 상태, 할 수 있는 일, 사업자들. */
function RequestCard({ r, now, selected, a, showOwner }: { r: AuthRequest; now: number; selected: Sel; a: Actions; showOwner: boolean }) {
  const failed = r.status === "expired" || r.status === "canceled";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
          {showOwner && <b className="font-medium text-gray-900">{r.owner} · {r.phone} · </b>}
          <span className="text-xs text-gray-500">{r.method} · {r.sentAt}</span>
        </p>
        <StatusPill r={r} now={now} />
      </div>
      {r.status === "waiting" && (
        <div className="flex flex-wrap justify-end gap-1.5">
          <button type="button" onClick={() => a.onApproved(r.id)} className={`${GHOST} border border-blue-200 text-blue-700 hover:bg-blue-50`}>승인 확인</button>
          <button type="button" onClick={() => a.onResend(r.id)} className={`${GHOST} inline-flex items-center gap-1 text-gray-700 hover:bg-gray-100`}><RotateCcw className="h-3.5 w-3.5" aria-hidden />다시 보내기</button>
          <button type="button" onClick={() => a.onCancel(r.id)} className={`${GHOST} inline-flex items-center gap-1 text-gray-500 hover:bg-gray-100`}><X className="h-3.5 w-3.5" aria-hidden />취소</button>
        </div>
      )}
      {failed && (
        <div className="flex flex-wrap justify-end gap-1.5">
          <button type="button" onClick={() => a.onResend(r.id)} className={`${GHOST} inline-flex items-center gap-1 border border-gray-300 text-gray-700 hover:bg-gray-50`}><RotateCcw className="h-3.5 w-3.5" aria-hidden />다시 보내기</button>
          <button type="button" onClick={() => a.onDelete(r.id)} className={`${GHOST} inline-flex items-center gap-1 text-red-600 hover:bg-red-50`}><Trash2 className="h-3.5 w-3.5" aria-hidden />기록 삭제</button>
        </div>
      )}
      {r.status === "done" && (
        <ul className="flex flex-col gap-1.5">
          {r.businesses.filter(b => !isFinished(b)).map(b => <BizRow key={b.bizNo} b={b} active={selected?.reqId === r.id && selected.bizNo === b.bizNo} onOpen={() => a.onSelect(r.id, b.bizNo)} />)}
        </ul>
      )}
    </div>
  );
}

function BizRow({ b, active, onOpen }: { b: Biz; active: boolean; onOpen: () => void }) {
  return (
    <li className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900" title={b.name}>{b.name} <span className="text-xs font-normal text-gray-500 tabular-nums">{b.bizNo}</span></p>
      <LinkChip link={b.link} />
      <button type="button" onClick={onOpen} aria-pressed={active} className={`${GHOST} inline-flex shrink-0 items-center gap-0.5 text-blue-700 hover:bg-blue-100`}>
        {b.link.state === "pick" ? "연결" : "보기"}<ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  );
}

/** 접힌 한 줄 요약 — 이름 · 번호 · 사업자 수 · 확인 필요/실패 표시. */
function OwnerSummary({ reqs }: { reqs: AuthRequest[] }) {
  const bizes = reqs.flatMap(r => r.businesses.filter(b => !isFinished(b)));
  const needs = bizes.filter(b => b.link.state === "pick").length;
  const failed = reqs.filter(r => r.status === "expired" || r.status === "canceled").length;
  return <span className="flex shrink-0 items-center gap-1.5">
    {bizes.length > 0 && <span className={`${CHIP} bg-gray-100 text-gray-700`}>사업자 {bizes.length}곳</span>}
    {needs > 0 && <span className={`${CHIP} bg-amber-50 text-amber-800`}>확인 {needs}</span>}
    {failed > 0 && <span className={`${CHIP} bg-gray-100 text-gray-500`}>안 됨 {failed}</span>}
  </span>;
}

export default function RequestList({ items, now, selected, ...a }: Props) {
  // 끝난 사업자를 뺀 뒤 보여 줄 게 없는 요청은 목록에서 뺀다.
  const visible = items.filter(r => r.status !== "done" || r.businesses.some(b => !isFinished(b)));
  const isActive = (r: AuthRequest) => r.status === "waiting" || r.status === "scraping";
  const today = (() => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const dates = [...new Set(visible.map(r => r.sentAt.slice(0, 5)))].sort().reverse();
  // 펼침은 「기본 펼침(오늘·진행 중·선택한 사람)」에서 사용자가 누른 것만 뒤집는다 — 새로 보낸 건도 자동으로 펼쳐진다.
  const [flipDates, setFlipDates] = useState<Set<string>>(new Set());
  const [flipOwners, setFlipOwners] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  const selReq = items.find(x => x.id === selected?.reqId);
  const dateLabel = (d: string) => `${d === today ? "오늘 · " : ""}${Number(d.slice(0, 2))}월 ${Number(d.slice(3))}일`;

  if (visible.length === 0) return (
    <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <Smartphone className="h-6 w-6 text-gray-400" aria-hidden />
      <h2 className="font-semibold text-gray-900">보낸 인증이 없어요</h2>
    </section>
  );
  return (
    <section aria-label="보낸 인증" className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <h2 className="border-b border-gray-200 px-4 py-3 text-base font-semibold text-gray-900">보낸 인증</h2>
      {dates.map(date => {
        const group = visible.filter(r => r.sentAt.startsWith(date));
        const owners = [...new Map(group.map(r => [`${r.owner}|${r.phone}`, r])).keys()];
        const open = (date === today || group.some(isActive) || selReq?.sentAt.startsWith(date) === true) !== flipDates.has(date);
        return (
          <div key={date} className="border-b border-gray-100 last:border-b-0">
            <button type="button" onClick={() => setFlipDates(s => toggle(s, date))} aria-expanded={open} className="flex w-full items-center gap-2 bg-gray-50 px-4 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500">
              {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
              <span className="tabular-nums">{dateLabel(date)}</span>
              <span className="font-normal text-gray-500">{owners.length}명</span>
            </button>
            {open && (
              <ul className="my-1 ml-6 border-l border-gray-200">
                {owners.map(ok => {
                  const reqs = group.filter(r => `${r.owner}|${r.phone}` === ok);
                  const first = reqs[0];
                  if (!first) return null;
                  const key = `${date}|${ok}`;
                  const ownerOpen = (reqs.some(isActive) || reqs.some(r => r.id === selected?.reqId)) !== flipOwners.has(key);
                  const live = reqs.find(isActive);
                  return (
                    <li key={ok}>
                      <button type="button" onClick={() => setFlipOwners(s => toggle(s, key))} aria-expanded={ownerOpen} className="flex w-full min-w-0 items-center gap-2 py-2 pl-3 pr-4 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500">
                        {ownerOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />}
                        <span className="min-w-0 flex-1 truncate text-sm"><b className="font-medium text-gray-900">{first.owner}</b> <span className="text-gray-500 tabular-nums">{first.phone}</span></span>
                        {!ownerOpen && (live ? <StatusPill r={live} now={now} /> : <OwnerSummary reqs={reqs} />)}
                      </button>
                      {ownerOpen && (
                        <div className="flex flex-col gap-3 pb-3 pl-9 pr-4">
                          {reqs.map(r => <RequestCard key={r.id} r={r} now={now} selected={selected} a={a} showOwner={false} />)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

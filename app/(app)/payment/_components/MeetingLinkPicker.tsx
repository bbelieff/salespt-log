/**
 * MeetingLinkPicker — 실무/수납 1뎁스 「영업기록 없음」 을 누르면 뜨는 미팅 고르기(2026-09-29).
 * 이름이 비슷한 미팅을 맨 위에, 나머지는 최근 미팅날짜 순. 고르면 MeetingLinkDialog(비교·선택)로.
 * 다른 계약에 이미 붙은 미팅·취소 미팅은 서버가 뺀다(/api/meetings/linkable).
 */
"use client";

import { useMemo, useState } from "react";
import MeetingLinkDialog from "@/components/payment/MeetingLinkDialog";
import { useLinkableMeetings } from "@/query/contract-link-hooks";
import { sameCompanyName } from "@/util/record-merge";

interface Props {
  row: number;
  업체명: string;
  onClose: () => void;
  onLinked: (failures: string[]) => void;
}

export default function MeetingLinkPicker({ row, 업체명, onClose, onLinked }: Props) {
  const list = useLinkableMeetings(true);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const meetings = useMemo(() => {
    const all = list.data?.meetings ?? [];
    const q = query.trim();
    const filtered = q ? all.filter((m) => m.업체명.includes(q)) : all;
    const similar = filtered.filter((m) => sameCompanyName(m.업체명, 업체명));
    const rest = filtered.filter((m) => !sameCompanyName(m.업체명, 업체명));
    return { similar, rest };
  }, [list.data, query, 업체명]);

  if (picked) {
    return <MeetingLinkDialog row={row} meetingId={picked} onClose={() => setPicked(null)} onLinked={onLinked} />;
  }

  const item = (m: (typeof meetings.similar)[number]) => (
    <li key={m.id}>
      <button type="button" onClick={() => setPicked(m.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-blue-50">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{m.업체명}</span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{m.미팅날짜.replaceAll("-", ".")}</span>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{m.상태}</span>
      </button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="연결할 영업기록 고르기">
      <div className="flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-base font-bold text-slate-900">연결할 영업기록 고르기</h2>
        <p className="mt-1 text-xs text-slate-500"><b>{업체명}</b> 을(를) 붙일 미팅을 골라 주세요. 계약일은 미팅 날짜가 돼요.</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="업체명 검색" aria-label="미팅 업체명 검색"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <div className="mt-2 min-h-0 flex-1 overflow-auto">
          {list.isLoading && <p className="py-4 text-center text-sm text-slate-500">미팅을 불러오는 중…</p>}
          {list.isError && <p className="py-4 text-center text-sm text-red-600">미팅을 불러오지 못했어요.</p>}
          {meetings.similar.length > 0 && (
            <>
              <p className="mt-1 px-2 text-xs font-bold text-blue-700">이름이 비슷한 미팅</p>
              <ul>{meetings.similar.map(item)}</ul>
            </>
          )}
          {meetings.rest.length > 0 && (
            <>
              <p className="mt-2 px-2 text-xs font-bold text-slate-500">다른 미팅 (최근 순)</p>
              <ul>{meetings.rest.map(item)}</ul>
            </>
          )}
          {list.data && meetings.similar.length + meetings.rest.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">연결할 수 있는 미팅이 없어요.</p>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">닫기</button>
        </div>
      </div>
    </div>
  );
}

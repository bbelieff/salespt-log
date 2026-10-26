"use client";
/** 비서 사서함 목록 (belie 2026-10-26) — 아침·저녁 요약이 날짜별로 쌓인다. 안 읽은 요약은 빨간 점. */
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { useInbox } from "@/query/inbox-hooks";
import { addDaysISO } from "@/service/push-schedule";
import { todayKST } from "@/util/week";
import type { InboxEntry } from "@/types/push-report";
import { SECTION_META } from "./report-sections";
import "./inbox.css";

const WEEKDAY = "일월화수목금토";
function dayLabel(iso: string, today: string) {
  const d = new Date(`${iso}T00:00:00`);
  const date = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY[d.getDay()]}요일`;
  if (iso === today) return { main: "오늘", date };
  if (iso === addDaysISO(today, -1)) return { main: "어제", date };
  return { main: date, date: "" };
}

function Entry({ e }: { e: InboxEntry }) {
  const morning = e.slot === "morning";
  const Icon = morning ? Sun : Moon;
  return <Link href={`/inbox/${e.id}` as Route} className="inbox-entry" data-unread={!e.readAt}>
    <span className="inbox-slot" data-slot={e.slot} aria-hidden><Icon size={18} strokeWidth={2} /></span>
    <span className="inbox-entry-body">
      <span className="inbox-entry-top">
        <strong>{morning ? "아침 요약" : "저녁 요약"}</strong>
        {!e.readAt && <span className="inbox-new">새 요약</span>}
        <time className="inbox-time">{e.sentAt}</time>
      </span>
      <span className="inbox-counts">{e.counts.map(c => <span key={c.key} data-tone={SECTION_META[c.key].tone} data-zero={c.n === 0}>
        {SECTION_META[c.key].short} <b>{c.n}</b>
      </span>)}</span>
    </span>
    <ChevronRight className="report-chevron" aria-hidden size={16} />
  </Link>;
}

export default function InboxList() {
  const inbox = useInbox();
  const today = todayKST();
  if (inbox.isPending) return <div className="inbox-page"><p className="inbox-muted" role="status">사서함을 불러오고 있어요…</p></div>;
  if (inbox.isError) return <div className="inbox-page"><p role="alert">사서함을 불러오지 못했어요. <button type="button" className="inbox-link" onClick={() => inbox.refetch()}>다시 불러오기</button></p></div>;
  if (!inbox.data.available) return <div className="inbox-page"><section className="inbox-empty">
    {inbox.data.viewingOther
      ? <><h2>다른 사람 화면에서는 사서함을 볼 수 없어요</h2><p>비서 사서함은 본인 계정으로 볼 때만 열려요.</p></>
      : <><h2>이 계정에는 사서함이 없어요</h2><p>비서 사서함은 수강생 계정에서 볼 수 있어요.</p></>}
  </section></div>;
  const days = new Map<string, InboxEntry[]>();
  for (const e of inbox.data.entries) days.set(e.localDate, [...(days.get(e.localDate) ?? []), e]);
  return <div className="inbox-page">
    <p className="inbox-intro">아침과 저녁, 비서가 그날 챙길 일을 정리해 여기에 넣어 둬요. 알림을 꺼 둬도 요약은 쌓이고, 90일 동안 보관해요.</p>
    {inbox.data.entries.length === 0
      ? <section className="inbox-empty"><Sun size={22} aria-hidden /><h2>아직 도착한 요약이 없어요</h2><p>내일 아침 첫 요약이 오면 여기에서 볼 수 있어요.</p></section>
      : [...days.entries()].map(([day, entries]) => {
        const label = dayLabel(day, today);
        return <section key={day} className="inbox-day" aria-label={label.main}>
          <h2 className="inbox-day-title">{label.main}{label.date && <span>{label.date}</span>}</h2>
          <ul className="inbox-entries">{entries.map(e => <li key={e.id}><Entry e={e} /></li>)}</ul>
        </section>;
      })}
  </div>;
}

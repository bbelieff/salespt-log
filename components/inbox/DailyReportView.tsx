"use client";
/** 하루요약 한 건 (belie 2026-10-26) — 아침: 영업(연락할 곳·오늘 미팅) · 실무 · 놓친 일. 저녁: 오늘 남은 일 · 내일 약속 · 놓친 일. */
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { useInboxReport } from "@/query/inbox-hooks";
import type { InboxReport, ReportItem, ReportSection, ReportSectionKey } from "@/types/push-report";
import { SECTION_META } from "./report-sections";
import "./inbox.css";

const GROUPS: Array<{ title?: string; keys: ReportSectionKey[] }> = [
  { title: "영업", keys: ["contact", "meeting"] },
  { title: "실무", keys: ["work"] },
  { keys: ["left", "tomorrow", "missed"] },
];
const WEEKDAY = "일월화수목금토";

function lead(r: InboxReport) {
  const n = (k: ReportSectionKey) => r.sections.find(s => s.key === k)?.items.length ?? 0;
  const missed = n("missed") ? ` 놓친 일 ${n("missed")}건도 함께 챙겨 주세요.` : "";
  if (r.slot === "morning") {
    const parts = [n("contact") && `연락할 곳 ${n("contact")}곳`, n("meeting") && `미팅 ${n("meeting")}건`, n("work") && `실무 ${n("work")}건`].filter(Boolean);
    return (parts.length ? `오늘은 ${parts.join(", ")}이 기다리고 있어요.` : "오늘 정해진 일은 없어요.") + missed;
  }
  const left = n("left") ? `오늘 남은 일이 ${n("left")}건 있어요.` : "오늘 할 일은 모두 마쳤어요.";
  return `${left}${n("tomorrow") ? ` 내일 약속은 ${n("tomorrow")}건이에요.` : ""}${missed}`;
}

function Row({ item, sectionKey }: { item: ReportItem; sectionKey: ReportSectionKey }) {
  return <Link href={item.href as Route} className="report-row">
    {item.time ? <span className="report-time">{item.time}</span>
      : sectionKey === "tomorrow" && <span className="report-time" data-untimed>할 일</span>}
    <span className="report-row-body">
      <strong>{item.label}</strong>
      <span>{item.tag && <em className="report-tag">{item.tag}</em>}{item.detail || (sectionKey === "meeting" || sectionKey === "tomorrow" ? "장소 미정" : "")}</span>
    </span>
    {item.overdueDays ? <span className="report-late">{item.overdueDays}일 지남</span> : null}
    <ChevronRight className="report-chevron" aria-hidden size={16} />
  </Link>;
}

function Section({ s }: { s: ReportSection }) {
  const meta = SECTION_META[s.key];
  const Icon = meta.icon;
  return <section id={`report-${s.key}`} className="report-section" data-tone={meta.tone} aria-labelledby={`report-${s.key}-title`}>
    <h3 id={`report-${s.key}-title`} className="report-section-title">
      <span className="report-icon" aria-hidden><Icon size={15} strokeWidth={2.25} /></span>
      {s.title}<b>{s.items.length}</b>
    </h3>
    {s.items.length === 0 ? <p className="report-empty">{meta.empty}</p> :
      <ul className="report-list">{s.items.map(i => <li key={i.key}><Row item={i} sectionKey={s.key} /></li>)}</ul>}
  </section>;
}

export default function DailyReportView({ id }: { id: string }) {
  const q = useInboxReport(id);
  if (q.isPending) return <div className="inbox-page"><p className="inbox-muted" role="status">요약을 불러오고 있어요…</p></div>;
  if (q.isError) return <div className="inbox-page"><p role="alert">요약을 불러오지 못했어요. <Link href="/inbox" className="inbox-link">사서함으로 돌아가기</Link></p></div>;
  const r = q.data.report;
  const d = new Date(`${r.localDate}T00:00:00`);
  const morning = r.slot === "morning";
  const SlotIcon = morning ? Sun : Moon;
  return <article className="inbox-page report">
    <header className="report-head" data-slot={r.slot}>
      <p className="report-when"><SlotIcon size={14} aria-hidden />{d.getMonth() + 1}월 {d.getDate()}일 {WEEKDAY[d.getDay()]}요일 · {r.sentAt}</p>
      <h2>{morning ? "아침 요약" : "저녁 요약"}</h2>
      <p className="report-lead">{lead(r)}</p>
      <nav className="report-jump" aria-label="구역으로 이동">
        {r.sections.map(s => <a key={s.key} href={`#report-${s.key}`} data-tone={SECTION_META[s.key].tone} data-zero={s.items.length === 0}>
          {SECTION_META[s.key].short}<b>{s.items.length}</b>
        </a>)}
      </nav>
    </header>
    {GROUPS.map(g => {
      const sections = g.keys.map(k => r.sections.find(s => s.key === k)).filter((s): s is ReportSection => !!s);
      if (!sections.length) return null;
      return <div key={g.keys.join()} className="report-group">
        {g.title && <h2 className="report-group-title">{g.title}</h2>}
        {sections.map(s => <Section key={s.key} s={s} />)}
      </div>;
    })}
    <footer className="report-foot">
      <p>{r.sentAt} 기준으로 정리한 요약이에요. 그 뒤에 처리한 일은 대시보드에 반영돼 있어요.</p>
      <div className="report-foot-actions">
        <Link href="/dashboard" className="report-button">대시보드에서 지금 상태 보기</Link>
        <Link href="/inbox" className="inbox-link">사서함 목록</Link>
      </div>
    </footer>
  </article>;
}

"use client";
/** 트레이닝일지 목록 (belie 2026-10-30) — 최신 주차가 위. 서버가 내 일지만 준다. */
import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, NotebookPen } from "lucide-react";
import { useTrainingLogs } from "@/query/training-log-hooks";
import type { TrainingLogList as ListView } from "@/types/training-log";
import "./training-log.css";

const EMPTY: Record<Exclude<ListView["status"], "ok">, { title: string; body: string }> = {
  not_configured: { title: "트레이닝일지 연결을 준비하고 있어요", body: "연결이 끝나면 여기에서 내 일지를 볼 수 있어요." },
  no_cohort: { title: "수강생 계정에서 볼 수 있어요", body: "트레이닝일지는 기수에 등록된 수강생 본인의 기록만 보여 줘요." },
  no_database: { title: "우리 기수 트레이닝일지를 찾지 못했어요", body: "트레이너가 일지를 만들면 여기에 나타나요." },
  unavailable: { title: "지금은 일지를 불러올 수 없어요", body: "잠시 뒤 다시 열어 주세요." },
};

export default function TrainingLogList() {
  const logs = useTrainingLogs();
  if (logs.isPending) return <div className="tlog-page"><p className="tlog-muted" role="status">트레이닝일지를 불러오고 있어요…</p></div>;
  if (logs.isError) return <div className="tlog-page"><p role="alert">트레이닝일지를 불러오지 못했어요. <button type="button" className="tlog-link" onClick={() => logs.refetch()}>다시 불러오기</button></p></div>;
  const data = logs.data;
  if (data.status !== "ok") return <div className="tlog-page"><section className="tlog-empty"><NotebookPen size={22} aria-hidden /><h2>{EMPTY[data.status].title}</h2><p>{EMPTY[data.status].body}</p></section></div>;
  return <div className="tlog-page">
    <p className="tlog-intro">매주 1:1 트레이닝 뒤 트레이너가 남긴 기록이에요. 내 일지만 보여요.</p>
    {data.items.length === 0
      ? <section className="tlog-empty"><NotebookPen size={22} aria-hidden /><h2>아직 일지가 없어요</h2><p>첫 트레이닝이 끝나면 여기에 쌓여요.</p></section>
      : <ul className="tlog-entries">{data.items.map(item => <li key={item.id}>
        <Link href={`/training-log/${item.id}` as Route} className="tlog-entry">
          <span className="tlog-week" aria-hidden>{item.week ?? "–"}<small>{item.week ? "주차" : ""}</small></span>
          <span className="tlog-entry-title">{item.title || "제목 없음"}</span>
          <ChevronRight className="tlog-chevron" aria-hidden size={16} />
        </Link>
      </li>)}</ul>}
  </div>;
}

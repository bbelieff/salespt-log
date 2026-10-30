"use client";
/** 트레이닝일지 한 편 (belie 2026-10-30) — 노션 본문을 읽기 전용으로 그린다. 노션으로 가는 링크는 두지 않는다. */
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { useTrainingLog } from "@/query/training-log-hooks";
import LogBlocks from "./LogBlocks";
import "./training-log.css";

export default function TrainingLogView({ id }: { id: string }) {
  const log = useTrainingLog(id);
  const back = <Link href={"/training-log" as Route} className="tlog-back"><ChevronLeft size={16} aria-hidden />내 일지 목록</Link>;
  if (log.isPending) return <div className="tlog-page">{back}<p className="tlog-muted" role="status">일지를 불러오고 있어요…</p></div>;
  if (log.isError) {
    const missing = (log.error as { status?: number }).status === 404;
    return <div className="tlog-page">{back}<p role="alert">{missing ? "이 일지는 볼 수 없어요. 내 일지 목록에서 다시 골라 주세요." : <>일지를 불러오지 못했어요. <button type="button" className="tlog-link" onClick={() => log.refetch()}>다시 불러오기</button></>}</p></div>;
  }
  return <div className="tlog-page">
    {back}
    <header className="tlog-head">
      {log.data.week !== null && <span className="tlog-head-week">{log.data.week}주차</span>}
      <h2>{log.data.title || "제목 없음"}</h2>
    </header>
    <article className="tlog-doc"><LogBlocks blocks={log.data.blocks} /></article>
  </div>;
}

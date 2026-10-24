/**
 * /badges — 배지 수집(belie 승인 목업 2026-10-24). 로고 메뉴 「배지 수집」에서 들어온다.
 * 모은 개수 + 다음 배지 하나 + 그룹별 배지판. 배지를 누르면 크게 보기.
 * 다른 사람에게 보이지 않고, 얻은 배지는 기록에서 다시 계산한다(순위·비교·회수 없음).
 */
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useMemo, useState } from "react";
import TopHeader from "@/components/TopHeader";
import PageContainer from "@/components/PageContainer";
import BadgeMedal from "@/components/badges/BadgeMedal";
import BadgeDetailSheet, { badgeDateLabel } from "@/components/badges/BadgeDetailSheet";
import { markSeen, newBadgeIds, readSeen } from "@/components/badges/badge-seen";
import { BADGES, BADGE_GROUPS, type BadgeDef, type BadgeGroup } from "@/lib/analytics/badge-catalog";
import type { BadgeState } from "@/lib/analytics/badges";
import { useBadges } from "@/query/badge-hooks";
import { useMe } from "@/query/me-hook";
import { todayKST } from "@/util/week";

type Row = { def: BadgeDef; state: BadgeState };

/** 가장 가까운 다음 배지 — 진행 막대가 있는 것 중 남은 비율이 가장 작은 것, 없으면 처음 할 일 하나. */
function pickNext(rows: readonly Row[]): Row | null {
  const open = rows.filter(r => r.def.ready && !r.state.earned && r.def.group !== "secret");
  const withBar = open.filter(r => r.state.progress)
    .sort((a, b) => (1 - a.state.progress!.cur / a.state.progress!.max) - (1 - b.state.progress!.cur / b.state.progress!.max));
  return withBar[0] ?? open.find(r => r.def.cta) ?? null;
}

function TileStatus({ row }: { row: Row }) {
  const { def, state } = row;
  if (state.earned) return <span className="text-px-11 font-semibold text-emerald-700">{state.earnedOn ? `${badgeDateLabel(state.earnedOn)} 획득` : "획득"}</span>;
  if (!def.ready && def.group !== "secret") return <span className="text-px-11 text-gray-400">준비 중</span>;
  const p = state.progress;
  if (!p) return <span className="text-px-11 text-gray-400">잠김</span>;
  return <>
    <span className="badge-meter mt-0.5 w-3/4" aria-hidden="true"><i style={{ width: `${Math.round((p.cur / p.max) * 100)}%` }} /></span>
    <span className="text-px-11 tabular-nums text-gray-400">{p.cur} / {p.max}{p.unit}</span>
  </>;
}

export default function BadgesPage() {
  const me = useMe();
  const q = useBadges();
  const [filter, setFilter] = useState<BadgeGroup | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const closeSheet = useCallback(() => setOpenId(null), []);
  const who = me.data?.email ?? "";
  const today = todayKST();

  const rows = useMemo<Row[]>(() => {
    const byId = new Map((q.data?.badges ?? []).map(s => [s.id, s]));
    return BADGES.map(def => ({ def, state: byId.get(def.id) ?? { id: def.id, earned: false, earnedOn: null, progress: null } }));
  }, [q.data]);

  // 이번 방문에 보여 줄 NEW 를 잡아 두고, 바로 「본 것」으로 기억해 헤더 점을 끈다.
  useEffect(() => {
    if (!q.data || !who) return;
    setFresh(new Set(newBadgeIds(q.data.badges, readSeen(who), today)));
    markSeen(who, q.data.badges);
  }, [q.data, who, today]);

  const got = rows.filter(r => r.state.earned);
  const recent = [...got].filter(r => r.state.earnedOn).sort((a, b) => b.state.earnedOn!.localeCompare(a.state.earnedOn!)).slice(0, 3);
  const next = pickNext(rows);
  const open = rows.find(r => r.def.id === openId) ?? null;
  const pct = Math.round((got.length / BADGES.length) * 100);

  return (
    <>
      <TopHeader pageEmoji="🏅" pageTitle="배지 수집" pageSubtitle={q.data ? `${got.length} / ${BADGES.length}` : undefined} />
      <section className="px-4 pb-6 pt-3">
        <PageContainer width="wide" className="flex flex-col gap-4">
          {q.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              배지를 불러오지 못했어요. <button type="button" className="font-bold underline" onClick={() => void q.refetch()}>다시 시도</button>
            </div>
          )}
          {q.isLoading && <p className="py-10 text-center text-sm text-gray-400">배지를 모으는 중…</p>}
          {q.data && <>
            <div className="grid gap-3 2xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <div className="text-xs font-bold text-gray-500">모은 배지</div>
                    <div className="text-3xl font-black tabular-nums text-gray-900">{got.length} <span className="text-base font-bold text-gray-400">/ {BADGES.length}</span></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="badge-meter badge-meter--total" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
                    {recent.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                        최근
                        {recent.map(r => (
                          <span key={r.def.id} className="inline-flex items-center gap-1 rounded-full border border-gray-200 py-0.5 pl-0.5 pr-2 font-semibold text-gray-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/badges/${r.def.img}.png`} alt="" className="h-5 w-5" />{r.def.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {next && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <BadgeMedal img={next.def.img} tier={next.def.tier} locked={false} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-amber-700">다음 배지</div>
                    <div className="text-base font-black text-gray-900">{next.def.name}</div>
                    {next.state.progress ? <>
                      <div className="text-sm text-gray-700">{next.state.progress.max - next.state.progress.cur}{next.state.progress.unit} 남았어요 · {next.state.progress.cur} / {next.state.progress.max}{next.state.progress.unit}</div>
                      <div className="badge-meter badge-meter--next mt-1.5" aria-hidden="true"><i style={{ width: `${Math.round((next.state.progress.cur / next.state.progress.max) * 100)}%` }} /></div>
                    </> : <div className="text-sm text-gray-700">{next.def.how}</div>}
                    {next.def.cta && (
                      <Link href={next.def.cta.href as Route} className="mt-2.5 inline-flex min-h-9 items-center rounded-lg bg-gray-900 px-3.5 text-sm font-bold text-white">{next.def.cta.label}</Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="그룹">
              {([{ id: "all", name: "전체" }, ...BADGE_GROUPS] as Array<{ id: BadgeGroup | "all"; name: string }>).map(g => {
                const list = g.id === "all" ? rows : rows.filter(r => r.def.group === g.id);
                const on = filter === g.id;
                return (
                  <button key={g.id} type="button" aria-pressed={on} onClick={() => setFilter(g.id)}
                    className={`min-h-9 shrink-0 rounded-full border px-3 text-sm font-semibold tabular-nums ${on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"}`}>
                    {g.name} {list.filter(r => r.state.earned).length}/{list.length}
                  </button>
                );
              })}
            </div>

            {BADGE_GROUPS.filter(g => filter === "all" || filter === g.id).map(g => {
              const list = rows.filter(r => r.def.group === g.id);
              return (
                <section key={g.id} className="flex flex-col gap-2" aria-labelledby={`badge-group-${g.id}`}>
                  <div>
                    <h2 id={`badge-group-${g.id}`} className="text-sm font-black text-gray-900">{g.name} <span className="text-xs font-bold tabular-nums text-gray-400">{list.filter(r => r.state.earned).length} / {list.length}</span></h2>
                    <p className="text-xs text-gray-500">{g.hint}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 2xl:grid-cols-6">
                    {list.map(r => {
                      const hidden = r.def.group === "secret" && !r.state.earned;
                      return (
                        <button key={r.def.id} type="button" onClick={() => setOpenId(r.def.id)}
                          aria-label={`${hidden ? "숨은 배지" : r.def.name} ${r.state.earned ? "획득" : "잠김"}`}
                          className="relative flex min-w-0 flex-col items-center gap-1 rounded-xl border border-gray-100 bg-white px-1.5 pb-2.5 pt-3 text-center hover:border-gray-300">
                          {fresh.has(r.def.id) && <span className="badge-new">NEW</span>}
                          <BadgeMedal img={r.def.img} tier={r.def.tier} locked={!r.state.earned} hidden={hidden} size="sm" />
                          <span className="break-keep text-xs font-bold leading-tight text-gray-900">{hidden ? "???" : r.def.name}</span>
                          <TileStatus row={r} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <p className="text-center text-px-11 text-gray-400">
              배지는 한 번 얻으면 사라지지 않아요. 다른 사람에게는 보이지 않아요.
              {q.data.partial && " 일부 기록을 아직 읽지 못해 배지가 덜 보일 수 있어요."}
            </p>
          </>}
        </PageContainer>
      </section>
      {open && <BadgeDetailSheet def={open.def} state={open.state} onClose={closeSheet} />}
    </>
  );
}

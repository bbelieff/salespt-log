"use client";
import { useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/PageContainer";
import TopHeader from "@/components/TopHeader";
import WeeklyGoalSummary from "@/components/weekly-goals/WeeklyGoalSummary";
import { useDBOverview } from "@/query/db-hooks";
import { CHANNELS, CHANNEL_KEYS, KEY_TO_BACKEND, summarizeCost, type ChannelKey } from "./_lib/channels";
import ChannelTabs from "./_components/ChannelTabs";
import OverallCard from "./_components/OverallCard";
import DbNudgeBanner from "./_components/DbNudgeBanner";
import DbChannelWorkspace from "./_components/DbChannelWorkspace";
type BackendRow = { row: number } & Record<string, unknown>;
const CHANNEL_ROWS_KEY = { purchase: "purchases", direct: "productions", banner: "banners", referral: "leads" };

export default function DbPage() {
  const overview = useDBOverview();
  const [activeCh, setActiveCh] = useState<ChannelKey | null>(null);
  const [visited, setVisited] = useState<ChannelKey[]>([]);
  const switchChannel = (channel: ChannelKey) => {
    setVisited((previous) => previous.includes(channel) ? previous : [...previous, channel]);
    setActiveCh(channel);
  };
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("channel");
    const channel = CHANNEL_KEYS.find((key) => KEY_TO_BACKEND[key] === requested);
    if (channel) switchChannel(channel);
  }, []);
  const rowsByChannel = useMemo(() => {
    const empty: Record<ChannelKey, BackendRow[]> = {
      purchase: [],
      direct: [],
      banner: [],
      referral: [],
    };
    if (!overview.data) return empty;
    const data = overview.data as unknown as Record<string, BackendRow[]>;
    return {
      purchase: data[CHANNEL_ROWS_KEY.purchase] ?? [],
      direct: data[CHANNEL_ROWS_KEY.direct] ?? [],
      banner: data[CHANNEL_ROWS_KEY.banner] ?? [],
      referral: data[CHANNEL_ROWS_KEY.referral] ?? [],
    };
  }, [overview.data]);

  const overall = useMemo(() => {
    const items = CHANNEL_KEYS.map((k) => {
      const meta = CHANNELS[k];
      const rs = rowsByChannel[k];
      if (meta.isCost) {
        const s = summarizeCost(k, rs);
        return {
          key: k,
          name: meta.name,
          color: meta.color,
          count: s.totalCount,
          unit: s.unitLabel,
          cost: s.totalCost,
          isCost: true as const,
        };
      }
      return {
        key: k,
        name: meta.name,
        color: meta.color,
        count: rs.length,
        unit: "건",
        cost: null as number | null,
        isCost: false as const,
      };
    });
    const totalCost = items.reduce((s, it) => s + (it.cost ?? 0), 0);
    const totalCount = items.reduce((s, it) => s + it.count, 0);
    return { items, totalCost, totalCount };
  }, [rowsByChannel]);


  return <>
    <TopHeader pageEmoji="📊" pageTitle="DB생산" />
    <main className="px-4 pb-[80px] pt-3"><PageContainer width="wide">
      <section aria-label="입력할 채널" className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-slate-900">어떤 DB를 기록할까요?</h2>
        <p className="mb-3 mt-1 text-xs text-slate-500">채널을 누르면 바로 입력할 수 있어요.</p>
        <ChannelTabs activeCh={activeCh} onSwitch={switchChannel} />
      </section>
      {activeCh === null && <p className="mb-3 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">위에서 입력할 채널을 선택해 주세요.</p>}
      {/* Keep visited channel forms mounted: switching never discards edits or adds confirmation clicks. */}
      {visited.map((channel) => <div key={channel} hidden={channel !== activeCh}>
        <DbChannelWorkspace activeCh={channel} />
      </div>)}
      <OverallCard items={overall.items} totalCost={overall.totalCost} totalCount={overall.totalCount}
        activeCh={activeCh} goalSummary={<WeeklyGoalSummary compact metrics={["production", "inflow"]} />} />
      <DbNudgeBanner onGoDirect={() => switchChannel("direct")} />
    </PageContainer></main>
  </>;
}

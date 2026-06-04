/**
 * useDbProductionCheck — 컨택 생산 저장 후 DB합 일치 검사 + 결과 모달 상태.
 *
 * page.tsx 의 모든 저장 경로(handleSave·registerNewSlot)가 이 훅의 checkDbAfterSave 를
 * 거치도록 중앙화(과거 registerNewSlot 경로에서 검사 누락 버그 수정, 2026-06-04).
 *  - dbOverview 미로딩이면 refetch 로 신선값 확보(조용히 skip 금지).
 *  - 검사는 *그 저장에 쓰인 channels* 로 수행(draft 전역 아님).
 */
import { useState } from "react";
import type { Channel } from "@/types";
import type { ChannelDailyRowMetrics, DBOverview } from "@/service";
import {
  findProductionMismatch,
  type ProductionMismatch,
} from "./dbProductionCheck";

/** UseQueryResult<DBOverview> 와 구조적으로 호환되는 최소 타입(react-query import 회피). */
type DbOverviewQuery = {
  data?: DBOverview;
  refetch: () => Promise<{ data?: DBOverview }>;
};

export function useDbProductionCheck(dbOverview: DbOverviewQuery) {
  const [dbMismatch, setDbMismatch] = useState<ProductionMismatch | null>(null);
  const [dbMatchOk, setDbMatchOk] = useState<{
    channel: Channel;
    count: number;
  } | null>(null);

  const checkDbAfterSave = async (
    dateAtClick: string,
    channels: Record<Channel, ChannelDailyRowMetrics>,
  ) => {
    let data = dbOverview.data;
    if (!data) data = (await dbOverview.refetch()).data;
    if (!data) {
      console.warn("[contact] DB overview 미로딩 — 생산 일치 검사 skip");
      return;
    }
    const m = findProductionMismatch(data, dateAtClick, channels);
    if (m) {
      setDbMismatch(m);
      return;
    }
    // 검증 대상(현수막 제외) 중 생산을 입력한 채널이 있으면 일치 확인.
    const verifiable: Channel[] = ["매입DB", "직접생산", "콜·지·기·소"];
    const okCh = verifiable.find((c) => channels[c].production > 0);
    if (okCh) setDbMatchOk({ channel: okCh, count: channels[okCh].production });
  };

  return { dbMismatch, setDbMismatch, dbMatchOk, setDbMatchOk, checkDbAfterSave };
}

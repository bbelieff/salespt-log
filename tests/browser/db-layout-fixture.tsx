import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import RowForm from "../../app/(app)/db/_components/RowForm";
import { CHANNELS, type ChannelKey } from "../../app/(app)/db/_lib/channels";

function Fixture() {
  const [channel, setChannel] = useState<ChannelKey>("purchase");
  const [editing, setEditing] = useState(false);
  const [row, setRow] = useState<Record<string, unknown>>({});
  return <main className="mx-auto max-w-5xl p-4">
    <h1 className="mb-3 text-lg font-bold">DB생산 필드 정렬 — 로컬 검증</h1>
    <nav className="mb-3 flex flex-wrap gap-2">{Object.entries(CHANNELS).map(([key, item]) =>
      <button className="rounded border bg-white px-3 py-2 text-sm" key={key} onClick={() => setChannel(key as ChannelKey)}>{item.name}</button>)}
      <button className="rounded border bg-white px-3 py-2 text-sm" onClick={() => setEditing(!editing)}>{editing ? "추가 모드로" : "편집 모드로"}</button>
    </nav>
    <section className="rounded-xl border border-blue-200 bg-white p-4" aria-label={`${CHANNELS[channel].name} ${editing ? "편집" : "추가"}`}>
      <h2 className="mb-3 text-sm font-bold">{CHANNELS[channel].name} {editing ? "편집" : "추가"}</h2>
      <RowForm key={`${channel}-${editing}`} channel={CHANNELS[channel]} initial={editing ? { 업체명: "검증용 업체", 주문개수: 10, 개당단가: 1000, 생산개수: 10, 기간예산: 10000 } : undefined} onChange={setRow} />
    </section>
    <details className="mt-4"><summary>계산 결과</summary><pre className="overflow-auto text-xs">{JSON.stringify(row, null, 2)}</pre></details>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);

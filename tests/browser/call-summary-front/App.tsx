/** 통화 정리 앞단(PR-5a) 화면 확인용 — 가상 업체·번호, 서버 요청은 가짜 응답. ?s=list|pick|copied|upload|upload-ios|file-ok|file-warn|bar */
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Grid } from "@/app/(app)/db-sheet/_components/Grid";
import { blank, defaults, type Row } from "@/app/(app)/db-sheet/_components/model";
import { useCallUi } from "@/app/(app)/db-sheet/_components/CallUi";
import { CallDialDialog } from "@/app/(app)/db-sheet/_components/CallDial";
import { CallUploadDialog } from "@/app/(app)/db-sheet/_components/CallUploadDialog";

const scene = new URLSearchParams(location.search).get("s") || "list";
if (scene === "upload-ios") Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)" });
const DIALED = Date.now() - 4 * 60_000;
const lead = (i: number, company: string, phone: string, result = "미컨택"): Row => ({ ...blank(), id: `00000000-0000-4000-8000-00000000000${i}`, company, owner: "김가상", phone, result, date: "2026-11-03", supplier: "합성 공급처" });
const rows = [
  lead(1, "가상기계", "010-0000-1234"),
  lead(2, "달빛분식", "010-0000-5678", "부재"),
  lead(3, "세움오토텍 주식회사 화성 제2공장 부품사업부", "010-0000-9012", "재통화"),
  lead(4, "푸른공방", ""),
  lead(5, "한결인쇄", "010-0000-3456"),
  lead(6, "가상물산", "010-0000-7777"),
];
const call = (i: number, status: string) => ({ id: `call-${i}`, leadId: rows[i - 1]!.id, email: "fixture@example.test", spreadsheetId: "s", status, source: status === "dialed" ? null : "audio", calledAt: new Date(DIALED).toISOString(), audioSeconds: null, transcript: "", extraction: null, error: status === "failed" ? "AI 가 바빠요(503)" : "", attempts: 1, createdAt: new Date(DIALED).toISOString(), confirmedAt: null });
const calls = [call(1, "dialed"), call(2, "processing"), call(3, "review"), call(5, "failed")];
window.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(url), body = u === "/api/calls" && init?.method !== "POST" ? { calls } : u === "/api/calls" ? { id: "call-new" } : { ok: true };
  await new Promise(r => setTimeout(r, 150));
  return new Response(JSON.stringify(body), { status: 200 });
};
localStorage.clear();
if (scene === "copied") localStorage.setItem("db-sheet-call-app", "adot");

function PickFile({ name }: { name: string }) {
  useEffect(() => { const t = setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(1_250_000)], name, { lastModified: DIALED + 2 * 60_000 }));
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  }, 50); return () => clearTimeout(t); }, [name]);
  return null;
}

function Fixture() {
  const ui = useCallUi(rows);
  const r = rows[0]!;
  const dialed = calls[0] as never;
  if (scene === "pick" || scene === "copied") return <CallDialDialog row={r} onDialed={() => {}} onClose={() => {}} />;
  if (scene.startsWith("upload") || scene.startsWith("file")) return <>
    <CallUploadDialog row={r} call={dialed} asked onUploaded={() => {}} onClose={() => {}} />
    {scene === "file-ok" && <PickFile name="통화 녹음 010-0000-1234_261103_140211.m4a" />}
    {scene === "file-warn" && <PickFile name="통화 녹음 010-0000-5678_261103_135511.m4a" />}
  </>;
  if (scene === "bar") return <div className="fixture-detail"><h2>가상기계</h2><div className="db-contact-bottom">{ui.bar(r)}</div>{ui.bar(rows[3]!)}{ui.layer}</div>;
  return <section className="sheet-panel"><Grid rows={rows} visible={defaults} fail={false} onChange={() => {}} onDetail={() => {}} callSlot={ui.enabled ? ui.slot : undefined} />{ui.layer}</section>;
}
document.body.classList.add("db-sheet-route");
createRoot(document.getElementById("root")!).render(<Fixture />);

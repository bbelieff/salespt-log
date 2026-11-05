/** 통화 정리 화면 확인용(PR-5a·5b) — 가상 업체·번호, 서버 요청은 가짜 응답. ?s=list|pick|pick-ios|copied|upload|upload-ios|file-ok|file-warn|notice|bar|confirm|confirm-nomeet */
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Grid } from "@/app/(app)/db-sheet/_components/Grid";
import { blank, defaults, type Row } from "@/app/(app)/db-sheet/_components/model";
import { useCallUi } from "@/app/(app)/db-sheet/_components/CallUi";
import { CallDialDialog } from "@/app/(app)/db-sheet/_components/CallDial";
import { CallUploadDialog } from "@/app/(app)/db-sheet/_components/CallUploadDialog";
import { CallConfirmScreen } from "@/app/(app)/db-sheet/_components/CallConfirmScreen";
import { CallExtraction } from "@/types/call";
import { DbSheetContact, type DbSheetLead } from "@/types/db-sheet";

const scene = new URLSearchParams(location.search).get("s") || "list";
if (scene.endsWith("-ios")) Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)" });
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
const extraction = CallExtraction.parse({
  summary: ["작년 매출 35억, 올해 10월까지 28억", "설비 증설 자금 3억 필요 — 포장 라인 교체", "다음 주 화요일 오후 2시 공장 방문 약속"],
  memo: "설비 증설(포장 라인) 자금 필요. 법인 7년차, 작년 매출 35억.\n기보 5억 이용 중 — 추가 한도 확인 필요.",
  answered: [1, 2, 3, 4, 5, 6, 7, 8, 11, 12], lead: { company: "가상기계", owner: "김가상" },
  company: { 대표자이름: "김가상", 신용점수: "780", 기대출개인: "신용대출 30백만 (2025)", 개업일: "2019-03", 사업자구분: "법인", 소재지: "경기도 합성시 가상읍 공단로 12", 주생산품목: "즉석 반찬·소스", 사대보험직원: "23명", 과년도매출: "3,500", 과년도매출Y2: "2,900", 금년도매출: "2,800", 매출기준연도: "2026", 기대출사업자: "기보 500백만 (2023)" },
  custom: { 필요자금: "300백만", "자금 사용 목적": "포장 라인 설비 교체" },
  meeting: scene === "confirm-nomeet" ? null : { meetingDate: "2026-11-10", time: "14:00", place: "공장 사무실(경기도 합성시 가상읍 공단로 12)", reservationNote: "" },
  evidence: { 신용점수: "상대: 신용점수 780점 정도일 거예요.", 과년도매출: "상대: 작년에 35억 정도요.", 개업일: "상대: 2019년 3월에 개업했어요.", meeting: "상대: 다음 주 화요일 두 시 어때요? 공장 사무실로 오세요.", "custom.필요자금": "상대: 3억 정도 필요해요." },
});
const calls = [call(1, "dialed"), call(2, "processing"), { ...call(3, "review"), extraction, transcript: "나: 대표님 안녕하세요.\n상대: 네, 말씀하세요.\n상대: 다음 주 화요일 두 시 어때요?" }, call(5, "failed")];
const confirmLead = { ...rows[2]!, revision: 4, contact: DbSheetContact.parse({ note: "지난주 첫 통화 — 자료 요청함", ci: scene === "confirm-nomeet" ? { 소재지: "합성시 가상읍", 매출기준연도: "2025", 금년도매출: "3,100" } : { 소재지: "합성시 가상읍", 대표자이름: "김가상" } }) } as unknown as DbSheetLead;
const realFetch = window.fetch.bind(window);
/** 보낸 본문 기록 — 받아쓴 통화 내용 파일에서 뽑은 글이 그대로 가는지 본다. */
(window as unknown as { __sent: unknown[] }).__sent = [];
window.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
  const u = String(url);
  if (!u.startsWith("/api/")) return realFetch(url, init);
  if (typeof init?.body === "string") (window as unknown as { __sent: unknown[] }).__sent.push({ u, body: JSON.parse(init.body) });
  const body = u === "/api/calls" && init?.method !== "POST" ? { calls } : u === "/api/calls" ? { id: "call-new" } : { ok: true };
  await new Promise(r => setTimeout(r, 150));
  return new Response(JSON.stringify(body), { status: 200 });
};
localStorage.clear();
if (scene === "copied") localStorage.setItem("db-sheet-call-app", "adot");
if (scene === "upload-ixio") localStorage.setItem("db-sheet-call-app", "ixio"); // 갤럭시 + 익시오 사용자

function PickFile({ name, then }: { name: string; then?: string }) {
  useEffect(() => { const t = setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(1_250_000)], name, { lastModified: DIALED + 2 * 60_000 }));
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
    if (then) setTimeout(() => [...document.querySelectorAll("button")].find(b => b.textContent === then)?.click(), 50);
  }, 50); return () => clearTimeout(t); }, [name, then]);
  return null;
}

function Fixture() {
  const ui = useCallUi(rows as unknown as DbSheetLead[], () => {});
  const r = rows[0]!;
  const dialed = calls[0] as never;
  if (scene.startsWith("pick") || scene === "copied") return <CallDialDialog row={r} onDialed={() => {}} onClose={() => {}} />;
  if (scene.startsWith("upload") || scene.startsWith("file") || scene === "notice") return <>
    <CallUploadDialog row={r} call={dialed} asked onUploaded={() => {}} onClose={() => {}} />
    {(scene === "file-ok" || scene === "notice") && <PickFile name="통화 녹음 010-0000-1234_261103_140211.m4a" then={scene === "notice" ? "올리기" : undefined} />}
    {scene === "file-warn" && <PickFile name="통화 녹음 010-0000-5678_261103_135511.m4a" />}
  </>;
  if (scene.startsWith("confirm")) return <CallConfirmScreen lead={confirmLead} call={calls[2] as never} onSaved={() => {}} onClose={() => {}} />;
  if (scene === "bar") return <div className="fixture-detail"><h2>가상기계</h2><div className="db-contact-bottom">{ui.bar(r)}</div>{ui.bar(rows[3]!)}{ui.layer}</div>;
  return <section className="sheet-panel"><Grid rows={rows} visible={defaults} fail={false} onChange={() => {}} onDetail={() => {}} callSlot={ui.enabled ? ui.slot : undefined} />{ui.layer}</section>;
}
document.body.classList.add("db-sheet-route");
createRoot(document.getElementById("root")!).render(<Fixture />);

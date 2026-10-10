"use client";
import { useEffect, useRef, useState } from "react";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useQueryClient } from "@tanstack/react-query";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import { todayKST } from "@/util/week";
import type { Row, Key } from "./model";
import { contactDraft, type ContactDraft } from "./ContactPanel";

async function request(body?: unknown): Promise<DbSheetLead[]> {
  const response = await fetch("/api/db-sheet", body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "저장하지 못했습니다.");
  return payload.leads;
}
export function useDbSheet() {
  const [leads, setLeads] = useState<DbSheetLead[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(0), [error, setError] = useState("");
  const local = useRef<DbSheetLead[]>([]), server = useRef(new Map<string, DbSheetLead>());
  const tail = useRef(Promise.resolve()), blocked = useRef(false), versions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queryClient = useQueryClient();
  function show(rows: DbSheetLead[]) { local.current = rows; setLeads(rows); }
  useEffect(() => {
    let active = true;
    request().then(rows => { if (active) { server.current = new Map(rows.map(r => [r.id, r])); versions.current = new Map(rows.map(r=>[r.id,0])); show(rows); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (pending || error) event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [pending, error]);
  function enqueue(work: () => Promise<void>): Promise<void> {
    setPending(n => n + 1);
    const job = tail.current.then(async () => {
      if (blocked.current) throw new Error("앞선 저장이 실패했습니다. 입력 내용을 보관한 뒤 새로고침해 주세요.");
      await work();
      await Promise.all(["day", "week", "month", "dashboard", "db-sheet", "db"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    });
    tail.current = job.catch(e => { blocked.current = true; setError(e.message); }).finally(() => setPending(n => n - 1));
    return job;
  }
  function accept(rows: DbSheetLead[], snapshots: Map<string, number>) {
    for (const row of rows) server.current.set(row.id, row);
    show(local.current.map(row => {
      const saved = rows.find(r => r.id === row.id);
      if (!saved) return row;
      return versions.current.get(row.id) === snapshots.get(row.id) ? saved : {
        ...row, revision: saved.revision, result: saved.result, first: saved.first, stage: saved.stage, meetingId: saved.meetingId,
      };
    }));
  }
  function saveSnapshot(row: DbSheetLead, version: number) {
    return enqueue(async () => {
      const rows = await request({ action: "save", lead: DbSheetLeadInput.parse(row), revision: server.current.get(row.id)?.revision ?? null });
      accept(rows, new Map([[row.id, version]]));
    });
  }
  function mutate(id: string, update: (row: DbSheetLead) => DbSheetLead) {
    const row = local.current.find(r => r.id === id); if (!row) return;
    const next = update(row), version = (versions.current.get(id) ?? 0) + 1;
    versions.current.set(id, version); show(local.current.map(r => r.id === id ? next : r));
    const previous = timers.current.get(id);
    if (previous) { clearTimeout(previous); setPending(n => n - 1); }
    setPending(n => n + 1);
    timers.current.set(id, setTimeout(() => {
      timers.current.delete(id); setPending(n => n - 1);
      void saveSnapshot(next, version).catch(() => {});
    }, 500));
  }
  async function flush(id: string) {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer); timers.current.delete(id); setPending(n => n - 1);
      const row = local.current.find(r => r.id === id)!;
      await saveSnapshot(row, versions.current.get(id) ?? 0);
    } else await tail.current;
    if (blocked.current) throw new Error("저장 오류를 먼저 확인해 주세요.");
  }
  function edit(id: string, key: Key, value: string) {
    if (key === "result") { void record(id, value, todayKST()).catch(() => {}); return; }
    if (["first", "stage", "memo"].includes(key)) return;
    mutate(id, row => ({ ...row, [key]: value }));
  }
  function contact(id: string, value: ContactDraft) {
    mutate(id, row => ({ ...row, contact: { ...value, companyName: value.companyName ?? row.company } }));
  }
  async function record(id: string, result: string, date: string) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.current.get(id) ?? 0;
      const lead = server.current.get(id)!;
      const rows = await request({ action: "contact", id, revision: lead.revision, date, result, note: lead.contact.note });
      accept(rows, new Map([[id, version]]));
    });
  }
  async function register(id: string) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.current.get(id) ?? 0;
      const rows = await request({ action: "meeting", id, revision: server.current.get(id)!.revision });
      accept(rows, new Map([[id, version]]));
    });
  }
  async function add(rows: Row[], batchId: string) {
    return enqueue(async () => {
      const inputs = rows.map(row => DbSheetLeadInput.parse({ ...row, contact: { ...contactDraft(row), companyName: row.company } }));
      const saved = await request({ action: "import", batchId, leads: inputs });
      for (const row of saved) { server.current.set(row.id, row); versions.current.set(row.id, 0); }
      show([...saved, ...local.current.filter(r => !saved.some(s => s.id === r.id))]);
    });
  }
  async function flushAll() { for(const id of [...timers.current.keys()]) await flush(id); await tail.current; if(blocked.current)throw new Error("저장 실패"); }
  function discard() { for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();show([...server.current.values()]); }
  useDirtyEntry("db-sheet", pending>0||!!error, flushAll, discard, "DB관리시트 변경사항");
  return { leads, loading, pending, error, edit, contact, record, register, add, flush };
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useDirtyEntry } from "@/components/DirtyGuard";
import { useQueryClient } from "@tanstack/react-query";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import { todayKST } from "@/util/week";
import type { Row, Key } from "./model";
import { contactDraft, type ContactDraft } from "./ContactPanel";

import {sheetRequest,SheetRequestError,type Recording,type RecordingImpact} from './recording-client';
import type {ImportResult} from './ImportResultNotice';
async function request(body?:unknown){return (await sheetRequest(body)).leads;}
export function useDbSheet() {
  const [suppliers,setSuppliers]=useState<string[]>([]),[addition,setAddition]=useState<ImportResult|null>(null);
  const [leads, setLeads] = useState<DbSheetLead[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(0), [error, setError] = useState("");
  const local = useRef<DbSheetLead[]>([]), server = useRef(new Map<string, DbSheetLead>());
  const tail = useRef(Promise.resolve()), blocked = useRef(false), versions = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const previews=useRef(new Map<string,{revision:number;recording:string;deleting:boolean}>());
  const scheduleVersions = useRef(new Map<string, number>());
  const queryClient = useQueryClient();
  function remember(rows:DbSheetLead[]){setSuppliers(prev=>[...new Set([...prev,...rows.map(r=>r.supplier)].filter(Boolean))]);}
  function show(rows: DbSheetLead[]) { local.current = rows; setLeads(rows); }
  useEffect(() => {
    let active = true;
    sheetRequest().then(payload => { const rows=payload.leads; if (active) {setSuppliers(payload.suppliers??rows.map(r=>r.supplier)); server.current = new Map(rows.map(r => [r.id, r])); versions.current = new Map(rows.map(r=>[r.id,0])); show(rows); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (pending || error) event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [pending, error]);
  function enqueue(work: () => Promise<void>, recoverable=false): Promise<void> {
    setPending(n => n + 1);
    const job = tail.current.then(async () => {
      if (blocked.current) throw new Error("앞선 저장이 실패했습니다. 입력 내용을 보관한 뒤 새로고침해 주세요.");
      await work();
      await Promise.all(["day", "week", "month", "dashboard", "db-sheet", "db", "meeting-follow-ups"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    });
    tail.current = job.catch(e => { if(!recoverable){blocked.current = true; setError(e.message);} }).finally(() => setPending(n => n - 1));
    return job;
  }
  function accept(rows: DbSheetLead[], snapshots: Map<string, number>) {
    remember(rows);
    for (const row of rows) server.current.set(row.id, row);
    show(local.current.map(row => {
      const saved = rows.find(r => r.id === row.id);
      if (!saved) return row;
      return versions.current.get(row.id) === snapshots.get(row.id) ? saved : {
        ...row, next: scheduleVersions.current.has(row.id) ? row.next : saved.next, revision: saved.revision, result: saved.result, first: saved.first, stage: saved.stage, meetingId: saved.meetingId, funnel: saved.funnel, followUp: saved.followUp, recording:saved.recording,inflowStatus:saved.inflowStatus,
      };
    }));
  }
  function saveSnapshot(row: DbSheetLead, version: number) {
    const scheduleNext = (scheduleVersions.current.get(row.id) ?? 0) > 0 && (scheduleVersions.current.get(row.id) ?? 0) <= version;
    if (scheduleNext) scheduleVersions.current.delete(row.id);
    return enqueue(async () => {
      const rows = await request({ action: "save", lead: DbSheetLeadInput.parse(row), revision: server.current.get(row.id)?.revision ?? null, ...(scheduleNext ? { scheduleNext: true } : {}) });
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
    if (key === "next") {
      if (local.current.find(row => row.id === id)?.next === value) return;
      scheduleVersions.current.set(id, (versions.current.get(id) ?? 0) + 1);
    }
    if (["first", "stage", "memo", "inflow"].includes(key)) return;
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
  async function add(rows: Row[], batchId: string, allowDuplicateIds:string[]=[]) {
    return enqueue(async () => {
      const inputs = rows.map(row => DbSheetLeadInput.parse({ ...row, contact: { ...contactDraft(row), companyName: row.company } }));
      const payload = await sheetRequest({ action: "import", batchId, leads: inputs,allowDuplicateIds });
      const saved=payload.leads;remember(saved);
      if(payload.impact)setAddition({total:saved.length,impact:payload.impact});
      for (const row of saved) { server.current.set(row.id, row); versions.current.set(row.id, 0); }
      show([...saved, ...local.current.filter(r => !saved.some(s => s.id === r.id))]);
    },true);
  }
  async function reload(){
    await flushAll();const payload=await sheetRequest();server.current=new Map(payload.leads.map(r=>[r.id,r]));show(payload.leads);if(payload.suppliers)setSuppliers(payload.suppliers);
  }
  async function recordingPreview(id:string, recording:Recording, deleting=false):Promise<RecordingImpact>{
    await flush(id);const revision=server.current.get(id)!.revision;const payload=await sheetRequest({action:deleting?'delete-preview':'recording-preview',id,revision,recording});
    previews.current.set(id,{revision,recording:JSON.stringify(recording),deleting});
    if(!payload.impact)throw new SheetRequestError('반영 내용을 확인하지 못했습니다. 다시 시도해 주세요.');return payload.impact;
  }
  async function configure(id:string,recording:Recording,deleting=false){
    await flush(id);return enqueue(async()=>{const preview=previews.current.get(id);if(!preview||preview.revision!==server.current.get(id)?.revision||preview.recording!==JSON.stringify(recording)||preview.deleting!==deleting)throw new Error('기록이 바뀌었어요. 변경 내용을 다시 확인해 주세요.');const version=versions.current.get(id)??0;const payload=await sheetRequest({action:deleting?'delete':'recording',id,revision:preview.revision,recording,...(deleting?{confirmed:true}:{})});
      previews.current.delete(id);if(deleting){server.current.delete(id);versions.current.delete(id);show(local.current.filter(r=>r.id!==id));}else accept(payload.leads,new Map([[id,version]]));
    },true);
  }
  async function flushAll() { for(const id of [...timers.current.keys()]) await flush(id); await tail.current; if(blocked.current)throw new Error("저장 실패"); }
  function discard() { for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();show([...server.current.values()]); }
  useDirtyEntry("db-sheet", pending>0||!!error, flushAll, discard, "DB관리시트 변경사항");
  return { leads, suppliers,addition,clearAddition:()=>setAddition(null), loading, pending, error, edit, contact, record, register, add, flush,recordingPreview,configure,reload };
}

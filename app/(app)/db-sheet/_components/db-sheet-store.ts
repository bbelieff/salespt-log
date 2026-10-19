/**
 * DB관리시트 저장 엔진 — React 와 무관한 상태 저장소(2026-10-19 구조 개선 ⑪).
 *
 * 전에는 use-db-sheet 훅 안의 ref 7개에 숨어 있어 화면을 그려야만 시험할 수 있었다.
 * 규칙은 그대로 옮겼다:
 *  - 칸 수정은 0.5초 모아서 저장(mutate → saveSnapshot), 저장은 한 줄로 차례대로(enqueue).
 *  - 서버 응답을 받을 때 그 사이 더 고친 칸은 화면 값을 지키고 서버 결과 칸만 반영(accept).
 *  - 앞선 저장이 실패하면 이후 저장을 막는다(blocked) — 복구 가능한 작업(가져오기·기록 설정)은 예외.
 *  - 기록 설정·삭제는 미리보기를 본 그 버전 그대로일 때만 확정(previews).
 * 화면(use-db-sheet)은 subscribe/getState 로 읽고, 쿼리 무효화·오늘 날짜·전송은 바깥에서 넣는다.
 */
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import type { Row, Key } from "./model";
import type { ContactDraft } from "./ContactPanel";
import { SheetRequestError, type Recording, type RecordingImpact, type sheetRequest } from "./recording-client";
import type { ImportResult } from "./ImportResultNotice";

export type DbSheetState = {
  leads: DbSheetLead[];
  suppliers: string[];
  addition: ImportResult | null;
  loading: boolean;
  pending: number;
  error: string;
};

export type DbSheetStoreDeps = {
  transport: typeof sheetRequest;
  /** 저장 뒤 다른 화면 캐시 새로고침. */
  invalidate: () => Promise<unknown>;
  today: () => string;
  /** 가져온 행의 첫 상담 초안(ContactPanel 규칙). */
  contactDraft: (row: Row) => ContactDraft;
  /** 0.5초 모으기 — 시험에서 가짜 타이머로 바꾼다. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (t: ReturnType<typeof setTimeout>) => void;
};

export function createDbSheetStore(deps: DbSheetStoreDeps) {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t));
  let state: DbSheetState = { leads: [], suppliers: [], addition: null, loading: true, pending: 0, error: "" };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<DbSheetState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
  const bumpPending = (n: number) => set({ pending: state.pending + n });

  let local: DbSheetLead[] = [];
  let server = new Map<string, DbSheetLead>();
  let tail: Promise<void> = Promise.resolve();
  let blocked = false;
  const versions = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const previews = new Map<string, { revision: number; recording: string; deleting: boolean }>();
  const scheduleVersions = new Map<string, number>();

  const request = async (body?: unknown) => (await deps.transport(body)).leads;
  function remember(rows: DbSheetLead[]) {
    set({ suppliers: [...new Set([...state.suppliers, ...rows.map((r) => r.supplier)].filter(Boolean))] });
  }
  function show(rows: DbSheetLead[]) { local = rows; set({ leads: rows }); }

  /** 처음 불러오기 — 돌려주는 함수를 부르면 늦게 온 응답을 버린다(화면이 먼저 닫힌 경우). */
  function load(): () => void {
    let active = true;
    deps.transport().then((payload) => {
      if (!active) return;
      const rows = payload.leads;
      set({ suppliers: payload.suppliers ?? rows.map((r) => r.supplier) });
      server = new Map(rows.map((r) => [r.id, r]));
      versions.clear(); for (const r of rows) versions.set(r.id, 0);
      show(rows);
    }).catch((e: Error) => { if (active) set({ error: e.message }); })
      .finally(() => { if (active) set({ loading: false }); });
    return () => { active = false; };
  }

  function enqueue(work: () => Promise<void>, recoverable = false): Promise<void> {
    bumpPending(1);
    const job = tail.then(async () => {
      if (blocked) throw new Error("앞선 저장이 실패했습니다. 입력 내용을 보관한 뒤 새로고침해 주세요.");
      await work();
      await deps.invalidate();
    });
    tail = job.catch((e: Error) => { if (!recoverable) { blocked = true; set({ error: e.message }); } }).finally(() => bumpPending(-1));
    return job;
  }
  function accept(rows: DbSheetLead[], snapshots: Map<string, number>) {
    remember(rows);
    for (const row of rows) server.set(row.id, row);
    show(local.map((row) => {
      const saved = rows.find((r) => r.id === row.id);
      if (!saved) return row;
      return versions.get(row.id) === snapshots.get(row.id) ? saved : {
        ...row, next: scheduleVersions.has(row.id) ? row.next : saved.next, revision: saved.revision, result: saved.result, first: saved.first, firstManual: saved.firstManual, hasQualifiedContact: saved.hasQualifiedContact, stage: saved.stage, meetingId: saved.meetingId, funnel: saved.funnel, followUp: saved.followUp, recording: saved.recording, inflowStatus: saved.inflowStatus,
      };
    }));
  }
  function saveSnapshot(row: DbSheetLead, version: number) {
    const scheduled = scheduleVersions.get(row.id) ?? 0;
    const scheduleNext = scheduled > 0 && scheduled <= version;
    if (scheduleNext) scheduleVersions.delete(row.id);
    return enqueue(async () => {
      const rows = await request({ action: "save", lead: DbSheetLeadInput.parse(row), revision: server.get(row.id)?.revision ?? null, ...(scheduleNext ? { scheduleNext: true } : {}) });
      accept(rows, new Map([[row.id, version]]));
    });
  }
  function mutate(id: string, update: (row: DbSheetLead) => DbSheetLead) {
    const row = local.find((r) => r.id === id); if (!row) return;
    const next = update(row), version = (versions.get(id) ?? 0) + 1;
    versions.set(id, version); show(local.map((r) => (r.id === id ? next : r)));
    const previous = timers.get(id);
    if (previous) { clearTimer(previous); bumpPending(-1); }
    bumpPending(1);
    timers.set(id, setTimer(() => {
      timers.delete(id); bumpPending(-1);
      void saveSnapshot(next, version).catch(() => {});
    }, 500));
  }
  async function flush(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimer(timer); timers.delete(id); bumpPending(-1);
      const row = local.find((r) => r.id === id)!;
      await saveSnapshot(row, versions.get(id) ?? 0);
    } else await tail;
    if (blocked) throw new Error("저장 오류를 먼저 확인해 주세요.");
  }
  async function firstDate(id: string, first: string) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.get(id) ?? 0;
      const rows = await request({ action: "first-date", id, first, revision: server.get(id)!.revision });
      accept(rows, new Map([[id, version]]));
    });
  }
  async function record(id: string, result: string, date: string) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.get(id) ?? 0;
      const lead = server.get(id)!;
      const rows = await request({ action: "contact", id, revision: lead.revision, date, result, note: lead.contact.note });
      accept(rows, new Map([[id, version]]));
    });
  }
  function edit(id: string, key: Key, value: string) {
    if (key === "first") { void firstDate(id, value).catch(() => {}); return; }
    if (key === "result") { void record(id, value, deps.today()).catch(() => {}); return; }
    if (key === "next") {
      if (local.find((row) => row.id === id)?.next === value) return;
      scheduleVersions.set(id, (versions.get(id) ?? 0) + 1);
    }
    if (["stage", "memo", "inflow"].includes(key)) return;
    mutate(id, (row) => ({ ...row, [key]: value }));
  }
  function asInfo(id: string, patch: { asReceived?: boolean; asNote?: string }) {
    mutate(id, (row) => ({ ...row, ...patch }));
  }
  function contact(id: string, value: ContactDraft) {
    mutate(id, (row) => ({ ...row, contact: { ...value, companyName: value.companyName ?? row.company } }));
  }
  async function register(id: string) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.get(id) ?? 0;
      const rows = await request({ action: "meeting", id, revision: server.get(id)!.revision });
      accept(rows, new Map([[id, version]]));
    });
  }
  async function add(rows: Row[], batchId: string, allowDuplicateIds: string[] = []) {
    return enqueue(async () => {
      const inputs = rows.map((row) => DbSheetLeadInput.parse({ ...row, contact: { ...deps.contactDraft(row), companyName: row.company } }));
      const payload = await deps.transport({ action: "import", batchId, leads: inputs, allowDuplicateIds });
      const saved = payload.leads; remember(saved);
      if (payload.impact) set({ addition: { total: saved.length, impact: payload.impact } });
      for (const row of saved) { server.set(row.id, row); versions.set(row.id, 0); }
      show([...saved, ...local.filter((r) => !saved.some((s) => s.id === r.id))]);
    }, true);
  }
  async function flushAll() {
    for (const id of [...timers.keys()]) await flush(id);
    await tail;
    if (blocked) throw new Error("저장 실패");
  }
  async function reload() {
    await flushAll();
    const payload = await deps.transport();
    server = new Map(payload.leads.map((r) => [r.id, r]));
    show(payload.leads);
    if (payload.suppliers) set({ suppliers: payload.suppliers });
  }
  async function recordingPreview(id: string, recording: Recording, deleting = false): Promise<RecordingImpact> {
    await flush(id);
    const revision = server.get(id)!.revision;
    const payload = await deps.transport({ action: deleting ? "delete-preview" : "recording-preview", id, revision, recording });
    previews.set(id, { revision, recording: JSON.stringify(recording), deleting });
    if (!payload.impact) throw new SheetRequestError("반영 내용을 확인하지 못했습니다. 다시 시도해 주세요.");
    return payload.impact;
  }
  async function configure(id: string, recording: Recording, deleting = false) {
    await flush(id);
    return enqueue(async () => {
      const preview = previews.get(id);
      if (!preview || preview.revision !== server.get(id)?.revision || preview.recording !== JSON.stringify(recording) || preview.deleting !== deleting) throw new Error("기록이 바뀌었어요. 변경 내용을 다시 확인해 주세요.");
      const version = versions.get(id) ?? 0;
      const payload = await deps.transport({ action: deleting ? "delete" : "recording", id, revision: preview.revision, recording, ...(deleting ? { confirmed: true } : {}) });
      previews.delete(id);
      if (deleting) { server.delete(id); versions.delete(id); show(local.filter((r) => r.id !== id)); }
      else accept(payload.leads, new Map([[id, version]]));
    }, true);
  }
  async function inflowPreview(id: string, inflow: boolean): Promise<RecordingImpact> {
    await flush(id);
    const revision = server.get(id)!.revision;
    const payload = await deps.transport({ action: "inflow-preview", id, revision, inflow });
    previews.set("inflow:" + id, { revision, recording: JSON.stringify(inflow), deleting: false });
    if (!payload.impact) throw new SheetRequestError("반영 내용을 확인하지 못했습니다. 다시 시도해 주세요.");
    return payload.impact;
  }
  async function configureInflow(id: string, inflow: boolean) {
    await flush(id);
    return enqueue(async () => {
      const preview = previews.get("inflow:" + id);
      if (!preview || preview.revision !== server.get(id)?.revision || preview.recording !== JSON.stringify(inflow)) throw new Error("기록이 바뀌었어요. 변경 내용을 다시 확인해 주세요.");
      const version = versions.get(id) ?? 0;
      const payload = await deps.transport({ action: "inflow", id, revision: preview.revision, inflow });
      previews.delete("inflow:" + id);
      accept(payload.leads, new Map([[id, version]]));
    }, true);
  }
  function discard() {
    for (const timer of timers.values()) clearTimer(timer);
    timers.clear();
    show([...server.values()]);
  }

  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    clearAddition: () => set({ addition: null }),
    edit, asInfo, contact, record, register, add, flush, flushAll, discard, reload,
    recordingPreview, configure, inflowPreview, configureInflow,
  };
}

export type DbSheetStore = ReturnType<typeof createDbSheetStore>;

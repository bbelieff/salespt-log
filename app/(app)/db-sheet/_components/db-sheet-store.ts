/**
 * DB관리시트 저장 엔진 — React 와 무관한 상태 저장소(2026-10-19 구조 개선 ⑪).
 *
 * 전에는 use-db-sheet 훅 안의 ref 7개에 숨어 있어 화면을 그려야만 시험할 수 있었다.
 * 규칙은 그대로 옮겼다:
 *  - 칸 수정은 0.5초 모아서 저장(mutate → saveSnapshot), 저장은 한 줄로 차례대로(enqueue).
 *  - 서버 응답을 받을 때 그 사이 더 고친 칸은 화면 값을 지키고 서버 결과 칸만 반영(accept).
 *  - 앞선 저장이 실패하면 이후 저장을 막는다(blocked) — 복구 가능한 작업(가져오기·기록 설정)은 예외.
 *  - 기록 설정·삭제는 미리보기를 본 그 버전 그대로일 때만 확정(previews).
 *  - 여러 줄 삭제는 10초 동안 화면에서만 숨기고(서버 무변경) 「되돌리기」가 없으면 그때 확정한다.
 * 화면(use-db-sheet)은 subscribe/getState 로 읽고, 쿼리 무효화·오늘 날짜·전송은 바깥에서 넣는다.
 */
import { DbSheetLeadInput, type DbSheetLead, type DbSheetManualStage, type DbSheetAbsence, type DbSheetTrashItem } from "@/types/db-sheet";
import type { Row, Key } from "./model";
import type { ContactDraft } from "./ContactPanel";
import { SheetRequestError, type Recording, type RecordingImpact, type sheetRequest } from "./recording-client";
import type { ImportResult } from "./ImportResultNotice";

/** 10초 되돌리기 동안 숨겨 둔 삭제 — 확정 전이라 서버에는 아직 그대로 있다. 숫자는 함께 정리될 STEP 2 기록. */
export type PendingDelete = { count: number; inflow: number; contacts: number; meetings: number };
/** 여러 줄 작업 결과 — 바꾼 수 · 이미 그 상태 · 바꾸지 못한 줄(이유). */
export type BulkOutcome = { done: number; unchanged: number; blocked: { id: string; company: string; reason: string }[] };
const DEFAULT_RECORDING = { inflow: true, activities: true };

export type DbSheetState = {
  leads: DbSheetLead[];
  deleting: PendingDelete | null;
  /** 저장 오류와 별개로 보여 줄 안내(예: 삭제 확정 실패). */
  notice: string;
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
  let state: DbSheetState = { leads: [], deleting: null, notice: "", suppliers: [], addition: null, loading: true, pending: 0, error: "" };
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
        ...row, next: scheduleVersions.has(row.id) ? row.next : saved.next, revision: saved.revision, result: saved.result, first: saved.first, firstManual: saved.firstManual, hasQualifiedContact: saved.hasQualifiedContact, manualStage: saved.manualStage, absences: saved.absences, linkedExisting: saved.linkedExisting, stage: saved.stage, meetingId: saved.meetingId, effectiveMeetingId: saved.effectiveMeetingId, funnel: saved.funnel, followUp: saved.followUp, recording: saved.recording, inflowStatus: saved.inflowStatus,
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
    if (key === "first") {
      // 칸을 눌렀다 떼기만 한 경우(값 그대로)는 저장하지 않는다 — 빈 「직접 입력」이 자동 기록을 막던 원인.
      if ((local.find((row) => row.id === id)?.first ?? "") === value) return;
      void firstDate(id, value).catch(() => {}); return;
    }
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
    await commitDelete();
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
  async function stage(id: string, value: DbSheetManualStage) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.get(id) ?? 0;
      const rows = await request({ action: "stage", id, revision: server.get(id)!.revision, stage: value });
      accept(rows, new Map([[id, version]]));
    }, true);
  }
  /** 부재 기록 한 줄 더하기·빼기(2026-10-23) — 표 값과 무관하게 바로 저장. */
  async function absence(id: string, entry: DbSheetAbsence, remove = false) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.get(id) ?? 0;
      const rows = await request({ action: "absence", id, revision: server.get(id)!.revision, entry, ...(remove ? { remove: true } : {}) });
      accept(rows, new Map([[id, version]]));
    }, true);
  }
  /** 따로 잡은 미팅 연결·풀기(2026-10-23) — 표시만 바꾸고 실적은 그대로. */
  async function linkMeeting(id: string, meetingId: string | null) {
    await flush(id);
    return enqueue(async () => {
      const version = versions.get(id) ?? 0;
      const revision = server.get(id)!.revision;
      const rows = await request(meetingId ? { action: "link-meeting", id, revision, meetingId } : { action: "unlink-meeting", id, revision });
      accept(rows, new Map([[id, version]]));
    }, true);
  }
  /** 고른 줄의 유입 반영을 한 줄씩 미리보기 → 확정. 이미 그 상태이거나 막힌 줄은 건너뛴다. */
  async function bulkInflow(ids: readonly string[], inflow: boolean): Promise<BulkOutcome> {
    const out: BulkOutcome = { done: 0, unchanged: 0, blocked: [] };
    for (const id of ids) {
      const row = local.find((r) => r.id === id); if (!row) continue;
      const status = row.inflowStatus;
      if (!status) { out.blocked.push({ id, company: row.company, reason: "유입 표시를 불러오지 못했어요" }); continue; }
      if ((status.state === "recorded") === inflow) { out.unchanged++; continue; }
      try {
        const impact = await inflowPreview(id, inflow);
        if (impact.blockedReason) { out.blocked.push({ id, company: row.company, reason: impact.blockedReason }); continue; }
        await configureInflow(id, inflow); out.done++;
      } catch (e) { out.blocked.push({ id, company: row.company, reason: (e as Error).message }); }
    }
    return out;
  }
  /**
   * 체크한 줄의 공급처 유형·공급처 이름 한꺼번에(2026-10-26 belie). 빈 값은 그대로. 줄마다 바로 저장한다.
   * 미팅이 연결된 DB의 유형은 STEP 3 일정·계약이 정본이라 바꾸지 않는다(공급처 이름은 바꾼다).
   */
  async function bulkSupplier(ids: readonly string[], patch: { channel?: string; supplier?: string }): Promise<BulkOutcome> {
    const out: BulkOutcome = { done: 0, unchanged: 0, blocked: [] };
    for (const id of ids) {
      const row = local.find((r) => r.id === id); if (!row) continue;
      const lockedChannel = !!patch.channel && !!row.meetingId && row.channel !== patch.channel;
      const next = { ...(patch.channel && !lockedChannel ? { channel: patch.channel as DbSheetLead["channel"] } : {}), ...(patch.supplier ? { supplier: patch.supplier } : {}) };
      const changes = (next.channel !== undefined && next.channel !== row.channel) || (next.supplier !== undefined && next.supplier !== row.supplier);
      if (lockedChannel) out.blocked.push({ id, company: row.company, reason: "미팅이 연결돼 유형은 STEP 3 일정·계약에서 바꿔 주세요" });
      if (!changes) { if (!lockedChannel) out.unchanged++; continue; }
      try { mutate(id, (r) => ({ ...r, ...next })); await flush(id); if (!lockedChannel) out.done++; }
      catch (e) { if (!lockedChannel) out.blocked.push({ id, company: row.company, reason: (e as Error).message }); }
    }
    return out;
  }
  /**
   * 여러 줄 삭제 = 휴지통으로(2026-10-26 belie 「10초가 아니라 휴지통에서 되돌리기」). 줄마다 막힘을 확인하고 바로 서버에서 휴지통으로 옮긴다.
   * 예전 10초 숨김은 서버에 그대로 남아 있어서, 그 사이 같은 DB를 다시 등록하면 「이미 등록된 업체」로 막혔다.
   */
  async function scheduleDelete(ids: readonly string[]): Promise<BulkOutcome> {
    const out: BulkOutcome = { done: 0, unchanged: 0, blocked: [] };
    const total = { inflow: 0, contacts: 0, meetings: 0 };
    for (const id of ids) {
      const row = local.find((r) => r.id === id); if (!row) continue;
      try {
        const recording = row.recording ?? DEFAULT_RECORDING;
        const impact = await recordingPreview(id, recording, true);
        if (impact.blockedReason) { out.blocked.push({ id, company: row.company, reason: impact.blockedReason }); continue; }
        await configure(id, recording, true);
        out.done++; total.inflow -= impact.inflow; total.contacts -= impact.contacts; total.meetings -= impact.meetings;
      } catch (e) { out.blocked.push({ id, company: row.company, reason: (e as Error).message }); }
    }
    if (out.done) set({ deleting: { count: out.done, ...total }, notice: "" });
    return out;
  }
  /** 휴지통 안내 줄 닫기. */
  function undoDelete() { set({ deleting: null }); }
  /** 예전 10초 숨김 확정 자리 — 이제 삭제는 바로 확정되므로 할 일이 없다(호출부 호환). */
  async function commitDelete() {}
  /** 휴지통 목록. */
  async function listTrash(): Promise<DbSheetTrashItem[]> {
    const response = await fetch("/api/db-sheet?trash=1", { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as { trash?: DbSheetTrashItem[]; error?: string };
    if (!response.ok) throw new SheetRequestError(body.error || "휴지통을 불러오지 못했어요.");
    return body.trash ?? [];
  }
  /** 휴지통에서 되돌리기 — 같은 업체가 이미 있으면 SheetRequestError(code=duplicate). */
  async function restoreTrash(ids: readonly string[], allowDuplicate = false): Promise<number> {
    let count = 0;
    await enqueue(async () => {
      const payload = await deps.transport({ action: "trash-restore", ids: [...ids], ...(allowDuplicate ? { allowDuplicate: true } : {}) });
      const back = payload.leads; remember(back);
      for (const row of back) { server.set(row.id, row); versions.set(row.id, 0); }
      show([...back, ...local.filter((r) => !back.some((b) => b.id === r.id))]);
      set({ deleting: null });
      count = back.length;
    }, true);
    return count;
  }
  /** 영구 삭제(ids 없으면 휴지통 비우기). */
  async function emptyTrash(ids?: readonly string[]) {
    await deps.transport({ action: "trash-empty", ...(ids ? { ids: [...ids] } : {}) });
  }
  function discard() {
    undoDelete();
    for (const timer of timers.values()) clearTimer(timer);
    timers.clear();
    show([...server.values()]);
  }

  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    clearAddition: () => set({ addition: null }),
    clearNotice: () => set({ notice: "" }),
    stage, absence, linkMeeting, bulkInflow, bulkSupplier, scheduleDelete, undoDelete, commitDelete, listTrash, restoreTrash, emptyTrash,
    edit, asInfo, contact, record, register, add, flush, flushAll, discard, reload,
    recordingPreview, configure, inflowPreview, configureInflow,
  };
}

export type DbSheetStore = ReturnType<typeof createDbSheetStore>;

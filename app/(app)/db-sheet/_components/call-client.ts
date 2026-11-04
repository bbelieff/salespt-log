/**
 * 통화 정리 앞단(plan call-summary PR-5a, 목업 v5) — 화면과 떨어진 규칙·요청.
 * 통화 앱 고정값은 이 폰에만(localStorage). 익시오·에이닷을 웹에서 바로 여는 주소는 확인되지 않아 번호 복사까지만 한다.
 */
import type { CallRecord, CallStatus } from "@/types/call";

export const CALL_APPS = [
  { id: "ixio", name: "익시오" },
  { id: "adot", name: "에이닷" },
  { id: "phone", name: "기본 전화 앱" },
  { id: "other", name: "다른 녹음 앱" },
] as const;
export type CallAppId = (typeof CALL_APPS)[number]["id"];
export const callAppName = (id: CallAppId) => CALL_APPS.find(a => a.id === id)!.name;
/** 받침이 있으면 true(ㄹ 받침은 「로」를 쓰므로 rieul 로 따로). 한글이 아니면 받침 없음으로 본다. */
function final(word: string): { has: boolean; rieul: boolean } {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return { has: false, rieul: false };
  return { has: c % 28 !== 0, rieul: c % 28 === 8 };
}
/** 익시오를 · 에이닷을 */
export const eul = (w: string) => w + (final(w).has ? "을" : "를");
/** 익시오로 · 에이닷으로 · (ㄹ 받침) 로 */
export const euro = (w: string) => { const f = final(w); return w + (f.has && !f.rieul ? "으로" : "로"); };

const APP_KEY = "db-sheet-call-app";
export function readCallApp(): CallAppId | null {
  try { const v = localStorage.getItem(APP_KEY); return CALL_APPS.some(a => a.id === v) ? v as CallAppId : null; } catch { return null; }
}
export function saveCallApp(id: CallAppId | null): void {
  try { if (id) localStorage.setItem(APP_KEY, id); else localStorage.removeItem(APP_KEY); } catch { /* 저장 못 해도 이번 통화는 건다 */ }
}

/** 첫 업로드 고지(D6)를 이 폰에서 확인했는지. 문구가 바뀌면 값을 올려 다시 보여 준다. */
const NOTICE_KEY = "db-sheet-call-notice", NOTICE_VERSION = "1";
export function readCallNotice(): boolean {
  try { return localStorage.getItem(NOTICE_KEY) === NOTICE_VERSION; } catch { return false; }
}
export function saveCallNotice(): void {
  try { localStorage.setItem(NOTICE_KEY, NOTICE_VERSION); } catch { /* 저장 못 하면 다음에 한 번 더 보여 줄 뿐 */ }
}

export const phoneDigits =(s: string) => s.replace(/\D/g, "");
export const isIos = (ua: string) => /iPhone|iPad|iPod/i.test(ua);

/** 녹음으로 받는 확장자·크기 — 서버(lib/repo/call-audio · CALL_AUDIO_MAX_BYTES)와 같은 값. */
export const CALL_AUDIO_EXTS = ["m4a", "mp3", "wav", "aac", "ogg", "flac"];
export const CALL_AUDIO_MAX_MB = 14;
/** 받아쓴 통화 내용 파일(belie 2026-11-05: 익시오 등은 .txt·.pdf 로 저장된다) — 폰 안에서 글만 뽑아 글자 경로로 보낸다. */
export const CALL_TEXT_EXTS = ["txt", "pdf"];
export const CALL_TEXT_MAX_MB = 5;
export const CALL_AUDIO_ACCEPT = [...CALL_AUDIO_EXTS, ...CALL_TEXT_EXTS].map(e => `.${e}`).join(",");
export const isCallTextFile = (name: string) => CALL_TEXT_EXTS.includes(name.toLowerCase().split(".").pop() ?? "");

/** 이 파일이 📞 로 건 그 통화인가 — 파일 이름의 번호(DB 번호는 연락처에 없어 이름에 붙는다)와 저장 시각. */
export type RecordingCheck = { fileError: string; namePhone: string; phoneMatch: boolean | null; minutesOff: number | null; warn: "" | "phone" | "time" };
export function checkRecording(file: { name: string; size: number; lastModified: number }, phone: string, dialedAt: number | null): RecordingCheck {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const text = CALL_TEXT_EXTS.includes(ext);
  const fileError = !text && !CALL_AUDIO_EXTS.includes(ext) ? "통화 녹음이나 통화 내용 파일이 아니에요"
    : file.size === 0 ? "파일이 비어 있어요"
    : text && file.size > CALL_TEXT_MAX_MB * 1024 * 1024 ? `파일이 너무 커요(${CALL_TEXT_MAX_MB}MB 넘음)`
    : !text && file.size > CALL_AUDIO_MAX_MB * 1024 * 1024 ? `녹음이 너무 길어요(${CALL_AUDIO_MAX_MB}MB 넘음)` : "";
  const m = file.name.match(/0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/);
  const namePhone = m ? m[0] : "";
  const want = phoneDigits(phone);
  const phoneMatch = namePhone && want ? phoneDigits(namePhone) === want : null;
  const minutesOff = dialedAt === null ? null : Math.round(Math.abs(file.lastModified - dialedAt) / 60_000);
  const warn = phoneMatch === false ? "phone" : minutesOff !== null && minutesOff > 30 ? "time" : "";
  return { fileError, namePhone, phoneMatch, minutesOff, warn };
}

/** 목록 상태 칩 — 확정·닫은 통화는 칩이 없다. */
export function callChip(status: CallStatus): { label: string; tone: "wait" | "work" | "ready" | "fail" } | null {
  switch (status) {
    case "dialed": return { label: "녹음 필요", tone: "wait" };
    case "queued": case "processing": return { label: "정리 중", tone: "work" };
    case "review": return { label: "확인 필요", tone: "ready" };
    case "failed": return { label: "정리 실패", tone: "fail" };
    default: return null;
  }
}

/** 업체마다 가장 최근 통화 하나. 목록은 최근 것부터 온다. */
export function latestCallByLead(calls: CallRecord[]): Map<string, CallRecord> {
  const out = new Map<string, CallRecord>();
  for (const c of calls) if (!out.has(c.leadId)) out.set(c.leadId, c);
  return out;
}

export const hhmm = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw Object.assign(new Error(body.error || "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요."), { status: res.status });
  return body as T;
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** null = 이 사람에게 꺼진 기능(404). */
export async function fetchActiveCalls(): Promise<CallRecord[] | null> {
  try { return (await call<{ calls: CallRecord[] }>("/api/calls")).calls; }
  catch (e) { if ((e as { status?: number }).status === 404) return null; throw e; }
}
export const startCall = (leadId: string, calledAt?: string) => call<{ id: string }>("/api/calls", json({ leadId, calledAt })).then(r => r.id);
export function uploadCallAudio(id: string, file: File) {
  const form = new FormData(); form.append("file", file);
  return call(`/api/calls/${id}/upload`, { method: "POST", body: form });
}
export const uploadCallText = (id: string, text: string) => call(`/api/calls/${id}/upload`, json({ text }));

/**
 * .txt·.pdf 에서 통화 내용 글을 뽑는다(폰 안에서, 서버로는 글만 간다). PDF 는 업체정보 서류 읽기와 같은 글자층 읽기 —
 * 글자가 든 PDF 만, 앞 10쪽까지. 사진으로 찍은 PDF 는 읽지 못한다고 알린다.
 */
export async function readCallTextFile(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".pdf")) return (await file.text()).trim();
  const [{ readPdfTextLayer }, { OCR_LIMITS, withTimeout }] = await Promise.all([import("@/lib/document-ocr/ocr-pdf"), import("@/lib/document-ocr/limits")]);
  const guard = withTimeout(undefined, OCR_LIMITS.pdfTimeoutMs);
  try {
    const read = await readPdfTextLayer(file, guard.signal, undefined, `${OCR_LIMITS.assetBasePath}/pdf.worker.min.mjs`);
    if (!read) throw new Error("이 PDF 에서 글을 읽지 못했어요. 통화 앱에서 .txt 로 저장해 보세요.");
    return read.text;
  } finally { guard.dispose(); }
}
export const confirmCall = (id: string, body: unknown) => call<{ lead?: unknown; already?: boolean }>(`/api/calls/${id}/confirm`, json(body));

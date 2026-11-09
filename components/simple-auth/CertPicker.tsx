"use client";
/**
 * 공동인증서 고르기 — 한 버튼으로 설치된 인증서(NPKI 폴더·USB)와 내보낸 파일(.pfx·.p12, signCert.der+signPri.key)을 모두 받는다
 * (belie 2026-11-09). 기관 사이트의 인증서 창처럼 목록에서 고르고 비밀번호만 넣는다.
 *  · 폴더 찾기: 크롬·엣지는 showDirectoryPicker(고른 폴더를 이 브라우저에 기억 → 다음엔 「허용」 한 번), 그 밖은 폴더 올리기 입력.
 *  · 끌어다 놓기: 폴더·파일 모두.
 * 웹페이지는 PC 폴더를 스스로 뒤질 수 없어 처음 한 번은 사용자가 폴더를 골라야 한다. 인증서 파일은 이 화면 메모리에만 두고,
 * 「서류 가져오기」 때 요청 한 번에만 서버로 보낸다(서버도 저장하지 않음).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, FileKey2, FolderOpen } from "lucide-react";
import { groupCertFiles, isCertFileName, readNpkiCert, type NpkiCertInfo } from "@/util/npki-cert";

export type PickedCert =
  | { kind: "npki"; der: File; key: File; info: NpkiCertInfo | null; label: string }
  | { kind: "pfx"; file: File; label: string };

type Found = { path: string; file: File };
type Option = PickedCert & { id: string; dir: string };

const NPKI_PATH = "%USERPROFILE%\\AppData\\LocalLow\\NPKI";
const MAX_FILES = 3000, MAX_DEPTH = 7, MAX_SIZE = 30_000;

/* ---- 고른 폴더 기억(IndexedDB, 이 브라우저에만) ---- */
type DirHandle = {
  kind: "directory"; name: string;
  values(): AsyncIterable<{ kind: "file" | "directory"; name: string; getFile?: () => Promise<File> } & DirHandle>;
  queryPermission?(o: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "read" }): Promise<PermissionState>;
};
const DB = "salespt-simple-auth", STORE = "handles", KEY = "npki-dir";
function idb<T>(fn: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T | undefined> {
  return new Promise(resolve => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const req = fn(open.result.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(undefined);
        } catch { resolve(undefined); }
      };
    } catch { resolve(undefined); }
  });
}
const loadHandle = () => idb<DirHandle>(s => s.get(KEY) as IDBRequest<DirHandle>, "readonly");
const saveHandle = (h: DirHandle) => idb(s => s.put(h, KEY), "readwrite");

async function walkHandle(h: DirHandle, prefix: string, depth: number, out: Found[]) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
  for await (const e of h.values()) {
    if (out.length >= MAX_FILES) return;
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.kind === "directory") await walkHandle(e, path, depth + 1, out);
    else if (isCertFileName(e.name) && e.getFile) { const f = await e.getFile(); if (f.size < MAX_SIZE) out.push({ path, file: f }); }
  }
}

type Entry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string; file?(ok: (f: File) => void, err: () => void): void; createReader?(): { readEntries(ok: (es: Entry[]) => void, err: () => void): void } };
async function walkEntry(e: Entry, depth: number, out: Found[]) {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
  if (e.isFile && e.file) {
    if (!isCertFileName(e.name)) return;
    const f = await new Promise<File | null>(r => e.file!(r, () => r(null)));
    if (f && f.size < MAX_SIZE) out.push({ path: e.fullPath.replace(/^\//, ""), file: f });
  } else if (e.isDirectory && e.createReader) {
    const reader = e.createReader();
    for (;;) {
      const batch = await new Promise<Entry[]>(r => reader.readEntries(r, () => r([])));
      if (!batch.length) break;
      for (const c of batch) await walkEntry(c, depth + 1, out);
    }
  }
}

async function toOptions(found: Found[]): Promise<Option[]> {
  const out: Option[] = [];
  for (const c of groupCertFiles(found)) {
    if (c.kind === "npki") {
      const info = readNpkiCert(new Uint8Array(await c.cert.file.arrayBuffer()));
      out.push({ kind: "npki", der: c.cert.file, key: c.key.file, info, label: info?.name ?? c.dir.split("/").pop() ?? c.cert.file.name, id: c.dir || c.cert.path, dir: c.dir });
    } else {
      out.push({ kind: "pfx", file: c.file.file, label: c.file.file.name, id: c.file.path, dir: c.dir });
    }
  }
  return out;
}

export default function CertPicker({ id: givenId, value, onChange, invalid }: {
  id?: string;
  value: PickedCert | null;
  onChange: (c: PickedCert | null) => void;
  invalid?: Record<string, unknown>;
}) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<DirHandle | null>(null);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const canPickDir = typeof window !== "undefined" && "showDirectoryPicker" in window && !/Mac/i.test(navigator.platform);

  async function show(found: Found[], where: string) {
    const opts = await toOptions(found);
    setOptions(opts);
    setOpen(true);
    setNote(opts.length ? "" : `${where}에서 인증서를 찾지 못했어요. NPKI 폴더나 인증서 파일이 있는 폴더를 골라 주세요.`);
    if (opts.length === 1) onChange(opts[0]!);
  }

  async function scanHandle(h: DirHandle) {
    setBusy(true);
    try { const found: Found[] = []; await walkHandle(h, h.name, 0, found); await show(found, `「${h.name}」 폴더`); }
    catch { setNote("폴더를 읽지 못했어요. 다시 골라 주세요."); }
    finally { setBusy(false); }
  }

  // 지난번 고른 폴더 — 권한이 살아 있으면 열 때 바로 목록을 보여 준다.
  useEffect(() => {
    if (!open || !canPickDir || options) return;
    let live = true;
    void loadHandle().then(async h => {
      if (!live || !h?.queryPermission) return;
      setSaved(h);
      if ((await h.queryPermission({ mode: "read" })) === "granted" && live) await scanHandle(h);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function pickFolder() {
    if (!canPickDir) { folderInput.current?.click(); return; }
    try {
      const h = await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker({ id: "npki", mode: "read" });
      setSaved(h); void saveHandle(h);
      await scanHandle(h);
    } catch (e) {
      if ((e as Error).name !== "AbortError") { setFallback(true); setNote("폴더 창을 열지 못했어요. 버튼을 한 번 더 눌러 폴더를 올려 주세요."); }
    }
  }

  /** 한 버튼: 지난번 폴더가 있으면 그 폴더(「허용」 한 번), 없으면 폴더 창, 폴더 창이 막히면 폴더 올리기. */
  async function findCerts() {
    if (fallback) { folderInput.current?.click(); return; }
    if (saved?.requestPermission && options === null) {
      if ((await saved.requestPermission({ mode: "read" })) === "granted") await scanHandle(saved);
      else setOptions([]); // 허용 안 함 → 다음 누름은 새 폴더 창
      return;
    }
    await pickFolder();
  }

  async function fromInput(list: FileList | null, folder: boolean) {
    const files = [...(list ?? [])].filter(f => f.size < MAX_SIZE && isCertFileName(f.name));
    await show(files.map(f => ({ path: (folder && f.webkitRelativePath) || f.name, file: f })), folder ? "고른 폴더" : "고른 파일");
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry?.() as unknown as Entry | null).filter((x): x is Entry => !!x);
    if (!entries.length) { await fromInput(e.dataTransfer.files, false); return; }
    setBusy(true);
    try { const found: Found[] = []; for (const en of entries) await walkEntry(en, 0, found); await show(found, "끌어 놓은 곳"); }
    finally { setBusy(false); }
  }

  async function copyPath() {
    try { await navigator.clipboard.writeText(NPKI_PATH); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 막힘 — 경로는 화면에 보인다 */ }
  }

  const picked = value;
  const summary = picked
    ? picked.kind === "npki" && picked.info
      ? `${picked.info.name} · ${picked.info.kind ?? "구분 모름"} · ${picked.info.notAfter}까지`
      : picked.kind === "pfx" ? picked.file.name : picked.label
    : "";

  return (
    <div className="min-w-0">
      <button type="button" id={id} aria-expanded={open} aria-controls={`${id}-box`} onClick={() => setOpen(o => !o)}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        className={`mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${drag ? "border-blue-500 bg-blue-50" : picked ? "border-blue-300 bg-blue-50/40 text-gray-900" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
        {...invalid}>
        <FileKey2 className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{summary || "인증서 선택"}</span>
        <span className="shrink-0 text-sm text-blue-600">{picked ? "바꾸기" : "열기"}</span>
      </button>

      {open && (
        <div id={`${id}-box`} className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          {options && options.length > 0 && (
            <ul role="listbox" aria-label="찾은 인증서" className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {options.map(o => {
                const on = !!picked && (picked.kind === "npki" ? o.kind === "npki" && o.der === picked.der : o.kind === "pfx" && o.file === picked.file);
                const info = o.kind === "npki" ? o.info : null;
                return (
                  <li key={o.id} role="option" aria-selected={on}>
                    <button type="button" onClick={() => { onChange(o); setOpen(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 ${on ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${info?.kind === "법인" ? "bg-violet-100 text-violet-700" : info?.kind === "개인" ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-600"}`}>
                        {o.kind === "pfx" ? "PFX" : info?.kind ?? "인증서"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{o.label}</span>
                      {info && <span className={`shrink-0 text-xs tabular-nums ${info.expired ? "font-semibold text-red-600" : "text-gray-600"}`}>{info.expired ? "만료됨" : `${info.notAfter}까지`}</span>}
                      {on && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {busy && <p className="text-sm text-gray-600" role="status">인증서를 찾는 중…</p>}
          {note && <p className="text-sm text-amber-700" role="status">{note}</p>}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button type="button" onClick={findCerts} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50">
              <FolderOpen className="h-4 w-4" aria-hidden />{options?.length ? "다른 폴더에서 찾기" : "내 PC에서 인증서 찾기"}
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50">
              파일로 고르기(.pfx)
            </button>
          </div>

          {!options?.length && (
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer select-none font-medium text-gray-700">어느 폴더를 고르나요?</summary>
              <p className="mt-1.5 leading-relaxed">폴더 창 주소줄에 아래 경로를 붙여 넣고 <b className="font-semibold text-gray-800">NPKI</b> 폴더를 고르세요. USB는 그 드라이브의 NPKI 폴더예요.</p>
              <p className="mt-1 flex min-w-0 items-center gap-1.5">
                <code className="min-w-0 truncate rounded bg-white px-1.5 py-0.5 text-gray-800 ring-1 ring-gray-200">{NPKI_PATH}</code>
                <button type="button" onClick={copyPath} className="inline-flex shrink-0 items-center gap-0.5 font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                  {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}{copied ? "복사됨" : "경로 복사"}
                </button>
              </p>
            </details>
          )}
        </div>
      )}

      <input ref={folderInput} type="file" className="sr-only" tabIndex={-1} aria-hidden data-cert-folder
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={e => { void fromInput(e.target.files, true); e.target.value = ""; }} />
      <input ref={fileInput} type="file" multiple accept=".pfx,.p12,.der,.key" className="sr-only" tabIndex={-1} aria-hidden data-cert-files
        onChange={e => { void fromInput(e.target.files, false); e.target.value = ""; }} />
    </div>
  );
}

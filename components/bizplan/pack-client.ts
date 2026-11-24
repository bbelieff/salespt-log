/**
 * 사업계획서 「자료 꾸러미」 ZIP 을 브라우저에서 만든다(docs/plans/active/bizplan-tool.md).
 * 고객 자료는 서버로 보내지 않는다 — 공식 빌더·양식만 서버(경영일지 이용자 전용 주소)에서 받아 함께 묶는다.
 */
import {
  BIZPLAN_SLOTS,
  bizplanMissing,
  buildChecklist,
  buildFactsheet,
  buildStartPrompt,
  packFileStem,
  type BizplanDraft,
  type BizplanFileRef,
  type BizplanSlotKey,
} from "@/util/bizplan-pack";
import { buildStoredZip, uniqueZipNames, type ZipEntry } from "@/util/zip-store";

export type KitFileInfo = { name: string; version: string; updatedAt: string; size: number };
export type KitInfo = {
  ready: boolean;
  builder: KitFileInfo | null;
  clinic: KitFileInfo | null;
  interview: KitFileInfo | null;
  folderUrl?: string;
};

export type SlotFiles = Record<BizplanSlotKey, File[]>;

/** 꾸러미 전체 상한 — 브라우저 메모리에 한 번에 올리므로 넉넉하되 끝이 있게. */
export const PACK_MAX_BYTES = 300 * 1024 * 1024;

export function emptySlotFiles(): SlotFiles {
  return Object.fromEntries(BIZPLAN_SLOTS.map((s) => [s.key, []])) as unknown as SlotFiles;
}

export function fileRefs(files: SlotFiles): BizplanFileRef[] {
  return BIZPLAN_SLOTS.flatMap((s) => files[s.key].map((f) => ({ slot: s.key, name: f.name })));
}

export function totalBytes(files: SlotFiles): number {
  return BIZPLAN_SLOTS.reduce((sum, s) => sum + files[s.key].reduce((a, f) => a + f.size, 0), 0);
}

export function todayStamp(d = new Date()): { compact: string; label: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    compact: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`,
    label: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

async function fetchKit(kind: "builder" | "clinic" | "interview"): Promise<Uint8Array> {
  const r = await fetch(`/api/bizplan/kit/${kind}`, { cache: "no-store" });
  if (!r.ok) throw new Error("공식 파일을 받지 못했어요. 잠시 뒤 다시 해 주세요.");
  return new Uint8Array(await r.arrayBuffer());
}

export function startPromptFor(draft: BizplanDraft, kit: KitInfo | null): string {
  return buildStartPrompt(draft, {
    builder: kit?.builder ? `01_빌더_${kit.builder.name}` : null,
    clinic: kit?.clinic ? kit.clinic.name : null,
    interview: kit?.interview ? kit.interview.name : null,
  });
}

/** 꾸러미 맨 앞 파일 — AI 가 「실행」 한 마디로 시작하게 하는 지시문. */
export const START_FILE = "00_AI지시_먼저읽기.txt";

/** ZIP 바이트와 파일 이름. 하위 폴더 없이 한 폴더에 모두 둔다 — 폴더를 열어 전부 골라 대화창에 끌어다 놓으면 끝. */
export async function buildPack(draft: BizplanDraft, files: SlotFiles, kit: KitInfo | null): Promise<{ name: string; bytes: Uint8Array }> {
  const enc = new TextEncoder();
  const stamp = todayStamp();
  const refs = fileRefs(files);
  const missing = bizplanMissing(draft, refs, !!kit?.builder);
  const raw: { name: string; data: Uint8Array }[] = [];
  raw.push({ name: START_FILE, data: enc.encode(startPromptFor(draft, kit)) });
  if (kit?.builder) raw.push({ name: `01_빌더_${kit.builder.name}`, data: await fetchKit("builder") });
  raw.push({ name: "02_팩트시트.md", data: enc.encode(buildFactsheet(draft, refs, missing, stamp.label)) });
  for (const s of BIZPLAN_SLOTS) {
    for (const f of files[s.key]) raw.push({ name: `03_원본_${s.folder}_${f.name}`, data: new Uint8Array(await f.arrayBuffer()) });
  }
  raw.push({ name: "04_산출물체크리스트.md", data: enc.encode(buildChecklist(draft)) });
  if (kit?.clinic) raw.push({ name: `05_양식_${kit.clinic.name}`, data: await fetchKit("clinic") });
  const names = uniqueZipNames(raw.map((r) => r.name));
  const entries: ZipEntry[] = raw.map((r, i) => ({ name: names[i]!, data: r.data }));
  return { name: `사업계획서꾸러미_${packFileStem(draft.company)}_${stamp.compact}.zip`, bytes: buildStoredZip(entries) };
}

export function saveBytes(name: string, bytes: Uint8Array, type = "application/zip"): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadKitFile(kind: "interview" | "clinic", name: string): Promise<void> {
  saveBytes(name, await fetchKit(kind), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

/**
 * Layer: repo — 통화 녹음 임시 파일(레포 밖). 올린 녹음은 정리 작업이 Gemini 로 보낸 뒤 바로 지운다(D3).
 * 폴더: CALL_AUDIO_DIR, 없으면 OS 임시 폴더/salespt-call-audio. 파일 이름은 무작위 — 전화번호·업체 이름을 쓰지 않는다.
 * 이 폴더 밖의 경로는 읽거나 지우지 않는다.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** 받는 녹음 확장자 → Gemini 에 보낼 형식. m4a 는 0단계 익시오 녹음으로 확인(audio/m4a). */
export const CALL_AUDIO_TYPES: Record<string, string> = {
  m4a: "audio/m4a", mp3: "audio/mp3", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac",
};

export const callAudioDir = () => path.resolve(process.env.CALL_AUDIO_DIR?.trim() || path.join(tmpdir(), "salespt-call-audio"));

function inside(p: string): string {
  const dir = callAudioDir(), full = path.resolve(p);
  if (path.dirname(full) !== dir) throw new Error("call_audio_outside");
  return full;
}

/** 확장자는 CALL_AUDIO_TYPES 중 하나여야 한다. 저장 경로를 돌려준다. */
export async function saveCallAudio(bytes: Uint8Array, ext: string): Promise<string> {
  if (!CALL_AUDIO_TYPES[ext]) throw new Error("call_audio_type");
  const dir = callAudioDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${randomUUID()}.${ext}`);
  await writeFile(file, bytes, { mode: 0o600 });
  return file;
}

export async function readCallAudio(p: string): Promise<{ audio: Uint8Array; mimeType: string }> {
  const full = inside(p);
  const mimeType = CALL_AUDIO_TYPES[path.extname(full).slice(1)];
  if (!mimeType) throw new Error("call_audio_type");
  return { audio: await readFile(full), mimeType };
}

/** 없으면 조용히 넘어간다. */
export async function removeCallAudio(p: string | null): Promise<void> {
  if (p) await rm(inside(p), { force: true });
}

/** 폴더에 hours 시간 넘게 남은 녹음 파일을 지운다(기록과 어긋난 파일 포함). */
export async function removeOldCallAudio(hours: number): Promise<void> {
  const dir = callAudioDir();
  const names = await readdir(dir).catch(() => [] as string[]);
  const cutoff = Date.now() - hours * 3_600_000;
  for (const name of names) {
    const file = path.join(dir, name);
    const s = await stat(file).catch(() => null);
    if (s?.isFile() && s.mtimeMs < cutoff) await rm(file, { force: true });
  }
}

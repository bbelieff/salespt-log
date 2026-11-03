/** 녹음 임시 파일 — 정해진 폴더 안에서만 쓰고 읽고 지운다. 이름은 무작위. */
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readCallAudio, removeCallAudio, removeOldCallAudio, saveCallAudio } from "@/repo/call-audio";

let dir = "";
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "call-audio-test-")); vi.stubEnv("CALL_AUDIO_DIR", dir); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(dir, { recursive: true, force: true }); });

it("저장 → 읽기(형식) → 지우기", async () => {
  const p = await saveCallAudio(new Uint8Array([1, 2, 3]), "m4a");
  expect(path.dirname(p)).toBe(path.resolve(dir));
  expect(path.basename(p)).toMatch(/^[0-9a-f-]{36}\.m4a$/);
  const r = await readCallAudio(p);
  expect([...r.audio]).toEqual([1, 2, 3]);
  expect(r.mimeType).toBe("audio/m4a");
  await removeCallAudio(p);
  await expect(readCallAudio(p)).rejects.toThrow();
  await removeCallAudio(p);
});

it("폴더 밖 경로·모르는 확장자는 거절", async () => {
  await expect(saveCallAudio(new Uint8Array(1), "exe")).rejects.toThrow("call_audio_type");
  await expect(readCallAudio(path.join(dir, "..", "x.m4a"))).rejects.toThrow("call_audio_outside");
  await expect(removeCallAudio(path.join(dir, "sub", "x.m4a"))).rejects.toThrow("call_audio_outside");
});

it("오래 남은 파일만 지운다", async () => {
  const old = path.join(dir, "old.m4a"), fresh = path.join(dir, "fresh.m4a");
  await writeFile(old, "a"); await writeFile(fresh, "b");
  const past = new Date(Date.now() - 25 * 3_600_000);
  await utimes(old, past, past);
  await removeOldCallAudio(24);
  await expect(readCallAudio(old)).rejects.toThrow();
  expect((await readCallAudio(fresh)).audio.byteLength).toBe(1);
});

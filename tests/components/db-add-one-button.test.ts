// @vitest-environment jsdom
/** 「＋ DB 추가」 하나로(belie 2026-11-07): 통화 파일 가르기·녹음한 날(유입일)·같은 번호·채널 단계. 합성 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callFilePhone, durationLabel, isCallImportFile, leadByPhone, recordedAt, recordedLabel } from "@/app/(app)/db-sheet/_components/call-import";
import { ImportDialog } from "@/app/(app)/db-sheet/_components/ImportDialog";
import { blank } from "@/app/(app)/db-sheet/_components/model";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
const NOW = Date.parse("2026-11-07T15:00:00+09:00");

describe("통화 파일 규칙", () => {
  it("녹음·PDF 는 통화, .txt 는 이름에 번호·통화가 있을 때만, 엑셀은 목록", () => {
    expect(["a.m4a", "b.MP3", "c.pdf", "통화 010-0000-0007.txt", "call_note.txt"].map(isCallImportFile)).toEqual([true, true, true, true, true]);
    expect(["list.txt", "db.xlsx", "x.csv"].map(isCallImportFile)).toEqual([false, false, false]);
  });

  it("녹음한 때: 파일 이름 날짜·시각이 먼저, 없으면 저장 시각, 미래는 지금. 90일 안이면 통화 시각도 그날로", () => {
    const named = recordedAt({ name: "통화 010-0000-0007_20261105_1412.m4a", lastModified: NOW }, NOW);
    expect(named.date).toBe("2026-11-05");
    expect(named.calledAt).toBe(new Date("2026-11-05T14:12:00+09:00").toISOString());
    expect(recordedLabel(named.ms, NOW)).toBe("11월 5일 14:12");
    const plain = recordedAt({ name: "녹음.m4a", lastModified: Date.parse("2026-11-07T00:30:00+09:00") }, NOW);
    expect([plain.date, recordedLabel(plain.ms, NOW)]).toEqual(["2026-11-07", "오늘 00:30"]);
    expect(recordedAt({ name: "x.m4a", lastModified: NOW + 86_400_000 }, NOW).ms).toBe(NOW);
    const old = recordedAt({ name: "통화_20261020_0910.m4a", lastModified: NOW }, NOW); // 18일 전 — 유입일·통화일 같은 날
    expect([old.date, old.calledAt]).toEqual(["2026-10-20", new Date("2026-10-20T09:10:00+09:00").toISOString()]);
    const older = recordedAt({ name: "통화_20260801_0910.m4a", lastModified: NOW }, NOW); // 90일 넘음 — 통화 시각은 서버가 지금으로
    expect([older.date, older.calledAt]).toEqual(["2026-08-01", undefined]);
    expect(recordedAt({ name: "통화_20261399_0910.m4a", lastModified: NOW }, NOW).date).toBe("2026-11-07"); // 없는 날짜는 저장 시각
  });

  it("이름 속 번호로 같은 줄 찾기, 길이 글자", () => {
    const rows = [{ ...blank(), id: "a", phone: "010-0000-0007" }, { ...blank(), id: "b", phone: "" }];
    expect(leadByPhone(rows, callFilePhone("통화 01000000007_20261107.m4a"))?.id).toBe("a");
    expect(leadByPhone(rows, callFilePhone("녹음.m4a"))).toBeUndefined();
    expect([durationLabel(192), durationLabel(45), durationLabel(null)]).toEqual(["3분 12초", "45초", ""]);
  });
});

let root: Root | null = null, host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; localStorage.clear(); });

function open(onCallFile: ReturnType<typeof vi.fn>, rows = [] as ReturnType<typeof blank>[]) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const onDirect = vi.fn();
  act(() => root!.render(h(ImportDialog, { rows, onClose: vi.fn(), onApply: vi.fn(), onExisting: vi.fn(), onDirect, onCallFile })));
  return { onDirect };
}
async function drop(file: File) {
  const input = host!.querySelector<HTMLInputElement>('input[aria-label="가져올 파일"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}
const button = (text: string) => [...host!.querySelectorAll("button")].find(b => b.textContent?.includes(text))!;

describe("DB 추가 창", () => {
  it("제목 DB 추가, 통화 녹음도 받고, 직접 입력은 한 건 쓰기 창으로", () => {
    const { onDirect } = open(vi.fn());
    expect(host!.querySelector("h2")!.textContent).toBe("DB 추가");
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="가져올 파일"]')!.accept).toContain(".m4a");
    act(() => button("직접 입력").click());
    expect(onDirect).toHaveBeenCalledTimes(1);
  });

  it("녹음을 놓으면 채널만 묻고, 처음이면 AI 고지를 거쳐 정리 시작", async () => {
    const onCallFile = vi.fn().mockResolvedValue(undefined);
    open(onCallFile);
    await drop(new File(["x"], "통화 010-0000-0009_20261107_1412.m4a", { lastModified: NOW }));
    expect(host!.textContent).toContain("어디서 온 DB인가요?");
    expect(host!.textContent).not.toContain("텍스트 붙여넣기");
    expect(button("정리 시작").disabled).toBe(true);
    act(() => button("현수막").click());
    await act(async () => button("정리 시작").click());
    expect(host!.textContent).toContain("처음 한 번만 확인해 주세요");
    await act(async () => button("확인하고 올리기").click());
    expect(onCallFile).toHaveBeenCalledWith(expect.any(File), "현수막", null);
  });

  it("목록에 같은 번호가 있으면 채널을 묻지 않고 그 업체 통화로", async () => {
    localStorage.setItem("db-sheet-call-notice", "1");
    const onCallFile = vi.fn().mockResolvedValue(undefined);
    open(onCallFile, [{ ...blank(), id: "00000000-0000-4000-8000-0000000000a1", company: "샘플상사", phone: "010-0000-0009" }]);
    await drop(new File(["x"], "통화 010-0000-0009_20261107_1412.m4a", { lastModified: NOW }));
    expect(host!.textContent).toContain("목록의 샘플상사 통화로 올려요");
    expect(host!.textContent).not.toContain("어디서 온 DB인가요?");
    await act(async () => button("정리 시작").click());
    expect(onCallFile).toHaveBeenCalledWith(expect.any(File), null, "00000000-0000-4000-8000-0000000000a1");
  });

  it("통화 기능이 꺼진 사람은 지금처럼 목록 가져오기만(녹음 안 받음)", () => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root!.render(h(ImportDialog, { rows: [], onClose: vi.fn(), onApply: vi.fn(), onExisting: vi.fn(), onDirect: vi.fn() })));
    expect(host.querySelector<HTMLInputElement>('input[aria-label="가져올 파일"]')!.accept).not.toContain(".m4a");
  });
});

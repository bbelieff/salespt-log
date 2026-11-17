/** 할 일 「다음」 날짜 칸은 고정 너비가 아니라 글자 길이에 맞춘다 — 글자를 키워도 요일이 … 로 잘리지 않게 (2026-11-17 belie). */
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each(["app/(app)/payment/_components/TodoRow.tsx", "app/(app)/schedule/_components/board/TodoPopover.tsx"])("%s — 다음 할 일 날짜 칸은 !w-auto", (file) => {
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.includes('ariaLabel="다음 할 일 날짜"'))!;
  expect(line).toContain("!w-auto");
  expect(line).toContain("shrink-0");
  expect(line).not.toMatch(/!w-(\d|\[)/);
});

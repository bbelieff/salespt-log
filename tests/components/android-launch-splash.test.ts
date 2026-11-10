import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import manifest from "@/app/manifest";

describe("안드로이드 시작 화면 + 첫 로딩 화면 잇기", () => {
  it("manifest 에 흰 배경과 192·512 아이콘(maskable 포함)이 있다", () => {
    const m = manifest();
    expect(m.background_color).toBe("#ffffff");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons ?? []) expect(existsSync(`public${i.src}`)).toBe(true);
  });

  it("첫 로딩 오버레이는 흰 바탕으로 뒤 화면을 가린다", () => {
    const o = readFileSync("components/ui/LoadingOverlay.tsx", "utf8");
    expect(o).toMatch(/solid \? "bg-white" : "lo-dim"/);
    const p = readFileSync("components/ui/LoadingProvider.tsx", "utf8");
    expect(p).toMatch(/setSolid\(booting\.current\)/);
    expect(p).toMatch(/if \(everActive\.current\) booting\.current = false/);
  });
});

// @vitest-environment jsdom
/** UI 점검 묶음 1(2026-11-10): 저장중.. 통일·시간 범위·개발 용어·검색 범위·자동 확인 문구·이름표. 가상 값만. */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hourOptions } from "@/components/ui/TimePicker15";
import TimeSelectPair from "@/components/ui/TimeSelectPair";
import { matchesTrainee } from "@/components/auth/trainee-search";
import { connectFeed } from "@/app/(app)/db-sheet/_components/feed-client";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const read = (p: string) => readFileSync(p, "utf8");

describe("저장중.. 통일", () => {
  it("★화면 문구에 「저장 중…」「저장중...」이 남지 않는다", () => {
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const f = join(d, n);
        if (statSync(f).isDirectory()) { walk(f); continue; }
        if (!/\.tsx?$/.test(n)) continue;
        read(f).split(/\r?\n/).forEach((l, i) => {
          if (!/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l) && /["'>]저장 ?중(…|\.\.\.)/.test(l)) bad.push(`${f}:${i + 1}`);
        });
      }
    };
    walk("app"); walk("components");
    expect(bad).toEqual([]);
  });
});

describe("시간 선택 08~21시", () => {
  it("일정 시간 선택도 08~21시, 범위 밖 기존 값은 남긴다", () => {
    expect(hourOptions("")[0]).toBe("08");
    expect(hourOptions("").at(-1)).toBe("21");
    expect(hourOptions("07")).toContain("07");
    expect(hourOptions("23").at(-1)).toBe("23");
  });
  it("★컨택 시간 칸: 범위 밖에 저장된 22시가 「--」가 아니라 그대로 보인다", () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(h(TimeSelectPair, { value: "22:00", onChange: () => {}, ariaLabel: "미팅 시간" })));
    expect((host.querySelector("select.time-hour") as HTMLSelectElement).value).toBe("22");
  });
});

describe("개발 용어", () => {
  it("관리자·일정 확인창에 개발 용어가 없다", () => {
    for (const p of ["components/auth/AdminUserPickerSections.tsx", "components/auth/TraineeCard.tsx", "components/auth/ImpersonationBanner.tsx", "components/auth/TrainerMgmtPanel.tsx", "components/auth/MigrateCacheButton.tsx", "app/(app)/schedule/_components/MeetingResultCard.tsx"]) {
      const s = read(p).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
      expect(s, p).not.toMatch(/registry row|5탭 UI|— impersonation|>\s*Impersonating|row 를 삭제|row가 삭제|trainer row|수납탭 계약카드|계약수납관리 row|backfill/);
    }
  });
  it("트레이너 확인창은 이름(이메일)으로", () => {
    expect(read("components/auth/TrainerMgmtPanel.tsx")).toContain("${who(email)} 트레이너를 내보낼까요?");
  });
});

describe("수강생 검색", () => {
  it("이름·이메일·기수 어디든 걸린다", () => {
    const u = { name: "김가상", email: "kim@example.test", cohort: "12" };
    expect(matchesTrainee(u, "가상")).toBe(true);
    expect(matchesTrainee(u, "example")).toBe(true);
    expect(matchesTrainee(u, "12")).toBe(true);
    expect(matchesTrainee(u, "박")).toBe(false);
  });
  it("★관리자 검색이 승인 대기·유보에도 걸리고, 트레이너 화면에 검색칸이 있다", () => {
    const a = read("components/auth/AdminUserPicker.tsx");
    expect(a).toContain("list={shownPending}");
    expect(a).toContain("list={shownReserved}");
    expect(read("components/auth/TrainerCohortView.tsx")).toContain('aria-label="수강생 검색"');
  });
});

describe("자동 확인만 연결 실패 문구", () => {
  it("★새 DB 없이 연결만 할 땐 「DB는 추가했지만」을 붙이지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 500 })));
    const msgs: string[] = [];
    const on = (e: Event) => msgs.push((e as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener("db-sheet:feeds-changed", on);
    const evName = read("app/(app)/db-sheet/_components/feed-client.ts").match(/FEEDS_CHANGED\s*=\s*['"]([^'"]+)['"]/)?.[1];
    if (evName) window.addEventListener(evName, on);
    await connectFeed({ url: "https://example.test/s", supplier: "가상", channel: "매입DB", rules: {} }, false);
    await connectFeed({ url: "https://example.test/s", supplier: "가상", channel: "매입DB", rules: {} });
    const fails = msgs.filter((m) => m.includes("연결하지 못했어요"));
    expect(fails[0]).not.toContain("DB는 추가했지만");
    expect(fails[1]).toContain("DB는 추가했지만");
  });
});

describe("이름표 연결", () => {
  it("수납 진행건·미팅 카드·계정 연결 입력칸에 htmlFor 가 있다", () => {
    expect(read("app/(app)/payment/_components/PaymentSlotForm.tsx").match(/<label htmlFor=\{id\}/g)).toHaveLength(6);
    expect(read("app/(app)/contact/_components/MeetingSlotForm.tsx").match(/<label htmlFor=\{id\}/g)).toHaveLength(2);
    expect(read("app/claim/page.tsx").match(/htmlFor="claim-/g)).toHaveLength(4);
  });
});

/**
 * 계약 → 장부(02) 팬아웃 판정 회귀 가드.
 *
 * 배경(2026-09-01 belie 신고 · 10기 문병규): 대시보드는 「계약 4건」, 실무/수납은 3건.
 * 시트 원본 대조 결과 `04 업체관리` 에 상태=계약(케이탑전기진단 8/31 ₩1,100,000)이 있는데
 * `02 계약수납관리` 엔 그 줄이 없었다. 계약 처리가 두 번의 쓰기로 쪼개져 있고 둘째가
 * 빠져도 아무도 맞춰주지 않았다. 수강생이 직접 연락해서야 드러났다.
 *
 * 여기서 못 박는 것:
 *   ① 출처를 못 잡으면 **skip 이 아니라 blocked** — 조용한 성공(`✓ 저장 완료`) 금지
 *   ② 이미 계약이던 카드도 태운다 — 재저장이 곧 복구 경로다
 *   ③ 수임비는 이번 입력 우선, 없으면 미팅 값, 그것도 없으면 0
 */
import { describe, expect, it } from "vitest";
import {
  decideContractFanout,
  type FanoutSource,
} from "@/app/(app)/schedule/_lib/contract-fanout";

const meeting = (over: Partial<FanoutSource> = {}): FanoutSource => ({
  미팅날짜: "2026-08-31",
  업체명: "케이탑전기진단",
  수임비: 1_100_000,
  ...over,
});

describe("decideContractFanout", () => {
  it("계약 저장이 아니면 장부를 건드리지 않는다", () => {
    expect(decideContractFanout({ 상태: "예정" }, meeting()).kind).toBe("skip");
    expect(decideContractFanout({ 수임비: 100 }, meeting()).kind).toBe("skip");
  });

  it("계약 저장이면 장부 payload 를 만든다", () => {
    const d = decideContractFanout({ 상태: "계약" }, meeting());
    expect(d).toEqual({
      kind: "run",
      payload: { 계약일: "2026-08-31", 업체명: "케이탑전기진단", 수임비: 1_100_000 },
    });
  });

  it("★이미 계약이던 카드도 태운다 — 재저장이 곧 복구 경로다", () => {
    // 옛 코드는 `!wasAlreadyContract` 로 걸러서, 한 번 빠지면 다시 저장해도 영영 안 채워졌다.
    // 판정에 '이전 상태'가 아예 들어오지 않는다는 것 자체가 그 회귀를 막는다.
    const d = decideContractFanout({ 상태: "계약" }, meeting());
    expect(d.kind).toBe("run");
    expect(decideContractFanout.length).toBe(2); // (partial, prevMeeting) — 3번째 인자 없음
  });

  it("★출처 미팅이 없으면 blocked — 조용한 성공 금지", () => {
    // 옛 코드는 여기서 `✓ 저장 완료 (meeting lookup 실패 — fan-out 생략)` 를 띄웠다.
    expect(decideContractFanout({ 상태: "계약" }, undefined).kind).toBe("blocked");
  });

  it("★업체명이나 계약일이 비면 blocked — 빈 자연키 행을 만들지 않는다", () => {
    expect(decideContractFanout({ 상태: "계약" }, meeting({ 업체명: "  " })).kind).toBe(
      "blocked",
    );
    expect(decideContractFanout({ 상태: "계약" }, meeting({ 미팅날짜: "" })).kind).toBe(
      "blocked",
    );
  });

  it("수임비는 이번 입력 → 미팅 값 → 0 순으로 정해진다", () => {
    const run = (p: { 상태?: string; 수임비?: number }, m: FanoutSource) => {
      const d = decideContractFanout(p, m);
      if (d.kind !== "run") throw new Error("run 이어야 한다");
      return d.payload.수임비;
    };
    expect(run({ 상태: "계약", 수임비: 500_000 }, meeting())).toBe(500_000);
    expect(run({ 상태: "계약" }, meeting())).toBe(1_100_000);
    expect(run({ 상태: "계약" }, meeting({ 수임비: undefined }))).toBe(0);
    expect(run({ 상태: "계약", 수임비: 0 }, meeting())).toBe(0); // 0 을 미입력으로 보지 않는다
  });

  it("업체명·계약일의 앞뒤 공백은 다듬어 보낸다 — 자연키가 어긋나지 않게", () => {
    const d = decideContractFanout(
      { 상태: "계약" },
      meeting({ 업체명: "  케이탑전기진단 ", 미팅날짜: " 2026-08-31 " }),
    );
    if (d.kind !== "run") throw new Error("run 이어야 한다");
    expect(d.payload.업체명).toBe("케이탑전기진단");
    expect(d.payload.계약일).toBe("2026-08-31");
  });
});

describe("★계약 저장 화면이 조용한 성공을 내지 않는다 (소스 가드)", () => {
  it("patch 뒤 미팅을 다시 뒤지지 않는다 — 그 재조회가 매출 유실의 통로였다", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/(app)/schedule/page.tsx", "utf8");
    // 옛 코드의 흔적: fan-out 직전에 weekQuery 를 다시 flatMap 해서 미팅을 찾던 블록.
    expect(src).not.toContain("fan-out 생략");
    expect(src).toContain("decideContractFanout");
  });
});

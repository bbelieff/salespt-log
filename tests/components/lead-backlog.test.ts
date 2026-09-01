/**
 * 콜·지·기·소 「아직 미팅 안 잡은 영업기회」 표시 — 회귀 가드.
 *
 * 배경(2026-09-02 belie 신고): STEP 1 에서 접수일을 지난 날짜로 적으면 오늘 컨택관리의
 * 유입 숫자에 안 보인다. ADR-0029 가 콜지기소 유입을 **그 날짜의 접수 건수**로 정의하기 때문.
 * belie 선택 A — **저장값은 그대로 두고 화면에만 대기 건수를 보여준다.**
 *
 * 여기서 못 박는 것:
 *   ① 접수일과 무관하게 미매칭이면 센다
 *   ② ★유입 저장 규칙(ADR-0029)은 건드리지 않는다 — 통계 불변이 이 기능의 전제
 *   ③ ★다른 채널을 보는 동안에는 발굴 목록을 부르지 않는다(요청 0)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { countUnmatchedLeads } from "@/app/(app)/contact/_lib/lead-backlog";

describe("countUnmatchedLeads", () => {
  it("★미매칭만 센다 — 접수일은 보지 않는다", () => {
    expect(
      countUnmatchedLeads([
        { matched: false },
        { matched: true },
        { matched: false },
        {},
      ]),
    ).toBe(3);
  });

  it("전부 매칭됐으면 0", () => {
    expect(countUnmatchedLeads([{ matched: true }, { matched: true }])).toBe(0);
  });

  it("아직 목록을 못 받았으면 0 — 로딩 중 '0건' 깜빡임 방지", () => {
    expect(countUnmatchedLeads(undefined)).toBe(0);
    expect(countUnmatchedLeads([])).toBe(0);
  });
});

describe("★유입 저장 규칙은 건드리지 않는다 (소스 가드)", () => {
  const panel = readFileSync(
    "app/(app)/contact/_components/ChannelTabsAndPanel.tsx",
    "utf8",
  );

  it("표시용 대기 건수와 저장용 유입은 서로 다른 값이다", () => {
    // leadInflow(ADR-0029 파생, 그 날짜 접수 건수)는 그대로 남아 있어야 한다.
    expect(panel).toContain("const leadInflow = overview.data");
    expect(panel).toContain('strF(l as never, "접수일") === date');
    // 대기 건수는 별도 변수 — 유입 자리에 끼워넣지 않는다.
    expect(panel).toContain("const leadBacklog = countUnmatchedLeads(");
  });

  it("★대기 건수를 유입 표시값이나 합계에 더하지 않는다", () => {
    expect(panel).not.toMatch(/leadInflow\s*\+\s*leadBacklog/);
    expect(panel).not.toMatch(/leadBacklog\s*\+\s*leadInflow/);
  });

  it("★콜지기소 패널일 때만 발굴 목록을 부른다 — 다른 채널에선 요청 0", () => {
    expect(panel).toContain('useLeadCandidates(active === "콜·지·기·소")');
    const hooks = readFileSync("lib/query/db-hooks.ts", "utf8");
    expect(hooks).toMatch(/useLeadCandidates\(\s*[\s\S]{0,200}?enabled = true,?\s*\)/);
    expect(hooks).toContain("enabled,");
  });

  it("대기 건수가 0이면 줄 자체를 안 그린다", () => {
    expect(panel).toContain("leadBacklog > 0");
  });
});

/**
 * 2026-09-19 — DB생산 목록 추가 후 안내가 **그 채널에서 실제로 가능한 일**만 말하는지.
 *
 * 무엇이 터졌나: 현수막에 목록을 넣은 수강생이 「대시보드에 안 뜬다」고 신고했다.
 * 원인은 두 겹이었다.
 *
 *   ① **현수막은 안내가 아예 안 떴다.** `if (activeCh !== "banner")` 가 막고 있었고,
 *      근거 주석("게시한날=생산이라 별도 입력 불필요")은 ADR-0023 시절 기준이었다.
 *      **ADR-0025(2026-06-23)가 게시로그를 폐기**하고 생산(E)=게시를 컨택탭 스테퍼
 *      소유로 옮긴 뒤로, 현수막은 컨택에서 게시를 적어야만 지표가 생긴다 —
 *      안내가 가장 필요한 채널이 유일하게 빠져 있었다.
 *   ② 뜨는 채널엔 **불가능한 지시**를 했다. "컨택관리에서 생산을 기록하라"인데
 *      매입DB·콜·지·기·소의 그 행은 「🔒 DB자동」 읽기전용이라 손으로 못 적는다.
 *
 * 대시보드는 주문·재고를 읽지 않고 컨택탭 수치만 보므로, 기록이 비면 대시보드도 빈다.
 *
 * 이 테스트는 **그 두 겹을 각각** 잡는다. 특히 ①은 문구만 고치고 모달이 안 뜨면
 * 초록이 되던 과거 실수를 막기 위해 **차단 가드가 없다는 것 자체**를 단언한다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const WORKSPACE = "app/(app)/db/_components/DbChannelWorkspace.tsx";
const CHANNELS = "app/(app)/db/_lib/channels.ts";
const CONTACT_PANEL = "app/(app)/contact/_components/ChannelTabsAndPanel.tsx";

/** 주석은 빼고 실제 코드만 본다 — 「무엇을 왜 고쳤는지」 설명하는 주석에 걸리지 않게. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const workspace = readFileSync(WORKSPACE, "utf8");
const code = stripComments(workspace);
const channels = readFileSync(CHANNELS, "utf8");
const contactPanel = readFileSync(CONTACT_PANEL, "utf8");
const contactCode = stripComments(contactPanel);

describe("① 안내가 현수막에도 뜬다 — 신고 케이스 직접 가드", () => {
  it("★채널로 안내를 막는 분기가 없다", () => {
    // 과거: `if (activeCh !== "banner") { setProductionHint(...) }` 로 현수막만 제외.
    // 어떤 채널이든 목록을 넣었으면 다음 할 일을 알려줘야 한다(자동이면 자동이라고).
    expect(code).not.toMatch(/activeCh\s*!==\s*["']banner["']/);
    expect(code).not.toMatch(/channel\s*!==\s*["']banner["']/);
  });

  it("★목록 추가 성공 경로에서 조건 없이 안내를 연다", () => {
    // setProductionHint 호출이 if 블록 안에 감싸여 있지 않아야 한다.
    const call = code.indexOf("setProductionHint({");
    expect(call).toBeGreaterThan(-1);
    // 호출 직전 200자에 `if (` 가 없어야 한다(조건부 노출 재발 방지).
    const before = code.slice(Math.max(0, call - 200), call);
    expect(before).not.toMatch(/if\s*\(/);
  });
});

describe("② 안내가 그 채널에서 가능한 일만 말한다", () => {
  it("★손으로 넣는 채널은 현수막=게시, 직접생산=유입", () => {
    expect(code).toMatch(/hintKey === ["']banner["'] \? ["']게시["']/);
    expect(code).toMatch(/hintKey === ["']direct["'] \? ["']유입["']/);
  });

  it("★매입DB·콜지기소는 입력을 요구하지 않는다 (null = 자동)", () => {
    // 위 삼항의 최종 else 가 null 이어야 한다 — 그래야 자동형 문구가 나온다.
    expect(code).toMatch(/hintKey === ["']direct["'] \? ["']유입["'] : null/);
    expect(workspace).toContain("따로 입력하지 않으셔도 돼요");
  });

  it("★「생산을 기록하라」는 말이 사라졌다 — 어느 채널에도 맞지 않았다", () => {
    expect(code).not.toContain("생산도 기록");
    expect(code).not.toContain("생산 입력하셨나요");
  });

  it("목록 이름을 하드코딩하지 않는다 — 채널마다 다르다", () => {
    expect(code).not.toContain("구매목록");
    expect(code).not.toContain("제작목록");
    expect(code).toContain("recordsLabel");
  });

  it("강조할 스테퍼를 채널의 실제 지표로 넘긴다", () => {
    // 직접생산은 「유입」 스테퍼를 쓰므로 focus=production 이면 엉뚱한 곳을 가리킨다.
    expect(code).toMatch(/hintKey === ["']direct["'] \? ["']inflow["'] : ["']production["']/);
    expect(code).not.toMatch(/focus:\s*["']production["']/); // 고정값 금지
  });

  it("여기까지 해야 대시보드에 보인다고 알려준다", () => {
    expect(workspace).toContain("대시보드에 바로 보여요");
  });
});

describe("③ 말이 실제 화면과 맞는지 — 출처 대조", () => {
  it("채널별 목록 이름 정본", () => {
    expect(channels).toMatch(/purchase:[\s\S]*?recordsLabel:\s*"구매목록"/);
    expect(channels).toMatch(/direct:[\s\S]*?recordsLabel:\s*"생산목록"/);
    expect(channels).toMatch(/banner:[\s\S]*?recordsLabel:\s*"제작목록"/);
    expect(channels).toMatch(/referral:[\s\S]*?recordsLabel:\s*"영업기회"/);
  });

  it("★현수막 컨택탭 스테퍼는 「게시」다 — 바뀌면 안내도 같이 바꿔야 한다", () => {
    expect(contactPanel).toContain('aria-label="게시 증가"');
    expect(contactPanel).toContain('aria-label="게시 수치"');
  });

  it("★매입DB·콜지기소 첫 행은 읽기전용이다 — 그래서 입력을 요구하면 안 된다", () => {
    // 이 잠금이 풀리면(손으로 입력 가능해지면) 자동형 문구도 다시 봐야 한다.
    expect(contactCode).toContain("🔒 DB자동");
    expect(contactCode).toContain('active === "매입DB" ? "유입대기" : "생산"');
  });
});

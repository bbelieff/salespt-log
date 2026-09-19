/**
 * 2026-09-19 — DB생산 저장 후 안내 모달이 **화면에 실제로 있는 단어**를 쓰는지.
 *
 * 무엇이 터졌나: 현수막에 목록을 넣은 수강생이 「대시보드에 안 뜬다」고 했다. 버그가 아니라
 * 안내가 엉뚱한 말을 해서였다 —
 *   ① 목록 이름을 「구매목록」으로 통으로 박았는데 현수막은 **「제작목록」**이고,
 *   ② 컨택탭에서 「생산」을 찾으라 했는데 현수막 스테퍼는 **「게시」**다(ADR-0025).
 * 학생은 화면에 없는 단어를 찾다 기록을 못 했고, 대시보드는 주문·재고를 보지 않으므로
 * (컨택탭 수치만 본다) 계속 비어 있었다.
 *
 * 그래서 이 테스트는 **문구를 하드코딩하지 못하게** 막는다.
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
const workspaceCode = stripComments(workspace);
const channels = readFileSync(CHANNELS, "utf8");
const contactPanel = readFileSync(CONTACT_PANEL, "utf8");

describe("DB생산 안내 모달 — 채널의 실제 말을 쓴다", () => {
  it("★목록 이름을 하드코딩하지 않는다 — 채널마다 다르다", () => {
    // 「구매목록」은 매입DB 전용. 통으로 박으면 현수막(제작목록)에서 거짓말이 된다.
    expect(workspaceCode).not.toContain("구매목록");
    expect(workspaceCode).toContain("recordsLabel");
  });

  it("★현수막은 「생산」이 아니라 「게시」라고 안내한다 (ADR-0025)", () => {
    expect(workspaceCode).toContain('"banner" ? "게시" : "생산"');
  });

  it("안내가 가리키는 채널로 조회한다 — 활성 채널이 아니라", () => {
    expect(workspaceCode).toContain("productionHint ? CHANNELS[productionHint.channel]");
  });

  it("여기까지 해야 대시보드에 잡힌다고 알려준다", () => {
    expect(workspace).toContain("대시보드에 반영");
  });
});

describe("말이 실제 화면과 맞는지 — 출처 대조", () => {
  it("현수막 목록 이름은 「제작목록」이다", () => {
    expect(channels).toMatch(/banner:[\s\S]*?recordsLabel:\s*"제작목록"/);
  });

  it("매입DB 목록 이름은 「구매목록」이다", () => {
    expect(channels).toMatch(/purchase:[\s\S]*?recordsLabel:\s*"구매목록"/);
  });

  it("★현수막 컨택탭 스테퍼 라벨은 「게시」다 — 이게 바뀌면 안내도 같이 바꿔야 한다", () => {
    expect(contactPanel).toContain('aria-label="게시 증가"');
    expect(contactPanel).toContain('aria-label="게시 감소"');
  });
});

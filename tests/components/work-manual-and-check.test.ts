/**
 * 2026-09-05 belie 두 건 — 회귀 가드.
 *
 * [1] 실무·수납 탭의 「이전 계약업체 등록」 자리를 **업무매뉴얼(노션)** 버튼으로 교체.
 *     기능은 **지우지 않았다** — `PriorContractRegister.tsx` 로 옮겨 두 줄이면 되살아난다.
 *     서버(API·서비스)는 손대지 않았으므로 **이미 등록된 이전 계약은 계속 보인다.**
 *
 * [2] 저장 전 확인 화면에서 **기록일 = 미팅예정일**이면 **빨강**(확인 필요).
 *     못 채운 칸(노랑)과 색을 나눈다 — 둘 다 노랑이면 「채우면 되는 것」과
 *     「맞는지 봐야 하는 것」이 섞여 안 읽힌다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SECTION = "app/(app)/payment/_components/PriorContractSection.tsx";
const REGISTER = "app/(app)/payment/_components/PriorContractRegister.tsx";
const CONFIRM = "app/(app)/contact/_components/SaveConfirmModal.tsx";
const LINKS = "lib/config/links.ts";

/** 주석은 빼고 **실제 코드**만 본다 — 「무엇을 왜 뺐는지」 설명하는 주석에 걸리지 않게. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const section = readFileSync(SECTION, "utf8");
const sectionCode = stripComments(section);
const register = readFileSync(REGISTER, "utf8");
const confirm = readFileSync(CONFIRM, "utf8");
const links = readFileSync(LINKS, "utf8");

describe("[1] 업무매뉴얼 버튼", () => {
  it("실무·수납 탭에 노션 링크가 새 탭으로 열린다", () => {
    expect(section).toContain("WORK_MANUAL_URL");
    expect(section).toContain('target="_blank"');
    expect(section).toContain('rel="noopener noreferrer"'); // 새 탭 보안 기본
    expect(section).toContain("업무매뉴얼 보기");
  });

  it("주소는 config 한 곳에만 있다 — 바뀌면 한 줄만 고친다", () => {
    expect(links).toContain("climbing-caraway-ec3.notion.site");
    expect(sectionCode).not.toContain("notion.site"); // 컴포넌트에 하드코딩 금지
  });

  it("★「이전 계약업체 등록」 버튼은 화면에서 빠졌다", () => {
    expect(sectionCode).not.toContain("이전 계약업체 등록");
    expect(sectionCode).not.toContain("useAddPriorContract");
    expect(sectionCode).not.toContain("ContractForm"); // 등록 폼도 안 붙어 있다
  });

  it("★기능은 지워지지 않았다 — 통째로 보존돼 있다", () => {
    expect(register).toContain("이전 계약업체 등록");
    expect(register).toContain("useAddPriorContract");
    expect(register).toContain("ContractPayment.parse");
    expect(register).toContain("되살리는 법"); // 복구 안내가 파일 머리말에 있다
  });

  it("★이미 등록된 이전 계약은 계속 보인다 — 매출 2카드는 그대로", () => {
    expect(section).toContain("isCarryoverContract");
    expect(section).toContain("이월 매출");
    expect(section).toContain("아레나 매출");
  });
});

describe("[2] 기록일 = 미팅예정일 → 빨강", () => {
  it("★같은 날은 빨강, 못 채운 칸은 노랑 — 색이 겹치지 않는다", () => {
    expect(confirm).toContain('check: "bg-red-50"');
    expect(confirm).toContain('warn: "bg-amber-50"');
    expect(confirm).toMatch(/const mark: Mark = !done \? "warn" : sameDay \? "check" : "none"/);
  });

  it("★왜 확인이 필요한지 사유를 칸에 적는다", () => {
    expect(confirm).toContain("확인 필요 · 기록일과 미팅예정일 동일");
  });

  it("하단 안내도 빨강으로 맞춘다 — 칸 색과 말이 어긋나지 않게", () => {
    expect(confirm).toContain("border-red-300 bg-red-50");
    expect(confirm).toContain("빨간 칸");
    expect(confirm).not.toContain("노란 칸");
  });

  it("막지는 않는다 — 당일 미팅은 실제로 있으므로 저장 가능", () => {
    // 저장 잠금은 「못 채운 미팅」에만 걸린다.
    expect(confirm).toContain("disabled={unfilled.length > 0 || saving}");
  });
});

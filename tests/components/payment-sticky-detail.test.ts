import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 실무/수납 상세 스티키(payment-sticky-detail 2026-10-09, belie 승인 목업).
 * 모바일 inline 상세: 업체 이름 줄이 헤더+배너 아래(top-app-content)에 붙고 저장 상태가 항상 보인다.
 * 섹션 제목은 그 아래(app-content + 업체 줄 3rem)에, PC 열에서는 열 맨 위(0)에 붙는다.
 * 터치 기기에서 입력 중이면 제목 고정을 풀어 키보드 위 입력칸을 가리지 않는다.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const row = read("app/(app)/payment/_components/ContractRow.tsx");
const page = read("app/(app)/payment/page.tsx");
const css = read("app/globals.css");

describe("모바일 업체 이름 줄", () => {
  it("inline 상세에서만, 헤더+배너 바로 아래에 3rem 높이로 붙는다", () => {
    expect(row).toContain("{inline && (\n            <div ref={barRef} data-payment-sticky-bar");
    expect(row).toContain("sticky top-app-content z-20 -mx-2.5 -mt-2.5 flex h-12");
    // 헤더(z-50)·배너(z-40)·검색(z-30) 아래, 섹션 제목(z-10) 위.
    expect(row).not.toMatch(/data-payment-sticky-bar[^>]*z-(30|40|50)/);
  });
  it("저장 상태를 항상 한 단어로 보여 주고(저장됨·저장 중…·입력 중·저장 실패) 실패는 다시 시도", () => {
    for (const word of ["저장됨", "저장 중…", "입력 중", "저장 실패", "다시 시도"]) expect(row).toContain(word);
    expect(row).toContain('<span aria-live="polite" className="shrink-0 text-xs">{barStatus}</span>');
    // inline 에서는 예전 상태 블록을 그리지 않는다(두 번 보이지 않게).
    expect(row).toContain("{!inline && (status !== \"idle\" || canUndo || ciState.error || ciState.saving) && (");
    // 대신 실패 사유는 업체 이름 줄 아래 한 줄로 보인다(title 에만 숨기지 않는다).
    expect(row).toContain("{inline && (ciState.error || (status === \"error\" && error)) && (");
  });
  it("접기는 부모에 알리고 목록의 업체 행으로 돌아간다 — 움직임 줄이기 설정을 지킨다", () => {
    expect(row).toContain("onCollapse?.();");
    expect(row).toContain("anchor?.focus({ preventScroll: true });");
    expect(row).toContain('matchMedia?.("(prefers-reduced-motion: reduce)")');
    expect(row).toContain('[id^="payment-company-detail-"], [id^="payment-inline-detail-"]');
    expect((page.match(/onCollapse=\{\(\) => setMobileDetailExpanded\(false\)\}/g) ?? []).length).toBe(2);
    // 목록 행은 위에 붙은 헤더+배너 밑으로 숨지 않게 그만큼 여백을 두고 스크롤된다.
    expect(read("app/(app)/payment/_components/ContractListTable.tsx")).toContain("scroll-mt-app-content");
    expect(read("app/(app)/payment/_components/InstitutionWorkList.tsx")).toContain("scroll-mt-app-content");
  });
  it("업체 이름 줄과 같은 내용을 반복하던 날짜·서류 띠는 없앴다", () => {
    expect(page).not.toContain("border-b border-blue-100 px-2.5 py-2 text-px-11");
    expect(page).not.toContain("border-b border-red-100 px-2.5 py-2 text-px-11");
    expect(row).toContain("📋 {docsDone}/{TOTAL_CHECKBOXES}");
  });
});

describe("섹션 제목 고정", () => {
  it("업체정보·계약정보·서류·로드맵·실무진행 제목이 불투명 배경으로 붙는다", () => {
    expect((row.match(/payment-sticky-title/g) ?? []).length).toBe(3);
    expect(row).toContain("payment-sticky-title flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-white group-open:rounded-b-none");
    expect(row).toContain("payment-sticky-title cursor-pointer list-none rounded-lg bg-amber-50 group-open:rounded-b-none");
    expect(row).not.toContain("bg-amber-50/80");
    expect(read("app/(app)/payment/_components/ContractSlots.tsx")).toContain("payment-sticky-title -mx-3 -mt-3 mb-2 flex items-center justify-between rounded-t-lg bg-amber-50");
    // 업체정보 헤더는 실무/수납(desktopHeading)에서만 — 컨택·일정 화면은 그대로.
    expect(read("components/CompanyInfoEditor.tsx")).toContain('desktopHeading ? `payment-sticky-title bg-white px-3 py-2 ${open ? "rounded-t-lg" : "rounded-lg"}` : "px-2.5 py-1.5"');
  });
  it("CSS: 모바일은 헤더+배너+업체 줄 아래, 1280 이상 PC 열은 맨 위, 터치 입력 중엔 고정 해제", () => {
    const block = css.slice(css.indexOf("payment-sticky-detail"), css.indexOf("Desktop glass shell"));
    expect(block).toContain("top: calc(var(--app-header-height) + 6rem);");
    expect(block).toContain("z-index: 10;");
    expect(block).toMatch(/@media \(min-width: 1280px\) \{\s*\.payment-sticky-title \{ top: 0; \}/);
    expect(block).toContain("@media (pointer: coarse)");
    expect(block).toContain("[data-payment-inline-detail]:has(:is(input, textarea, select):focus) .payment-sticky-title { position: static; }");
    // 데스크탑 글래스 구역(.desktop-shell 전용) 앞에 있어야 범위 검사와 충돌하지 않는다.
    expect(css.indexOf("payment-sticky-detail")).toBeLessThan(css.indexOf("Desktop glass shell"));
    expect(row).toContain('data-payment-inline-detail={inline ? "" : undefined}');
  });
});

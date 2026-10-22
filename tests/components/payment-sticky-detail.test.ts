// @vitest-environment jsdom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import AutosaveStatus from "@/components/autosave/AutosaveStatus";
import { shouldCommitPaymentBlur } from "@/app/(app)/payment/_components/PaymentMobileSaveFeedback";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

/**
 * 실무/수납 상세 스티키(payment-sticky-detail 2026-10-09, belie 승인 목업).
 * 모바일 <=767 R5는 rail/예약offset 없이 payment전용 알림을 사용한다.
 * 768 이상 inline의 기존 상태 줄과 PC 열 제목은 그대로 보존한다.
 * 터치 기기에서 입력 중이면 제목 고정을 풀어 키보드 위 입력칸을 가리지 않는다.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const row = read("app/(app)/payment/_components/ContractRow.tsx");
const page = read("app/(app)/payment/page.tsx");
const css = read("app/globals.css");

describe("기존 noncompact inline 상태 줄과 compact 대체 표현", () => {
  it("기존 inline 줄을 보존하지만 compact에서는 감추고 흐름 밖 알림을 쓴다", () => {
    expect(row).toContain("{inline && (\n            <div data-payment-sticky-bar data-payment-save-status");
    expect(row).toContain("sticky top-app-content z-20 -mx-2.5 -mt-2.5 flex min-h-6");
    expect(row).toContain('className="min-h-9 underline'); expect(row).toContain('className="min-h-9 text-slate-500');
    // 헤더(z-50)·배너(z-40)·검색(z-30) 아래, 섹션 제목(z-10) 위.
    expect(row).not.toMatch(/data-payment-sticky-bar[^>]*z-(30|40|50)/);
    expect(read('app/(app)/payment/payment-company-compact.css')).toContain('[data-payment-inline-detail]>[data-payment-sticky-bar]{display:none}');
    expect(row).toContain('<PaymentMobileSaveFeedback ownerId={dirtyEntryId} status={status}');
  });
  it("noncompact 상태/compact 지속 오류와 명시 retry를 모두 보존한다", () => {
    for (const word of ["저장됨", "저장 중…", "입력 중", "저장 실패", "다시 시도"]) expect(row).toContain(word);
    expect(row).toContain('<span aria-live="polite" className="shrink-0 text-xs">{barStatus}</span>');
    // inline 에서는 예전 상태 블록을 그리지 않는다(두 번 보이지 않게).
    expect(row).toContain('const pcStatus = !inline && (status !== "idle" || canUndo || ciState.error || ciState.saving) ? (');
    expect(row).toContain('bare && statusTarget ? createPortal(pcStatus, statusTarget) : pcStatus');
    expect(page).toContain('ref={setDetailStatusTarget} data-payment-pc-status-slot');
    expect(page).toContain('statusTarget={detailStatusTarget}');
    expect(row).toContain('data-payment-pc-error');
    // 대신 실패 사유는 업체 이름 줄 아래 한 줄로 보인다(title 에만 숨기지 않는다).
    expect(row).toContain("{inline && (ciState.error || (status === \"error\" && error)) && (");
  });
  it("상세의 별도 접기 대신 전체 요약 카드가 토글을 맡고 PC 제목은 그대로다", () => {
    expect(row).not.toContain("collapseToList"); expect(row).not.toContain("상세 접기");
    expect(page).not.toContain("onCollapse=");
    expect((page.match(/onToggleDetail=\{\(\) => dispatch\(\{ type: "toggleDetail" \}\)\}/g) ?? []).length).toBe(2);
    expect(page).toContain('<h2 className='); expect(page).toContain('{selectedCp.업체명}');
    // 목록 행은 위에 붙은 헤더+배너 밑으로 숨지 않게 그만큼 여백을 두고 스크롤된다.
    expect(read("app/(app)/payment/_components/ContractListTable.tsx")).toContain("scroll-mt-app-content");
    expect(read("app/(app)/payment/_components/InstitutionWorkList.tsx")).toContain("scroll-mt-app-content");
  });
  it("저장 줄에서 반복 업체명·날짜/수임비/서류 정보와 명시 접기를 제거한다", () => {
    expect(page).not.toContain("border-b border-blue-100 px-2.5 py-2 text-px-11");
    expect(page).not.toContain("border-b border-red-100 px-2.5 py-2 text-px-11");
    const bar = row.slice(row.indexOf('<div data-payment-sticky-bar'), row.indexOf('{inline && (ciState.error'));
    for (const duplicate of ['cp.업체명', 'fmtDate', 'fmtMoney', 'TOTAL_CHECKBOXES', '접기']) expect(bar).not.toContain(duplicate);
    expect(bar).toContain('{barStatus}');
    expect(row).not.toContain('variant="note"');
    expect(row).toContain('isCarryover && <CarryoverBadge 구분="이월" variant="badge"');
  });
});

it("keeps PC heading portal undo/retry owned while committing real external blur and cleaning old owners", () => {
  const host=document.createElement('div'),slot=document.createElement('span'),outside=document.createElement('button'),foreign=document.createElement('div');
  foreign.setAttribute('data-payment-feedback-dock','');foreign.setAttribute('data-payment-feedback-owner',':foreign:');const foreignButton=document.createElement('button');foreign.append(foreignButton);document.body.append(host,slot,outside,foreign);
  const root=createRoot(host),commit=vi.fn(),undo=vi.fn(),retry=vi.fn();
  const render=(owner=':current:',error=false,available=true)=>act(()=>root.render(h('div',{onBlur:(event:React.FocusEvent<HTMLDivElement>)=>{if(shouldCommitPaymentBlur(event.currentTarget,event.relatedTarget,owner))commit();}},h('input'),createPortal(available?h('div',{'data-payment-pc-status':'','data-payment-feedback-dock':'','data-payment-feedback-owner':owner},h(AutosaveStatus,{status:error?'error':'saved',error:error?'합성 오류':undefined,canUndo:true,onUndo:undo,onRetry:retry})):null,slot))));
  try {
    render();const input=host.querySelector('input')!,button=slot.querySelector<HTMLButtonElement>('button')!;
    act(()=>{input.focus();button.focus();button.click();});expect(commit).not.toHaveBeenCalled();expect(undo).toHaveBeenCalledTimes(1);
    act(()=>outside.focus());expect(commit).toHaveBeenCalledTimes(1);
    act(()=>{input.focus();foreignButton.focus();});expect(commit).toHaveBeenCalledTimes(2);
    act(()=>{input.focus();input.blur();});expect(commit).toHaveBeenCalledTimes(3);
    render(':current:',true);const retryButton=slot.querySelector<HTMLButtonElement>('button')!;act(()=>{input.focus();retryButton.focus();retryButton.click();});expect(commit).toHaveBeenCalledTimes(3);expect(retry).toHaveBeenCalledTimes(1);
    render(':next:');expect(slot.querySelector('[data-payment-feedback-owner=":current:"]')).toBeNull();expect(slot.querySelectorAll('[data-payment-pc-status]')).toHaveLength(1);
    render(':next:',false,false);expect(slot.childElementCount).toBe(0);
    act(()=>root.unmount());expect(slot.childElementCount).toBe(0);
    expect(row).toContain('data-payment-feedback-owner={dirtyEntryId}');expect(row).toContain('canUndo={canUndo} onUndo={undo}');expect(row).toContain('onRetry={retryAll}');
    expect(read('app/(app)/payment/payment-company-compact.css')).toContain('[data-payment-pc-status] button{min-height:44px}');
  } finally { if(host.childElementCount)act(()=>root.unmount());host.remove();slot.remove();outside.remove();foreign.remove(); }
});

describe("섹션 제목 고정", () => {
  it("업체정보·계약정보·서류·로드맵·실무진행 제목이 불투명 배경으로 붙는다", () => {
    expect((row.match(/payment-sticky-title/g) ?? []).length).toBe(3);
    expect(row).toContain("payment-sticky-title flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-white group-open:rounded-b-none");
    expect(row).toContain("payment-sticky-title cursor-pointer list-none rounded-lg bg-amber-50 group-open:rounded-b-none");
    expect(row).not.toContain("bg-amber-50/80");
    expect(read("app/(app)/payment/_components/ContractSlots.tsx")).toContain("payment-sticky-title -mx-3 -mt-3 mb-2 flex items-center justify-between rounded-t-lg bg-amber-50");
    // 업체정보 헤더는 실무/수납(desktopHeading)에서만 — 컨택·일정 화면은 그대로.
    expect(read("components/CompanyInfoEditor.tsx")).toContain('<CompanyInfoHeader open={open}');
    expect(read("components/CompanyInfoEditor.tsx")).toContain('desktopHeading={desktopHeading} payment={paymentHeading}');
    expect(read("components/company-info/CompanyInfoHeader.tsx")).toContain("desktopHeading ? `payment-sticky-title bg-white px-3 py-2 ${open ? 'rounded-t-lg' : 'rounded-lg'}` : 'px-2.5 py-1.5'");
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
    const compact = read('app/(app)/payment/payment-company-compact.css');
    expect(compact).toContain('@media(max-width:1279px)');
    expect(compact).toContain('[data-payment-inline-detail] .payment-sticky-title{top:calc(var(--app-header-height) + 4.5rem)}');
    expect(compact).toContain('[data-payment-inline-detail][data-payment-status-action] .payment-sticky-title{top:calc(var(--app-header-height) + 5.25rem)}');
  });
});

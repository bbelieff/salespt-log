/**
 * 발굴 PR-3 — 피커 재선택 병합 `mergePick` 계약. 두 불변식 동시 충족:
 *  R7(발굴 교체 시 A+B 혼합 금지) + §2.5(pick 이후 손입력 절대 보존).
 * mergeLeadDraft 자체(비파괴 fill-empty)는 tests/service/lead-prefill.test.ts 커버.
 */
import { describe, expect, it } from "vitest";
import type { DBLead } from "@/types";
import { mergePick, type PickMerged } from "../../app/(app)/contact/_lib/lead-pick";

const lead = (o: Partial<DBLead>): DBLead =>
  ({ 구분: "", 접수일: "", 대표자명: "", 업체명: "", 소개처: "", 연락처: "", 조건: "", ...o }) as DBLead;
const A = lead({ 업체명: "A상사", 대표자명: "김에이", 연락처: "010-1111", 소개처: "네이버" });
const B = lead({ 업체명: "B물산", 대표자명: "이비", 연락처: "010-2222", 소개처: "지인소개" });
const EMPTY: PickMerged = { 업체명: "", 예약비고: "", 업체정보: undefined };

/** NewItem.onPickLead 재현: origin = baseline ?? slot (첫 pick 시 slot 고정). */
function pick(baseline: PickMerged | null, slot: PickMerged, lastMerge: PickMerged | null, l: DBLead) {
  const origin = baseline ?? slot;
  const m = mergePick(origin, slot, lastMerge, l);
  return { m, baseline: baseline ?? origin };
}

describe("mergePick — 첫 pick 프리필", () => {
  it("빈 슬롯에서 A → A 값으로 채움", () => {
    const { m } = pick(null, EMPTY, null, A);
    expect(m.업체명).toBe("A상사");
    expect(m.업체정보?.대표자이름).toBe("김에이");
    expect(m.업체정보?.연락처통신사).toBe("010-1111");
  });
  it("사용자가 업체명 직접입력 후 A → 사용자 값 보존, 빈 필드만 A", () => {
    const typed: PickMerged = { 업체명: "내가친업체", 예약비고: "", 업체정보: undefined };
    const { m } = pick(null, typed, null, A);
    expect(m.업체명).toBe("내가친업체");
    expect(m.업체정보?.대표자이름).toBe("김에이");
  });
});

describe("R7 — 발굴 교체 시 A+B 혼합 없음", () => {
  it("A 선택 후 (편집 없이) B 선택 → 순수 B (A 잔재 0)", () => {
    const first = pick(null, EMPTY, null, A);
    const afterA: PickMerged = { 업체명: first.m.업체명, 예약비고: first.m.예약비고, 업체정보: first.m.업체정보 };
    const second = pick(first.baseline, afterA, first.m, B);
    expect(second.m.업체명).toBe("B물산"); // A상사 아님
    expect(second.m.업체정보?.대표자이름).toBe("이비"); // 김에이 아님
    expect(second.m.업체정보?.연락처통신사).toBe("010-2222");
    expect(second.m.업체정보?.커스텀?.업체?.["소개처"]).toBe("지인소개"); // 네이버 아님
  });
});

describe("§2.5 — pick 이후 손입력 보존 (리뷰 CONFIRMED 회귀 방지)", () => {
  it("A 선택 → 예약비고에 준비메모 추가 + 업체명 정정 → B 선택 시 손입력 유지", () => {
    const first = pick(null, EMPTY, null, A);
    // 사용자가 pick 후 문자열 두 개를 손으로 고침
    const edited: PickMerged = {
      업체명: "A상사 본점", // 정정
      예약비고: `${first.m.예약비고} · ★계약서 지참`, // 준비메모 추가
      업체정보: first.m.업체정보,
    };
    const second = pick(first.baseline, edited, first.m, B);
    expect(second.m.업체명).toBe("A상사 본점"); // 조용히 사라지지 않음
    expect(second.m.예약비고).toContain("★계약서 지참"); // 준비메모 보존
    // 업체정보(발굴 소유)는 새 발굴로 재도출 — A 잔재 없음
    expect(second.m.업체정보?.대표자이름).toBe("이비");
  });

  it("같은 발굴 재선택(A→A)해도 손입력 문자열 유지", () => {
    const first = pick(null, EMPTY, null, A);
    const edited: PickMerged = { 업체명: "A상사 2호점", 예약비고: first.m.예약비고, 업체정보: first.m.업체정보 };
    const second = pick(first.baseline, edited, first.m, A);
    expect(second.m.업체명).toBe("A상사 2호점"); // 되돌려지지 않음
  });

  it("첫 pick 이전 입력한 업체정보는 재선택에도 baseline 으로 보존", () => {
    const preTyped: PickMerged = {
      업체명: "", 예약비고: "",
      업체정보: { 대표자이름: "사전대표", 연락처통신사: "", 커스텀: { 업체: {}, 대표자: {} } } as never,
    };
    const first = pick(null, preTyped, null, A); // baseline = preTyped
    const afterA: PickMerged = { 업체명: first.m.업체명, 예약비고: first.m.예약비고, 업체정보: first.m.업체정보 };
    const second = pick(first.baseline, afterA, first.m, B);
    expect(second.m.업체정보?.대표자이름).toBe("사전대표"); // baseline 손입력 보존(B가 안 덮음)
  });
});

/**
 * 계약 카드 draft ↔ 서버 정본 동기화 판정 (hotfix 2026-07-21 — 저장 유실·팝업 루프).
 *
 * 🐛 재현 고정: PC 마스터-디테일이 같은 계약을 목록(selectable)·상세 2인스턴스로 렌더 →
 * 저장 성공 후 refetch 로 cp 가 갱신되면 **편집한 적 없는 인스턴스의 옛 draft** 가
 * "draft ≠ cp" 만으로 dirty 가 되어, 이탈 팝업의 "저장하고 이동" 이 그 옛 draft 를
 * 재저장해 방금 저장을 롤백했다. 아래 테스트가 그 조합을 전부 false 로 못박는다.
 *
 * 이 레포는 vitest environment:"node" 라 React 렌더 테스트가 불가 —
 * 그래서 판정 로직을 _lib/draft-sync 순수 함수로 분리하고 여기서 고정한다.
 */
import { describe, it, expect } from "vitest";
import { ContractPayment } from "@/types";
import {
  sameContract,
  shouldRebaseDraft,
  shouldRegisterDirty,
} from "@/app/(app)/payment/_lib/draft-sync";

/** 픽스처 — 전 필드 default 가 있어 parse 로 슬롯까지 채워진다(JSON 비교에 필수). */
const cpOf = (over: Partial<ContractPayment> = {}) =>
  ContractPayment.parse({
    row: 9,
    계약일: "2026-07-10",
    업체명: "가나상사",
    수임비: 3_000_000,
    ...over,
  });

/** 수납1 의 한 필드만 바꾼 계약 (사용자 편집 모사). */
const withSlot1 = (base: ContractPayment, patch: Partial<ContractPayment["수납1"]>) =>
  ContractPayment.parse({ ...base, 수납1: { ...base.수납1, ...patch } });

describe("sameContract — 값 동일성", () => {
  it("같은 내용이면 true (참조가 달라도)", () => {
    expect(sameContract(cpOf(), cpOf())).toBe(true);
  });
  it("한 필드라도 다르면 false", () => {
    expect(sameContract(cpOf(), cpOf({ 업체명: "다른상사" }))).toBe(false);
  });
});

describe("shouldRegisterDirty — 미저장 가드 등록 판정", () => {
  it("기준선: 편집 없음 + draft=cp → 등록 안 함", () => {
    const cp = cpOf();
    expect(
      shouldRegisterDirty({ selectable: false, touched: false, ciTouched: false, draft: cp, cp }),
    ).toBe(false);
  });

  it("🐛 회귀: 저장 직후 refetch 로 cp 가 앞서가도 — 편집한 적 없으면 dirty 아님", () => {
    // 옛 draft(마운트 시점) vs 새 cp(방금 저장된 값). 예전엔 여기서 true 가 나와 롤백을 일으켰다.
    const oldDraft = cpOf();
    const newCp = withSlot1(oldDraft, { 수납액: 500_000 });
    expect(
      shouldRegisterDirty({
        selectable: false, touched: false, ciTouched: false, draft: oldDraft, cp: newCp,
      }),
    ).toBe(false);
  });

  it("🐛 회귀: selectable(목록) 인스턴스는 cp 가 아무리 달라도 저장 주체가 아니다", () => {
    const oldDraft = cpOf();
    const newCp = withSlot1(oldDraft, { 수납액: 500_000 });
    expect(
      shouldRegisterDirty({
        selectable: true, touched: false, ciTouched: false, draft: oldDraft, cp: newCp,
      }),
    ).toBe(false);
    // 편집 의도가 있다고 가정해도(있을 수 없지만) 목록 인스턴스는 여전히 제외 — 이중 안전장치.
    expect(
      shouldRegisterDirty({
        selectable: true, touched: true, ciTouched: true, draft: oldDraft, cp: newCp,
      }),
    ).toBe(false);
  });

  it("실제 편집이면 dirty — 가드가 죽지 않았음", () => {
    const cp = cpOf();
    const draft = withSlot1(cp, { 수납액: 700_000 });
    expect(
      shouldRegisterDirty({ selectable: false, touched: true, ciTouched: false, draft, cp }),
    ).toBe(true);
  });

  it("편집했다가 원래 값으로 되돌리면 dirty 아님 (touched 여도 값이 같으면 저장할 게 없다)", () => {
    const cp = cpOf();
    expect(
      shouldRegisterDirty({ selectable: false, touched: true, ciTouched: false, draft: cpOf(), cp }),
    ).toBe(false);
  });

  it("업체정보(04·06)만 만져도 dirty — draft 는 그대로여도 저장할 게 있다", () => {
    const cp = cpOf();
    expect(
      shouldRegisterDirty({ selectable: false, touched: false, ciTouched: true, draft: cp, cp }),
    ).toBe(true);
  });

  it("외부 경로(계약정보 수정·해지)로 cp 만 바뀐 경우도 dirty 아님", () => {
    const draft = cpOf();
    const afterTermination = cpOf({ 해지일: "2026-07-20", 해지사유: "중도해지", 반환액: 100_000 });
    expect(
      shouldRegisterDirty({
        selectable: false, touched: false, ciTouched: false, draft, cp: afterTermination,
      }),
    ).toBe(false);
  });
});

describe("shouldRebaseDraft — cp 변경 시 draft 재기준 판정", () => {
  it("편집 중이 아니면 재기준 — stale draft 를 남기지 않는다", () => {
    expect(shouldRebaseDraft({ touched: false, ciTouched: false })).toBe(true);
  });
  it("draft 편집 중이면 재기준 금지 — 사용자 입력 보존", () => {
    expect(shouldRebaseDraft({ touched: true, ciTouched: false })).toBe(false);
  });
  it("업체정보 편집 중이어도 재기준 금지", () => {
    expect(shouldRebaseDraft({ touched: false, ciTouched: true })).toBe(false);
  });
});

describe("🐛 시나리오 — 보고된 롤백 루프가 재현되지 않는다", () => {
  it("편집→저장→refetch 왕복 후 두 인스턴스 모두 dirty=false (팝업 없음)", () => {
    const 저장전 = cpOf();
    const 편집값 = withSlot1(저장전, { 수납액: 500_000, 진행기관: "미소재단" });

    // 상세 인스턴스: 편집 후 저장 → touched 해제 + draft 는 편집값, cp 는 서버가 돌려준 같은 값
    const 상세 = shouldRegisterDirty({
      selectable: false, touched: false, ciTouched: false, draft: 편집값, cp: 편집값,
    });
    // 목록 인스턴스: draft 는 저장 전 옛값 그대로, cp 만 갱신됨 (예전 롤백의 진원지)
    const 목록 = shouldRegisterDirty({
      selectable: true, touched: false, ciTouched: false, draft: 저장전, cp: 편집값,
    });

    expect([상세, 목록]).toEqual([false, false]);
  });

  it("🐛 저장 실패 후에도 dirty 유지 — 가드가 풀리면 무경고 유실이다", () => {
    // saveAll 은 onSave 가 throw 하면 setTouched(false) 에 도달하지 않는다(ContractRow).
    // 즉 실패 후 상태 = touched:true + draft≠cp → 반드시 dirty 여야 팝업·beforeunload 가 산다.
    const cp = cpOf();
    const 미저장편집 = withSlot1(cp, { 승인금액: 2_000_000 });
    expect(
      shouldRegisterDirty({
        selectable: false, touched: true, ciTouched: false, draft: 미저장편집, cp,
      }),
    ).toBe(true);
    // 업체정보 POST 실패 시에도 ciTouched 가 유지되므로 dirty 여야 한다.
    expect(
      shouldRegisterDirty({
        selectable: false, touched: false, ciTouched: true, draft: cp, cp,
      }),
    ).toBe(true);
    // 그리고 재기준이 막혀 미저장 편집이 화면에서 지워지지 않는다.
    expect(shouldRebaseDraft({ touched: true, ciTouched: false })).toBe(false);
  });

  it("저장 in-flight 중 새 편집이 있으면 dirty 유지 — 최신 draft 가 보존된다", () => {
    // saveAll 은 editSeq 가 바뀌었을 때 touched 를 해제하지 않는다 → touched=true 로 남는 상황.
    const cp = cpOf();
    const 저장중_추가편집 = withSlot1(cp, { 메모: "저장 중 추가 입력" });
    expect(
      shouldRegisterDirty({
        selectable: false, touched: true, ciTouched: false, draft: 저장중_추가편집, cp,
      }),
    ).toBe(true);
    // 그리고 재기준도 금지되어야 옛 cp 가 새 입력을 덮지 않는다.
    expect(shouldRebaseDraft({ touched: true, ciTouched: false })).toBe(false);
  });
});

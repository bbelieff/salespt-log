/**
 * updateUserFields 미러 payload 회귀 (#541 계약 이월 flag 클로버 방지):
 *  이월 마이그레이션 flag(구분=AI·이월원본행id=AJ)는 DB 미러에서 제외 — arena-carryover 가
 *  갓 이월(구분='이월')로 마킹한 행에 원본 계약(구분='')을 F:AH 재복사할 때 jsonb 병합으로
 *  DB 의 구분='이월'을 클로버하던 버그 차단. 나머지 F:AH 편집값은 보존.
 */
import { describe, expect, it } from "vitest";
import { ContractPayment } from "@/types";
import { userFieldsMirrorPayload } from "@/repo/db/contracts-clear";

function cp(over: Partial<ContractPayment>): ContractPayment {
  return ContractPayment.parse({
    row: 9,
    계약일: "2026-07-10",
    업체명: "업체",
    수임비: 1000,
    ...over,
  });
}

describe("userFieldsMirrorPayload — 이월 flag 미러 제외 (#541 클로버 방지)", () => {
  it("구분·이월원본행id 제거 (jsonb 병합이 DB 이월 flag 보존)", () => {
    const p = userFieldsMirrorPayload(
      cp({ 구분: "이월", 이월원본행id: "02:5" }),
    );
    expect("구분" in p).toBe(false);
    expect("이월원본행id" in p).toBe(false);
  });

  it("🐛핵심: 빈 구분('')이어도 제거 — 클로버 원인값을 미러에 안 실음", () => {
    // arena-carryover 가 넘기는 원본 cp 는 구분='' → 미러에 실리면 DB 구분='이월'을 ''로 덮음.
    const p = userFieldsMirrorPayload(cp({ 구분: "" }));
    expect("구분" in p).toBe(false);
  });

  it("F:AH 편집값·기타 필드는 보존(계약일·수임비·수납·해지)", () => {
    const p = userFieldsMirrorPayload(
      cp({
        수임비: 5000,
        해지일: "2026-07-15",
        수납1: { 진행기관: "A", 진행률: "", 현황: "", 승인금액: 0, 수납액: 300, 수납일: "", 메모: "" },
      }),
    );
    expect(p.계약일).toBe("2026-07-10");
    expect(p.수임비).toBe(5000);
    expect(p.해지일).toBe("2026-07-15"); // 해지 flag 는 보존(writeTermination 이 정본이나 무해)
    expect((p.수납1 as { 수납액: number }).수납액).toBe(300);
  });

  it("원본 cp 는 mutate 하지 않음(새 객체 반환)", () => {
    const src = cp({ 구분: "이월" });
    userFieldsMirrorPayload(src);
    expect(src.구분).toBe("이월"); // 원본 보존
  });
});

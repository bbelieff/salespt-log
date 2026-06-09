import { describe, it, expect } from "vitest";
import { parseArenaRoster, participantMemo } from "@/service/arena-parse";

// 시즌1 실제 명단(붙여넣기 원문, *=회장 접두). 입금($)·인라인 콤마 케이스는 별도.
const ROSTER = `1기
*김지훈
김소라
김덕호
이재영
정진웅

2기
류서하(심나영)
김태현
김지운
장용준
권도현(설아름)
*오민석

3기
*이상언
김남형
김우빈
박종훈
김종근
김지훈
정유영(조성도)

4기
박준용
*손기학
고경희

5기
김효준
정보경
신민경
*강구수(이태평)

6기
김서준
이장현
김선주
조정욱
김미란
박준영
신다혜
*최정한
황정환`;

describe("parseArenaRoster — 시즌1 명단", () => {
  const r = parseArenaRoster(ROSTER, 1);

  it("시즌 fallback + 34명 파싱", () => {
    expect(r.season).toBe(1);
    expect(r.participants).toHaveLength(34);
    expect(r.errors).toHaveLength(0);
  });

  it("회장(*) 6명, 부부(괄호) 4쌍", () => {
    expect(r.participants.filter((p) => p.isPresident)).toHaveLength(6);
    expect(
      r.participants.filter((p) => /\(.+\)/.test(p.displayName)),
    ).toHaveLength(4);
  });

  it("부부 표시이름 보존 (두 이름)", () => {
    const ryu = r.participants.find((p) => p.displayName.startsWith("류서하"));
    expect(ryu?.displayName).toBe("류서하(심나영)");
    expect(ryu?.gisu).toBe(2);
  });

  it("동명이인 김지훈 — 1기/3기 분리", () => {
    const kims = r.participants.filter((p) => p.displayName === "김지훈");
    expect(kims).toHaveLength(2);
    expect(kims.map((k) => k.gisu).sort()).toEqual([1, 3]);
    // 1기 김지훈만 회장
    expect(kims.find((k) => k.gisu === 1)?.isPresident).toBe(true);
    expect(kims.find((k) => k.gisu === 3)?.isPresident).toBe(false);
  });

  it("회장+부부 동시 (강구수(이태평))", () => {
    const kang = r.participants.find((p) => p.displayName.startsWith("강구수"));
    expect(kang?.displayName).toBe("강구수(이태평)");
    expect(kang?.isPresident).toBe(true);
    expect(kang?.gisu).toBe(5);
  });
});

describe("parseArenaRoster — 마커·형식 변형", () => {
  it("인라인 콤마 + 접미 마커 + 시즌 A{n} 헤더", () => {
    const r = parseArenaRoster("A1 / 1기 김지훈*$, 김소라$", 9);
    expect(r.season).toBe(1); // 원문 A1 우선 (fallback 9 무시)
    expect(r.participants).toHaveLength(2);
    const [a, b] = r.participants;
    expect(a).toEqual({
      gisu: 1,
      displayName: "김지훈",
      isPresident: true,
      isDeposit: true,
    });
    expect(b).toEqual({
      gisu: 1,
      displayName: "김소라",
      isPresident: false,
      isDeposit: true,
    });
  });

  it("같은 기수 완전중복 dedupe, 동명이인 다른기수 보존", () => {
    const r = parseArenaRoster("1기\n김소라\n김소라\n2기\n김소라", 1);
    expect(r.participants).toHaveLength(2);
    expect(r.participants.map((p) => p.gisu)).toEqual([1, 2]);
  });

  it("기수 미지정 이름 → errors", () => {
    const r = parseArenaRoster("김믿음\n1기\n김소라", 1);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.participants).toHaveLength(1);
    expect(r.participants[0]!.displayName).toBe("김소라");
  });

  it("시즌 미상 (A 없음 + fallback 0) → season 0", () => {
    const r = parseArenaRoster("1기\n김소라", 0);
    expect(r.season).toBe(0);
  });
});

describe("participantMemo", () => {
  it("회장,입금 / 회장 / 입금 / 빈", () => {
    expect(participantMemo({ isPresident: true, isDeposit: true })).toBe("회장,입금");
    expect(participantMemo({ isPresident: true, isDeposit: false })).toBe("회장");
    expect(participantMemo({ isPresident: false, isDeposit: true })).toBe("입금");
    expect(participantMemo({ isPresident: false, isDeposit: false })).toBe("");
  });
});

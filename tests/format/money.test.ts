/**
 * 금액 포맷 유틸 (PR-1 공용 부품).
 * ★핵심 회귀: 콤마 입력 → **number 저장** → 콤마 표시 왕복.
 *   시트 쓰기가 USER_ENTERED 라 콤마 문자열이 새면 수식이 깨진다 — number 방출이 유일한 방벽.
 */
import { describe, it, expect } from "vitest";
import { formatMoney, formatMoneyInput, parseMoney } from "@/lib/format/money";

describe("formatMoney (표시용)", () => {
  it("천단위 콤마", () => {
    expect(formatMoney(1000000)).toBe("1,000,000");
    expect(formatMoney(1000)).toBe("1,000");
    expect(formatMoney(999)).toBe("999");
  });
  it("null/undefined/NaN → '0' (크래시 금지 — 기존 fmtMoney 는 null 에서 터졌음)", () => {
    expect(formatMoney(null)).toBe("0");
    expect(formatMoney(undefined)).toBe("0");
    expect(formatMoney(NaN)).toBe("0");
  });
  it("0 은 '0' (표시용) · 음수 허용(차감 표시)", () => {
    expect(formatMoney(0)).toBe("0");
    expect(formatMoney(-1000)).toBe("-1,000");
  });
  it("소수는 반올림", () => {
    expect(formatMoney(1000.6)).toBe("1,001");
  });
});

describe("formatMoneyInput (입력창용 — 0/빈값은 빈칸)", () => {
  it("0·null 은 빈 문자열(placeholder 노출)", () => {
    expect(formatMoneyInput(0)).toBe("");
    expect(formatMoneyInput(null)).toBe("");
    expect(formatMoneyInput(undefined)).toBe("");
  });
  it("값이 있으면 콤마", () => {
    expect(formatMoneyInput(1000000)).toBe("1,000,000");
  });
});

describe("parseMoney (입력 → 저장 number)", () => {
  it("★parseInt 함정 방어 — '1,000,000' 이 1 로 절단되면 안 된다", () => {
    // parseInt("1,000,000", 10) === 1  ← 조용한 절단(유한수라 가드도 통과)
    expect(parseMoney("1,000,000")).toBe(1000000);
    expect(parseMoney("1,000")).toBe(1000);
  });
  it("통화기호·공백·문자 섞여도 숫자만 추출", () => {
    expect(parseMoney("₩1,234,567")).toBe(1234567);
    expect(parseMoney(" 1 234 567 원 ")).toBe(1234567);
  });
  it("빈값·무효 → 0", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("abc")).toBe(0);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney(undefined)).toBe(0);
  });
  it("number 입력은 그대로(반올림)", () => {
    expect(parseMoney(1000)).toBe(1000);
    expect(parseMoney(1000.6)).toBe(1001);
  });
  it("항상 number 를 반환한다(시트로 콤마 문자열 유출 차단)", () => {
    expect(typeof parseMoney("1,000,000")).toBe("number");
  });
});

describe("★왕복 — 콤마 입력 → number 저장 → 콤마 표시", () => {
  it("사용자가 '1,000,000' 타이핑 → 저장 1000000(number) → 다시 '1,000,000'", () => {
    const typed = "1,000,000";
    const stored = parseMoney(typed); // ← 시트/DB 로 나가는 값
    expect(stored).toBe(1000000);
    expect(typeof stored).toBe("number");
    expect(formatMoney(stored)).toBe("1,000,000");
    expect(formatMoneyInput(stored)).toBe("1,000,000");
  });
  it("한 자리씩 타이핑해도 매 단계 number 로 수렴", () => {
    const steps = ["1", "12", "123", "1,234", "12,345"];
    const nums = steps.map(parseMoney);
    expect(nums).toEqual([1, 12, 123, 1234, 12345]);
    expect(nums.every((n) => typeof n === "number")).toBe(true);
  });
});

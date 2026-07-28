import { describe, expect, it } from "vitest";
import { isoDateFromDb } from "@/repo/db/expense-ledger";
import { allocateExpenseByDay } from "@/service/expense-ledger";

/**
 * 2026-07-28 P1 회귀 — "저장은 되는데 조회·계산에 안 잡힘".
 *
 * 근인: pg-types 가 date(OID 1082)를 **로컬 자정 Date 객체**로 주는데 매퍼가
 * `String(v).slice(0,10)` 이라 "Wed Jul 01" 이 됐고, 그 쓰레기 문자열이
 * allocateExpenseByDay 의 NaN 구멍(NaN 은 `<1` 도 `>3660` 도 false)을 통과해
 * **예외 없이 빈 배열** → 인식금액 0 → 목록·합계·대시보드에서 조용히 증발.
 *
 * 기존 테스트는 픽스처로 ISO 문자열을 직접 주입해 이 매퍼를 한 번도 실행하지 않았다
 * (= CI 초록 + 라이브 파손의 사각지대). 이 파일이 그 경계를 고정한다.
 */
describe("P1 회귀: pg date 매퍼", () => {
  it("pg 가 주는 로컬 자정 Date 를 그날 그대로 매핑한다(TZ 로 하루 밀리지 않음)", () => {
    // pg-types 가 date '2026-07-01' 을 파싱한 결과와 동일한 형태
    expect(isoDateFromDb(new Date(2026, 6, 1))).toBe("2026-07-01");
    expect(isoDateFromDb(new Date(2026, 0, 1))).toBe("2026-01-01"); // 연초 경계
    expect(isoDateFromDb(new Date(2026, 11, 31))).toBe("2026-12-31"); // 연말 경계
  });

  it("🔒 옛 구현(String(Date).slice(0,10))이 만들던 값은 이제 나오지 않는다", () => {
    const legacy = String(new Date(2026, 6, 1)).slice(0, 10);
    expect(legacy).toBe("Wed Jul 01"); // 파손 재현 — 이 값이 라이브를 죽였다
    expect(isoDateFromDb(new Date(2026, 6, 1))).not.toBe(legacy);
  });

  it("이미 ISO 문자열이면 그대로 통과한다(파서 설정이 바뀌어도 안전)", () => {
    expect(isoDateFromDb("2026-07-31")).toBe("2026-07-31");
    expect(isoDateFromDb("2026-07-31T00:00:00.000Z")).toBe("2026-07-31");
  });

  it("형식이 깨지면 조용히 넘기지 않고 throw 한다(§0 조용한 오류 금지)", () => {
    expect(() => isoDateFromDb("Wed Jul 01")).toThrow("expense_invalid_stored_date");
    expect(() => isoDateFromDb(null)).toThrow("expense_invalid_stored_date");
    expect(() => isoDateFromDb(undefined)).toThrow("expense_invalid_stored_date");
  });

  it("🔒 깨진 날짜가 들어오면 일할 배분도 빈 배열이 아니라 throw 한다(NaN 구멍 봉인)", () => {
    expect(() => allocateExpenseByDay(300_000, "Wed Jul 01", "Wed Jul 31")).toThrow("expense_invalid_period");
    // 정상 입력은 그대로 — 합계는 원금과 정확히 일치(반올림 손실 0)
    const days = allocateExpenseByDay(300_000, "2026-07-01", "2026-07-31");
    expect(days).toHaveLength(31);
    expect(days.reduce((s, d) => s + d.amountWon, 0)).toBe(300_000);
  });
});

/**
 * registry append 결정적 좌표 가드 (claim-append-columns 2026-06-14).
 * values.append 의 table-detection 이 빈 A열 prep 행 때문에 새 self-claim 행을
 * H/I열~로 밀어 기록 → findUserByEmail(A열 조회) 실패 → 로그인 무한반송 사고.
 * 수정: 마지막 데이터행 + 1 의 결정적 좌표(`A{n}`)로 update. 이 좌표 계산을 박제.
 */
import { describe, it, expect } from "vitest";
import { nextRegistryRowNumber } from "@/repo/users-claim";

describe("nextRegistryRowNumber (결정적 append 좌표)", () => {
  it("데이터행 수 → header(1행) 다음 빈 행 번호", () => {
    expect(nextRegistryRowNumber(0)).toBe(2); // 빈 시트 → A2
    expect(nextRegistryRowNumber(1)).toBe(3);
    expect(nextRegistryRowNumber(67)).toBe(69);
    expect(nextRegistryRowNumber(129)).toBe(131);
  });
  it("항상 A열 기준(컬럼 밀림 없음) — 행번호는 양의 정수", () => {
    for (const n of [0, 5, 100]) {
      expect(nextRegistryRowNumber(n)).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(nextRegistryRowNumber(n))).toBe(true);
    }
  });
});

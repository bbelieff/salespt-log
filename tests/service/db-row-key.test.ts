/**
 * DB생산 RowCard React key 채널 스코프 회귀 (BBE-79, 2026-08-06).
 * 핵심: 서로 다른 채널이 같은 row 번호를 가져도(흔한 조합 — lib/repo/db.ts 의 4채널이 같은
 * firstDataRow 축 공유) key 가 달라야 한다. 같으면 채널 전환 시 React 가 이전 채널의
 * RowCard/RowForm 인스턴스를 재사용해 stale draft 가 새 채널에 남는다(#596 재검증 발굴).
 */
import { describe, expect, it } from "vitest";
import { dbRowKey } from "../../app/(app)/db/_lib/channels";

describe("dbRowKey — 채널간 행번호 충돌 방지", () => {
  it("같은 row 번호라도 채널이 다르면 key 가 다르다", () => {
    expect(dbRowKey("purchase", 4)).not.toBe(dbRowKey("direct", 4));
    expect(dbRowKey("purchase", 4)).not.toBe(dbRowKey("banner", 4));
    expect(dbRowKey("purchase", 4)).not.toBe(dbRowKey("referral", 4));
  });

  it("같은 채널·같은 row 번호는 key 가 같다(정상 케이스 — 안정된 리액트 identity 유지)", () => {
    expect(dbRowKey("purchase", 4)).toBe(dbRowKey("purchase", 4));
  });

  it("같은 채널·다른 row 번호는 key 가 다르다", () => {
    expect(dbRowKey("purchase", 4)).not.toBe(dbRowKey("purchase", 5));
  });
});

/**
 * 🐛회귀 — 03 DB관리 백필 열문자 폼 shadowing (lead-chain §4-2 R12).
 *
 * DB upsert 는 jsonb **얕은 병합**이라 백필된 행(열문자 키 X..AD)을 앱이 수정해도 옛 열문자가 남는다.
 * 예전 `readDbTabFromDb` 는 열문자 폼을 **무조건 우선**해 배열 파서로 읽었으므로,
 * **앱이 쓴 필드명 값이 영영 화면에 안 보였다**(파일럿에서 03 을 고쳐도 옛 값 표시 = 라이브 stale 버그).
 * 또한 필드명 전용 키(예: 발굴id)가 배열 파서에서 통째로 **버려졌다** → 발굴 체인 링크 불가.
 *
 * 수리: 열문자 base + **필드명 overlay**(필드명이 항상 이김). 배열 파서는 열문자에만 재실행(neo 밀림 회피).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@/repo/db/client", () => ({
  dbEnabled: () => true,
  ensureSchema: vi.fn(async () => {}),
  getDbPool: () => ({ query: (...a: unknown[]) => query(...(a as [])) }),
}));

import { readDbTabFromDb } from "@/repo/db/read-db-tab";

/** 콜지기소 절대 시작열 = X(23). 백필 열문자 payload 재현. */
const LEAD_COLS = ["구분", "접수일", "대표자명", "업체명", "소개처", "연락처", "조건"];
function leadColumnForm(cells: string[]): Record<string, unknown> {
  const colName = (i: number) =>
    i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
  const o: Record<string, unknown> = { _backfill: true };
  cells.forEach((v, i) => {
    if (v !== "") o[colName(23 + i)] = v;
  });
  return o;
}
const rows = (payload: Record<string, unknown>) => ({
  rows: [{ row_key: "콜지기소:r5", payload }],
});

beforeEach(() => query.mockReset());

describe("readDbTabFromDb — 열문자/필드명 폼 우선순위", () => {
  it("순수 백필(열문자만) → 그대로 읽힌다(회귀 없음)", async () => {
    query.mockResolvedValue(
      rows(leadColumnForm(["지인", "2026-07-01", "김대표", "옛상사", "", "010-1111-2222", ""])),
    );
    const { leads } = await readDbTabFromDb("sheet-1");
    expect(leads[0]).toMatchObject({ 업체명: "옛상사", 대표자명: "김대표", row: 5 });
  });

  it("순수 앱 폼(필드명만) → 그대로 읽힌다(회귀 없음)", async () => {
    query.mockResolvedValue(
      rows({ 구분: "소개", 접수일: "2026-07-02", 대표자명: "박대표", 업체명: "새상사", 소개처: "", 연락처: "", 조건: "" }),
    );
    const { leads } = await readDbTabFromDb("sheet-1");
    expect(leads[0]).toMatchObject({ 업체명: "새상사", 대표자명: "박대표" });
  });

  it("🐛혼합(백필 열문자 + 앱이 수정한 필드명) → **앱이 쓴 필드명이 이긴다**(stale 표시 차단)", async () => {
    // 백필된 행을 앱에서 업체명만 고친 상태 — 얕은 병합이라 옛 X..AD 가 그대로 남아 있다.
    const payload = {
      ...leadColumnForm(["지인", "2026-07-01", "김대표", "옛상사", "", "010-1111-2222", ""]),
      // 앱이 쓴 필드명 키(정본)
      구분: "지인",
      접수일: "2026-07-01",
      대표자명: "김대표",
      업체명: "고친상사",
      소개처: "",
      연락처: "010-1111-2222",
      조건: "",
    };
    query.mockResolvedValue(rows(payload));
    const { leads } = await readDbTabFromDb("sheet-1");
    // 수리 전: 열문자 우선 → "옛상사"(사용자가 고친 값이 영영 안 보임)
    expect(leads[0]!.업체명).toBe("고친상사");
  });

  it("overlay 는 덮어쓴 필드만 이기고, 나머지 열문자 base 는 유지된다", async () => {
    // ※ 필드명 **전용** 키(예: 발굴id)의 실제 생존은 이 PR 로는 성립하지 않는다 —
    //    merged() 가 Zod.safeParse 로 끝나고 z.object 는 미지 키를 strip 하기 때문.
    //    이 PR 이 여는 건 "필드명 전용 키가 **열문자 base 를 뚫고 overlay 경로를 탄다**"는 필요조건이고,
    //    실제 생존은 PR-5 에서 DBLead 에 발굴id 를 추가하는 순간 성립한다(그때 진짜 assert 를 넣는다).
    const payload = {
      ...leadColumnForm(["지인", "2026-07-01", "김대표", "옛상사", "", "", ""]),
      업체명: "고친상사",
    } as Record<string, unknown>;
    query.mockResolvedValue(rows(payload));
    const { leads } = await readDbTabFromDb("sheet-1");
    expect(leads[0]!.업체명).toBe("고친상사"); // overlay 승
    expect(leads[0]!.대표자명).toBe("김대표"); // base 유지
  });

  it("🐛blocker회귀 — Zod refinement 를 깨는 백필 행도 **사라지지 않는다**(렌더 보증 보존)", async () => {
    // 근인: 예전 열문자 분기는 Zod 를 안 거치고 그대로 렌더했다. overlay 도입 시 safeParse 를 태우면
    // 백필 raw 값이 refinement 를 깨는 순간(int·nonneg) 행이 **조용히 사라진다** — 03 화면·대시보드 집계 양쪽에서.
    // 실제 트리거: 기간예산은 부가세 제외(=금액/1.1)라 3300000/1.1 = 2999999.9999999995 (소수).
    // 종료일이 빈 "생산중" 행은 legacy 분기가 생산개수←기간예산으로 매핑 → int 위반.
    const colName = (i: number) =>
      i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
    // 직접생산 절대 시작열 = I(8). 종료일(J) 비움 = 생산중.
    const prod: Record<string, unknown> = { _backfill: true };
    [["I", "2026-07-03"], ["K", "전단지"], ["L", "2999999.9999999995"], ["M", "300"]].forEach(
      ([c, v]) => (prod[c as string] = v),
    );
    query.mockResolvedValue({ rows: [{ row_key: "직접생산:r7", payload: prod }] });
    const { productions } = await readDbTabFromDb("sheet-1");
    expect(productions).toHaveLength(1); // 수리 전: [] (행 소실)
    expect(productions[0]!.row).toBe(7);

    // 매입DB — 소수 주문개수(2.5)·음수 개당단가(환불) 도 동일하게 렌더 유지.
    const buy: Record<string, unknown> = { _backfill: true };
    [["B", "2026-07-01"], ["C", "가나DB"], ["D", "10000"], ["E", "2.5"]].forEach(
      ([c, v]) => (buy[c as string] = v),
    );
    void colName;
    query.mockResolvedValue({ rows: [{ row_key: "매입DB:r5", payload: buy }] });
    const { purchases } = await readDbTabFromDb("sheet-1");
    expect(purchases).toHaveLength(1); // 수리 전: [] (행 소실)
    expect(purchases[0]!.주문개수).toBe(2.5);
  });

  it("합계행은 여전히 skip", async () => {
    query.mockResolvedValue(rows(leadColumnForm(["합계", "", "", "", "", "", ""])));
    const { leads } = await readDbTabFromDb("sheet-1");
    expect(leads).toHaveLength(0);
  });

  it("필드명 키 추출은 열문자·내부키를 제외한다(_cleared·_backfill 이 값으로 새지 않음)", async () => {
    query.mockResolvedValue(
      rows({ ...leadColumnForm(["지인", "2026-07-01", "김대표", "가나상사", "", "", ""]) }),
    );
    const { leads } = await readDbTabFromDb("sheet-1");
    expect(leads[0]).not.toHaveProperty("_backfill");
    expect(LEAD_COLS.every((k) => k in leads[0]!)).toBe(true);
  });
});

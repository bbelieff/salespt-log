/**
 * BBE-53 — appendFromContract 자연키 upsert 회귀.
 * 실제 시트 상태를 흉내내는 in-memory 스토어로 sheetsClient 를 스텁해, "같은 요청을 몇 번
 * 재시도해도 02 행이 하나"라는 수용 기준을 실제 find→write→find 왕복으로 검증한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SHEET = "sheet-1";
const TAB = "02 계약수납관리";
const FIRST_ROW = 6;

// row → 컬럼(C..AK, 문자 그대로) 값. 실제 시트처럼 "아직 안 쓴 행"은 store 에 없음(=빈 값).
let store: Map<number, Record<string, string | number>>;
let nextRow: number; // findFirstEmptyRow 대체 — store 에 없는 첫 행

function reset() {
  store = new Map();
  nextRow = FIRST_ROW;
}

const batchUpdate = vi.fn(async ({ requestBody }: { requestBody: { data: { range: string; values: unknown[][] }[] } }) => {
  for (const { range, values } of requestBody.data) {
    // range 형태: "'02 계약수납관리'!C{row}:E{row}" | "...!AK{row}" | "...!AI{row}:AJ{row}"
    const m = range.match(/!([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/);
    if (!m) throw new Error(`unexpected range: ${range}`);
    const [, col1, rowStr, col2] = m;
    const row = Number(rowStr);
    const cols = col2 ? colsBetween(col1!, col2) : [col1!];
    const rowObj = store.get(row) ?? {};
    const vals = values[0] ?? [];
    cols.forEach((c, i) => {
      const v = vals[i];
      if (v === undefined) return;
      rowObj[c] = typeof v === "string" ? v.replace(/^'/, "") : (v as number);
    });
    store.set(row, rowObj);
    if (row >= nextRow) nextRow = row + 1;
  }
  return { data: {} };
});

function colsBetween(a: string, b: string): string[] {
  const KNOWN = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK"];
  const i = KNOWN.indexOf(a);
  const j = KNOWN.indexOf(b);
  return KNOWN.slice(i, j + 1);
}

async function baseValuesGet({ range }: { range: string }) {
  // findFirstEmptyRow: "...!C{firstDataRow}:C" — 열 하나, 끝행 없음.
  const singleCol = range.match(/!([A-Z]+)(\d+):\1$/);
  if (singleCol) {
    const [, col, startRow] = singleCol;
    const start = Number(startRow);
    const rows: unknown[][] = [];
    for (let r = start; r < nextRow; r++) rows.push([store.get(r)?.[col!] ?? ""]);
    return { data: { values: rows } };
  }
  // findRowByLink: "...!C{firstDataRow}:AK" — C..AK 전체, 끝행 없음.
  const wideRange = range.match(/!([A-Z]+)(\d+):([A-Z]+)$/);
  if (wideRange) {
    const [, col1, startRow, col2] = wideRange;
    const start = Number(startRow);
    const cols = colsBetween(col1!, col2!);
    const rows: unknown[][] = [];
    for (let r = start; r < nextRow; r++) {
      const rowObj = store.get(r) ?? {};
      rows.push(cols.map((c) => rowObj[c] ?? ""));
    }
    return { data: { values: rows } };
  }
  throw new Error(`unexpected range: ${range}`);
}
const valuesGet = vi.fn(baseValuesGet);

vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: TAB } }] } }),
      values: { get: valuesGet, batchUpdate },
    },
  }),
  ensureGridColumns: vi.fn(async () => {}),
}));
vi.mock("@/repo/db/contracts-clear", () => ({
  persistContractRow: vi.fn(async () => {}),
  clearContractRowInDbSync: vi.fn(async () => {}),
  userFieldsMirrorPayload: vi.fn(() => ({})),
}));
vi.mock("@/repo/db/mirror", () => ({
  mirrorClearRow: vi.fn(),
}));

import { appendFromContract } from "@/repo/contract-payment";

beforeEach(() => {
  reset();
  batchUpdate.mockClear();
  valuesGet.mockReset().mockImplementation(baseValuesGet); // 레이스 테스트가 override 해도 다음 테스트는 원상복구
});

describe("appendFromContract — meetingId 자연키 upsert (BBE-53 수용기준 1: 재시도 시 중복 0건)", () => {
  it("같은 meetingId 로 3회 연속 저장해도 02 행은 1개 — 매출 이중계상 없음", async () => {
    const data = { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000, meetingId: "m-1" };
    const r1 = await appendFromContract(SHEET, data);
    const r2 = await appendFromContract(SHEET, data); // 재시도 1(응답 유실 흉내)
    const r3 = await appendFromContract(SHEET, data); // 재시도 2
    expect(r1.row).toBe(r2.row);
    expect(r2.row).toBe(r3.row);
    expect(store.size).toBe(1);
    expect(store.get(r1.row)?.AK).toBe("m-1");
  });

  it("다른 meetingId 는 다른 행 — 정상 계약은 서로 안 합쳐짐", async () => {
    const r1 = await appendFromContract(SHEET, { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000, meetingId: "m-1" });
    const r2 = await appendFromContract(SHEET, { 계약일: "2026-07-11", 업체명: "다른상사", 수임비: 500_000, meetingId: "m-2" });
    expect(r1.row).not.toBe(r2.row);
    expect(store.size).toBe(2);
  });

  it("재시도 시 최신 수임비로 값이 갱신된다(같은 행 update)", async () => {
    const base = { 계약일: "2026-07-10", 업체명: "가나상사", meetingId: "m-1" };
    const r1 = await appendFromContract(SHEET, { ...base, 수임비: 1_000_000 });
    await appendFromContract(SHEET, { ...base, 수임비: 1_200_000 }); // 사용자가 재시도 전 금액 수정
    expect(store.get(r1.row)?.E).toBe(1_200_000);
    expect(store.size).toBe(1);
  });

  it("meetingId 없고 dateCompanyFallback=false(기본) — 기존처럼 매번 새 행(addPriorContract 경로 불변 보장)", async () => {
    const data = { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000 };
    const r1 = await appendFromContract(SHEET, data);
    const r2 = await appendFromContract(SHEET, data);
    expect(r1.row).not.toBe(r2.row); // 회귀 아님 — 이 경로의 멱등은 서비스 레이어(addPriorContract)가 별도 담당
    expect(store.size).toBe(2);
  });

  it("meetingId 없어도 dateCompanyFallback=true 면 (계약일+업체명) 로 기존 행을 찾는다(addFromContract 폴백)", async () => {
    const data = { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000 };
    const r1 = await appendFromContract(SHEET, data, undefined, undefined, true);
    const r2 = await appendFromContract(SHEET, { ...data, 수임비: 1_100_000 }, undefined, undefined, true);
    expect(r1.row).toBe(r2.row);
    expect(store.size).toBe(1);
    expect(store.get(r1.row)?.E).toBe(1_100_000);
  });

  it("arena-carryover 호출 형태(meetingId 없음·dateCompanyFallback 안 넘김)는 기존처럼 매번 새 행 — 동작 무변경(수용기준 4)", async () => {
    // arena-carryover.ts 실제 호출 형태 그대로: data={계약일,업체명,수임비}, carryover={원본행id}, opts, fallback 없음.
    const data = { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000 };
    const r1 = await appendFromContract(SHEET, data, { 원본행id: "02:5" }, { syncDb: true });
    const r2 = await appendFromContract(SHEET, data, { 원본행id: "02:6" }, { syncDb: true });
    expect(r1.row).not.toBe(r2.row);
    expect(store.size).toBe(2);
  });
});

describe("appendFromContract — 동시 2요청 (BBE-53 수용기준 5: 남는 경쟁조건 명시)", () => {
  it("⚠️ 두 요청이 서로의 쓰기를 보기 전에 자연키 조회를 동시에 통과한다 — 원자적 예약이 없어 생기는 잔여 위험(설계문서 §1)", async () => {
    // 시트에 행 잠금이 없어(구글시트 API 특성), findRowByLink 조회와 그 뒤의 findFirstEmptyRow+쓰기
    // 사이에 진짜 네트워크 지연이 끼면 두 요청 모두 "기존 행 없음"을 보고 통과할 수 있다.
    // 이 목업은 그 근본 원인(자연키 조회 자체가 상대의 쓰기를 못 보고 통과하는 것)을 결정적으로
    // 재현한다 — 그 뒤 실제로 같은 행에 덮어써지는지 서로 다른 행 2개가 생기는지는 그 다음
    // findFirstEmptyRow 호출의 상대적 타이밍에 달려 있어(레이스 그 자체이므로) 이 하네스로
    // 특정 결과 하나를 단정하지 않는다 — **결정적으로 보장 못 한다는 사실 자체가 수용기준 5의
    // "남는 위험"** 이다. 완전 차단은 못 하지만(행 잠금 불가), 순차 재시도(같은 사람이 응답을
    // 못 받아 다시 누르는 압도적으로 흔한 경우)는 위 수용기준 1~4 로 안전하다.
    let arrived = 0;
    let releaseBoth: () => void;
    const gate = new Promise<void>((res) => { releaseBoth = res; });
    const seenNotFound: boolean[] = [];
    valuesGet.mockImplementation(async (args: { range: string }) => {
      if (args.range.includes(":AK")) {
        arrived++;
        if (arrived >= 2) releaseBoth();
        await gate; // 두 요청이 서로 상대의 쓰기를 못 본 채로 자연키 조회를 함께 통과
      }
      const res = await baseValuesGet(args);
      if (args.range.includes(":AK")) seenNotFound.push(res.data.values.length === 0);
      return res;
    });

    const data = { 계약일: "2026-07-10", 업체명: "가나상사", 수임비: 1_000_000, meetingId: "m-race" };
    await Promise.all([appendFromContract(SHEET, data), appendFromContract(SHEET, data)]);

    // 근본 원인 재현 확인: 둘 다 "기존 행 없음"을 봤다(=순차였다면 둘째는 첫째 행을 찾아 update 로
    // 수렴했을 텐데, 그 수렴 경로를 못 탔다는 뜻).
    expect(seenNotFound).toEqual([true, true]);
    // 최소 1행은 반드시 만들어졌다(요청 자체는 항상 성공) — 중복이든 덮어쓰기든 완전 소실은 아님.
    expect(store.size).toBeGreaterThanOrEqual(1);
  });
});

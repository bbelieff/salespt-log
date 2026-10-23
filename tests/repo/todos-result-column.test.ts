/**
 * 05 실무투두 R 컬럼(결과) — 읽기·쓰기·지우기 범위와 옛 데이터 호환.
 * 패턴: slot(Q, PR #1196)과 같은 분리 write(P:R). O(캘린더 ID)는 건드리지 않는다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const valuesGet = vi.fn();
const valuesUpdate = vi.fn();
const valuesBatchUpdate = vi.fn(async () => ({}));
const spreadsheetsGet = vi.fn(async () => ({ data: { sheets: [{ properties: { title: "05 실무투두" } }] } }));
const ensureGridColumns = vi.fn(async () => {});

vi.mock("@/repo/db/mirror", () => ({ mirrorSheetRow: vi.fn(), mirrorClearRow: vi.fn() }));
vi.mock("@/repo/sheets-client", () => ({
  sheetsClient: () => ({
    spreadsheets: {
      get: (...a: unknown[]) => spreadsheetsGet(...(a as [])),
      batchUpdate: vi.fn(),
      values: {
        get: (...a: unknown[]) => valuesGet(...a),
        update: (...a: unknown[]) => valuesUpdate(...a),
        batchUpdate: (...a: unknown[]) => valuesBatchUpdate(...(a as [])),
      },
    },
  }),
  ensureGridColumns: (...a: unknown[]) => ensureGridColumns(...(a as [])),
}));

import { appendTodo, clearTodo, ensureTodoTab, rowToTodo, updateTodo } from "@/repo/todos";
import { todoFromDbPayload } from "@/repo/db/read-daily";
import { Todo } from "@/types";

const row = (extra: unknown[] = []) => ["t1", "2026-07-10|가나상사", "미소재단", "가나상사", "기타", "재무제표 요청", "2026-10-22", "09:00", "", "", true, true, "2026-10-21T00:00:00Z", "", "", "todo", 1, ...extra];

beforeEach(() => {
  for (const m of [valuesGet, valuesUpdate, valuesBatchUpdate, ensureGridColumns]) m.mockClear();
  valuesGet.mockImplementation(async ({ range }: { range: string }) => {
    if (/!A2:A$/.test(range)) return { data: { values: [["t1"]] } };
    if (/!A2:S$/.test(range) || /!A2:S2$/.test(range)) return { data: { values: [row(["메일로 받음"])] } };
    return { data: { values: [["헤더"]] } };
  });
});

describe("R 컬럼(결과) · S 컬럼(이전 기록 id)", () => {
  it("S 컬럼: prevId 읽기·쓰기, 옛 행·옛 데이터는 빈값", async () => {
    expect(rowToTodo(row(["", "src-1"]))?.prevId).toBe("src-1");
    expect(rowToTodo(row())?.prevId).toBe("");
    expect(Todo.parse({ id: "x", contractRef: "c", 제목: "할 일", 예정일자: "2026-10-22" }).prevId).toBe("");
    await appendTodo("sheet-p", Todo.parse({ id: "t3", contractRef: "c", 제목: "다음 일", 예정일자: "2026-10-24", prevId: "src-1" }), { mirror: false });
    const data = (valuesBatchUpdate.mock.calls.at(-1) as unknown as [{ requestBody: { data: { range: string; values: unknown[][] }[] } }])[0].requestBody.data;
    expect(data[1]!.values).toEqual([["todo", "", "", "'src-1"]]);
  });
  it("rowToTodo: R 값을 result 로, R 없는 옛 행은 빈값", () => {
    expect(rowToTodo(row(["메일로 받음"]))?.result).toBe("메일로 받음");
    expect(rowToTodo(row())?.result).toBe("");
  });
  it("Todo 타입: result 없거나 null 인 옛 데이터도 빈값으로 읽힌다", () => {
    const old = { id: "x", contractRef: "c", 제목: "할 일", 예정일자: "2026-10-22" };
    expect(Todo.parse(old).result).toBe("");
    expect(Todo.parse({ ...old, result: null }).result).toBe("");
    expect(Todo.parse({ ...old, result: "끝" }).result).toBe("끝");
  });
  it("DB payload: 직접 형식·열문자(R) 형식 모두 복원", () => {
    expect(todoFromDbPayload({ id: "x", contractRef: "c", 제목: "할 일", 예정일자: "2026-10-22", result: "끝" })?.result).toBe("끝");
    const letters: Record<string, unknown> = {}; row(["열문자 결과"]).forEach((v, i) => { letters[String.fromCharCode(65 + i)] = v; });
    expect(todoFromDbPayload(letters)?.result).toBe("열문자 결과");
  });
  it("탭 보장: 19열(S) 확보 + R1 헤더 「결과」는 비었을 때만", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => ({ data: { values: range.endsWith("!R1") ? [] : [["있음"]] } }));
    await ensureTodoTab("sheet-hdr");
    expect(ensureGridColumns).toHaveBeenCalledWith("sheet-hdr", "05 실무투두", 19);
    expect(valuesUpdate).toHaveBeenCalledWith(expect.objectContaining({ range: "'05 실무투두'!R1", requestBody: { values: [["결과"]] } }));
    expect(valuesUpdate).toHaveBeenCalledTimes(1);
  });
  it("append·update 는 A:N + P:S 만 쓰고(O 비접촉) 결과는 텍스트로 저장", async () => {
    valuesGet.mockImplementation(async ({ range }: { range: string }) => (/!A2:A$/.test(range) ? { data: { values: [["t1"]] } } : /!A2:S2$/.test(range) ? { data: { values: [row()] } } : { data: { values: [["헤더"]] } }));
    await appendTodo("sheet-w", Todo.parse({ id: "t2", contractRef: "c", 제목: "새 일", 예정일자: "2026-10-24", result: "" }), { mirror: false });
    let data = (valuesBatchUpdate.mock.calls.at(-1) as unknown as [{ requestBody: { data: { range: string; values: unknown[][] }[] } }])[0].requestBody.data;
    expect(data.map((d) => d.range)).toEqual(["'05 실무투두'!A3:N3", "'05 실무투두'!P3:S3"]);
    expect(data[1]!.values).toEqual([["todo", "", "", ""]]);
    await updateTodo("sheet-w", "t1", { result: "다음 주 재요청" }, { mirror: false });
    data = (valuesBatchUpdate.mock.calls.at(-1) as unknown as [{ requestBody: { data: { range: string; values: unknown[][] }[] } }])[0].requestBody.data;
    expect(data[1]!).toEqual({ range: "'05 실무투두'!P2:S2", values: [["todo", 1, "'다음 주 재요청", ""]] });
  });
  it("update 에 result 가 없으면 기존 R 값을 그대로 다시 쓴다(보존)", async () => {
    await updateTodo("sheet-k", "t1", { 완료여부: false }, { mirror: false });
    const data = (valuesBatchUpdate.mock.calls.at(-1) as unknown as [{ requestBody: { data: { range: string; values: unknown[][] }[] } }])[0].requestBody.data;
    expect(data[1]!.values).toEqual([["todo", 1, "'메일로 받음", ""]]);
  });
  it("clear 는 P:S 를 비운다", async () => {
    await clearTodo("sheet-c", "t1", { mirror: false });
    const data = (valuesBatchUpdate.mock.calls.at(-1) as unknown as [{ requestBody: { data: { range: string; values: unknown[][] }[] } }])[0].requestBody.data;
    expect(data[1]!).toEqual({ range: "'05 실무투두'!P2:S2", values: [["", "", "", ""]] });
  });
});

/**
 * 구조 개선 ⑪ — DB관리시트 저장 엔진을 화면 없이 시험. 가짜 전송·가짜 타이머, 합성값.
 */
import { describe, expect, it, vi } from "vitest";
import { DbSheetLeadInput, type DbSheetLead } from "@/types/db-sheet";
import { createDbSheetStore } from "@/app/(app)/db-sheet/_components/db-sheet-store";

const ID = "3f2b6c1e-8d4a-4b7e-9c2d-1a2b3c4d5e6f";
const base = (over: Partial<DbSheetLead> = {}): DbSheetLead => ({
  ...DbSheetLeadInput.parse({ id: ID, supplier: "가상공급처", date: "2026-10-19", channel: "매입DB", company: "예시상사", owner: "가상", phone: "010-0000-0001" }),
  revision: 1, result: "미컨택", first: "", stage: "미컨택", meetingId: null, ...over,
});

function setup(transport: (body?: unknown) => Promise<{ leads: DbSheetLead[]; suppliers?: string[]; impact?: never }>) {
  const timers: Array<() => void> = [];
  const invalidate = vi.fn(async () => {});
  const store = createDbSheetStore({
    transport: transport as never, invalidate, today: () => "2026-10-19", contactDraft: () => ({}) as never,
    setTimer: (fn) => { timers.push(fn); return timers.length as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: (t) => { timers[(t as unknown as number) - 1] = () => {}; },
  });
  const fire = () => { const all = timers.splice(0); all.forEach((f) => f()); };
  return { store, fire, invalidate };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("db-sheet-store", () => {
  it("처음 불러오면 목록·공급처가 채워진다", async () => {
    const { store } = setup(async () => ({ leads: [base()] }));
    store.load(); await settle();
    expect(store.getState()).toMatchObject({ loading: false, suppliers: ["가상공급처"] });
    expect(store.getState().leads).toHaveLength(1);
  });

  it("0.5초 안의 여러 수정은 한 번만 저장한다", async () => {
    const calls: unknown[] = [];
    const { store, fire, invalidate } = setup(async (body) => { calls.push(body); return { leads: [base({ revision: calls.length })] }; });
    store.load(); await settle(); calls.length = 0;
    store.edit(ID, "owner", "가"); store.edit(ID, "owner", "가나");
    expect(store.getState().pending).toBe(1);
    fire(); await settle(); await settle();
    expect(calls).toHaveLength(1);
    expect((calls[0] as { lead: { owner: string } }).lead.owner).toBe("가나");
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(store.getState().pending).toBe(0);
  });

  it("저장 응답이 오는 사이 더 고친 칸은 화면 값을 지킨다", async () => {
    let release!: () => void;
    const { store, fire } = setup(async (body) => {
      if (!body) return { leads: [base()] };
      await new Promise<void>((r) => { release = r; });
      return { leads: [base({ owner: "서버값", revision: 2, stage: "상담 중" })] };
    });
    store.load(); await settle();
    store.edit(ID, "owner", "첫수정"); fire(); await settle();
    store.edit(ID, "owner", "두번째");
    release(); await settle(); await settle();
    const row = store.getState().leads[0]!;
    expect(row.owner).toBe("두번째");     // 화면 값 유지
    expect(row.revision).toBe(2);          // 서버 결과 칸은 반영
    expect(row.stage).toBe("상담 중");
  });

  it("저장이 실패하면 이후 저장을 막고 오류를 보인다", async () => {
    const { store, fire } = setup(async (body) => { if (body) throw new Error("서버 오류"); return { leads: [base()] }; });
    store.load(); await settle();
    store.edit(ID, "owner", "가"); fire(); await settle(); await settle();
    expect(store.getState().error).toBe("서버 오류");
    await expect(store.flush(ID)).rejects.toThrow("저장 오류를 먼저 확인해 주세요.");
  });

  it("미리보기와 다른 기록 설정은 확정하지 않는다", async () => {
    const { store } = setup(async (body) => {
      const b = body as { action?: string } | undefined;
      if (b?.action === "recording-preview") return { leads: [], impact: { inflow: 0, contacts: 0, meetings: 0, rows: [] } as never };
      return { leads: [base()] };
    });
    store.load(); await settle();
    await store.recordingPreview(ID, { inflow: true, activities: true });
    await expect(store.configure(ID, { inflow: false, activities: true })).rejects.toThrow("기록이 바뀌었어요");
    expect(store.getState().error).toBe(""); // 복구 가능한 작업이라 전체를 막지 않는다
  });

  it("되돌리기는 저장 대기를 버리고 서버 값으로", async () => {
    const { store } = setup(async () => ({ leads: [base()] }));
    store.load(); await settle();
    store.edit(ID, "owner", "임시");
    store.discard();
    expect(store.getState().leads[0]!.owner).toBe("가상");
  });
});

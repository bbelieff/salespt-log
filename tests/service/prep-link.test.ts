/** 관리자 「이메일 연결」(2026-11-06 belie) — 사전등록 줄에 이메일을 바로 묶는다. 가상 이메일·시트만. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  sheet: "sheet-0" as string | null,
  users: [] as { email: string; role: string; status: string; cohort: string; name: string }[],
  claim: vi.fn(async () => {}),
}));
vi.mock("@/repo/users", () => ({
  findExistingSheetIdByCohortName: async () => m.sheet,
  listAllUsers: async () => m.users,
  claimRegistry: m.claim,
}));
import { linkPrepEmail } from "@/service/prep-link";

beforeEach(() => { m.sheet = "sheet-0"; m.users = [{ email: "coach@example.test", role: "trainer", status: "active", cohort: "T", name: "가상트레이너" }]; m.claim.mockClear(); });

describe("사전등록 줄에 이메일 연결", () => {
  it("트레이너 메일을 0기 코스텝 줄에 — 클레임과 같은 claimRegistry 로 (대소문자·「기」 정리)", async () => {
    const out = await linkPrepEmail({ cohort: "0기", name: " 코스텝 ", email: " Coach@Example.test " });
    expect(out).toEqual({ email: "coach@example.test", cohort: "0", name: "코스텝", spreadsheetId: "sheet-0" });
    expect(m.claim).toHaveBeenCalledWith("coach@example.test", "0", "코스텝", "sheet-0", "trainee", "active");
  });
  it("사전등록 줄이 없으면 막는다", async () => {
    m.sheet = null;
    await expect(linkPrepEmail({ cohort: "0", name: "없음", email: "a@example.test" })).rejects.toThrow(/사전등록 줄을 찾지 못했어요/);
    expect(m.claim).not.toHaveBeenCalled();
  });
  it("이미 다른 활성 수강생 화면으로 쓰는 메일은 막는다(수료생은 허용)", async () => {
    m.users.push({ email: "stu@example.test", role: "trainee", status: "active", cohort: "12", name: "가상수강생" });
    await expect(linkPrepEmail({ cohort: "0", name: "코스텝", email: "stu@example.test" })).rejects.toThrow(/12기 가상수강생/);
    m.users[1]!.status = "archived";
    await expect(linkPrepEmail({ cohort: "0", name: "코스텝", email: "stu@example.test" })).resolves.toMatchObject({ cohort: "0" });
  });
  it("이메일 형식이 틀리면 막는다", async () => {
    await expect(linkPrepEmail({ cohort: "0", name: "코스텝", email: "not-an-email" })).rejects.toThrow(/이메일 형식/);
  });
});

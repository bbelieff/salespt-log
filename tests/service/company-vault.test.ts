import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config", () => ({ authConfig: () => ({ secret: "synthetic-test-secret-value" }) }));
vi.mock("@/repo/users", () => ({ findUserByEmail: async () => ({ spreadsheetId: "sheet-a", cohort: "12", cohortLabel: "12" }) }));
vi.mock("@/repo/db/client", () => ({ dbEnabled: () => true }));
vi.mock("@/service/meetings-write", () => ({
  findMeetingsByDateRecord: async () => [{ id: "meet-1", 업체명: "가나다상사" }],
}));

const db = vi.hoisted(() => ({
  pin: null as null | { pinHash: string; failedCount: number; lockedUntil: Date | null },
  vault: new Map<string, { sealed: string; itemCount: number }>(),
}));
vi.mock("@/repo/db/company-vault", () => ({
  readPinRow: async () => db.pin,
  writePin: async (_s: string, pinHash: string) => { db.pin = { pinHash, failedCount: 0, lockedUntil: null }; },
  recordPinResult: async (_s: string, failedCount: number, lockedUntil: Date | null) => { db.pin = { ...db.pin!, failedCount, lockedUntil }; },
  deletePin: async () => { db.pin = null; },
  readVaultRow: async (_s: string, k: string) => db.vault.get(k) ?? null,
  writeVaultRow: async (_s: string, k: string, sealed: string, itemCount: number) => { db.vault.set(k, { sealed, itemCount }); },
}));

import { loadVault, resetVaultPin, saveVault, setVaultPin, unlockVault } from "@/service/company-vault";
import { VAULT_UNLOCK_MS } from "@/types/company-vault";

const item = { kind: "login", label: "홈택스", id: "sample-id", secret: "sample-pw", note: "" };
const byMeeting = { meetingId: "meet-1" };

describe("업체 계정 보관함", () => {
  beforeEach(() => { db.pin = null; db.vault.clear(); });

  it("PIN 을 만들면 열리고, 저장한 항목은 암호문으로만 남는다", async () => {
    const ticket = await setVaultPin("a@example.com", "4821", undefined, 1_000);
    await saveVault("a@example.com", byMeeting, [item], ticket, 2_000);
    const row = db.vault.get("m:meet-1")!;
    expect(row.itemCount).toBe(1);
    expect(row.sealed).not.toContain("sample-pw");
    const { view } = await loadVault("a@example.com", byMeeting, ticket, 3_000);
    expect(view.items?.[0]?.secret).toBe("sample-pw");
  });

  it("잠겨 있으면 항목 수만 보이고 저장은 거절한다", async () => {
    const ticket = await setVaultPin("a@example.com", "4821", undefined, 1_000);
    await saveVault("a@example.com", byMeeting, [item], ticket, 2_000);
    const later = 1_000 + VAULT_UNLOCK_MS + 60 * 1000; // 열림 시간(30분)이 지난 뒤
    const { view } = await loadVault("a@example.com", byMeeting, ticket, later);
    expect(view).toMatchObject({ unlocked: false, count: 1, items: null });
    await expect(saveVault("a@example.com", byMeeting, [item], ticket, later)).rejects.toMatchObject({ status: 401 });
  });

  it("실무/수납의 계약일+업체명은 같은 미팅 보관함으로 이어진다", async () => {
    const ticket = await setVaultPin("a@example.com", "4821", undefined, 1_000);
    await saveVault("a@example.com", byMeeting, [item], ticket, 2_000);
    const { view } = await loadVault("a@example.com", { 계약일: "2026-10-01", 업체명: "가나다상사" }, ticket, 3_000);
    expect(view.count).toBe(1);
  });

  it("PIN 을 5번 틀리면 잠시 막는다", async () => {
    await setVaultPin("a@example.com", "4821", undefined, 1_000);
    for (let i = 0; i < 4; i++) await expect(unlockVault("a@example.com", "0000", 2_000)).rejects.toMatchObject({ status: 401 });
    await expect(unlockVault("a@example.com", "0000", 2_000)).rejects.toMatchObject({ status: 401 });
    await expect(unlockVault("a@example.com", "4821", 3_000)).rejects.toMatchObject({ status: 429 });
    await expect(unlockVault("a@example.com", "4821", 3_000 + 6 * 60 * 1000)).resolves.toBeTruthy();
  });

  it("PIN 을 바꾸려면 지금 PIN 이 맞아야 한다", async () => {
    await setVaultPin("a@example.com", "4821", undefined, 1_000);
    await expect(setVaultPin("a@example.com", "1111", "9999", 2_000)).rejects.toMatchObject({ status: 401 });
    await expect(setVaultPin("a@example.com", "1111", "4821", 2_000)).resolves.toBeTruthy();
  });

  it("관리자 PIN 초기화는 보관 내용을 지우지 않는다", async () => {
    const ticket = await setVaultPin("a@example.com", "4821", undefined, 1_000);
    await saveVault("a@example.com", byMeeting, [item], ticket, 2_000);
    await resetVaultPin("a@example.com");
    expect(db.pin).toBeNull();
    expect(db.vault.get("m:meet-1")?.itemCount).toBe(1);
  });
});

/**
 * BBE-45 — `shareWithServiceAccount` 단위 테스트 (drive-client.test.ts 의 통합 테스트를 보강).
 * 호출부가 이미 만든 클라이언트를 받는지(이중 인증 방지)까지 이 레벨에서 고정한다.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/config", () => ({
  serviceAccount: () => ({ client_email: "sa@project.iam.gserviceaccount.com", private_key: "k" }),
}));

import { shareWithServiceAccount } from "@/repo/drive-sa-share";

describe("shareWithServiceAccount", () => {
  it("전달받은 client 로 SA 를 writer 공유하고 새 클라이언트를 만들지 않는다", async () => {
    const create = vi.fn(async () => ({ data: {} }));
    const client = { permissions: { create } } as unknown as Parameters<typeof shareWithServiceAccount>[0];

    await shareWithServiceAccount(client, "file-1");

    expect(create).toHaveBeenCalledWith({
      fileId: "file-1",
      supportsAllDrives: true,
      sendNotificationEmail: false,
      requestBody: { type: "user", role: "writer", emailAddress: "sa@project.iam.gserviceaccount.com" },
    });
  });

  it("이미 공유돼 있으면 조용히 통과한다", async () => {
    const create = vi.fn(async () => {
      throw new Error("already exists");
    });
    const client = { permissions: { create } } as unknown as Parameters<typeof shareWithServiceAccount>[0];

    await expect(shareWithServiceAccount(client, "file-1")).resolves.toBeUndefined();
  });

  it("다른 이유로 실패해도 throw 하지 않는다(경고만)", async () => {
    const create = vi.fn(async () => {
      throw new Error("The caller does not have permission");
    });
    const client = { permissions: { create } } as unknown as Parameters<typeof shareWithServiceAccount>[0];

    await expect(shareWithServiceAccount(client, "file-1")).resolves.toBeUndefined();
  });
});

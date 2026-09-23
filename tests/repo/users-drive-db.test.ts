/**
 * users-drive-db — 원자 UPDATE 회귀. 가짜 pool 로 SQL·정규화·rowCount 만 본다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/repo/db/client", () => ({
  getDbPool: () => ({ query: db.query }),
  dbEnabled: () => true,
}));

import { updateDriveLinkInDb } from "@/repo/users-drive-db";

describe("updateDriveLinkInDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue({ rowCount: 1 });
  });

  it("3필드를 한 UPDATE 로 쓴다", async () => {
    await updateDriveLinkInDb(
      { email: "T@Example.com", cohort: " 8기 ", name: " 김수강 " },
      { driveParentPath: "parent-proven-001", feedbackFolderId: "feedback-found-001", driveLinkStatus: "ok" },
    );
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, vals] = db.query.mock.calls[0] as [string, string[]];
    expect(sql).toMatch(/update users set/i);
    expect(sql).toMatch(/drive_parent_path/);
    expect(sql).toMatch(/feedback_folder_id/);
    expect(sql).toMatch(/drive_link_status/);
    expect(sql).toMatch(/updated_at = now\(\)/);
    // 정규화된 자연키가 WHERE 에 그대로.
    expect(vals).toContain("t@example.com");
    expect(vals).toContain("8기");
    expect(vals).toContain("김수강");
  });

  it("생략된 필드는 SET 에 없고 보존된다", async () => {
    await updateDriveLinkInDb(
      { email: "a@x.com", cohort: "8기", name: "김수강" },
      { feedbackFolderId: "feedback-found-001" },
    );
    const [sql] = db.query.mock.calls[0] as [string, string[]];
    expect(sql).toMatch(/feedback_folder_id/);
    expect(sql).not.toMatch(/drive_parent_path/);
    expect(sql).not.toMatch(/drive_link_status/);
  });

  it("0행이면 throw — 유령 INSERT/upsert 로 메우지 않는다", async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(
      updateDriveLinkInDb(
        { email: "a@x.com", cohort: "8기", name: "김수강" },
        { driveLinkStatus: "ok" },
      ),
    ).rejects.toThrow();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(String(db.query.mock.calls[0]?.[0])).toMatch(/update users set/i);
    expect(String(db.query.mock.calls[0]?.[0])).not.toMatch(/insert/i);
  });
});

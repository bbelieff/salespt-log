import { describe, expect, it } from "vitest";
import { activeAssigned, activeTrainerEmails } from "@/service/trainer-pool";

const u = (email: string, role: string, status = "active", cohort = "") => ({ email, role, status, cohort });

describe("trainer-pool — 수강생관리 「담당」과 같은 활성 트레이너 판정", () => {
  it("활성 트레이너만, 퇴출·관리부서는 빼고, 수강생 행이 아닌 관리자는 넣는다", () => {
    const pool = activeTrainerEmails([
      u("Active@x.test", "trainer"), u("gone@x.test", "trainer", "inactive"), u("mgmt@x.test", "trainer", "active", "관리"),
      u("boss@x.test", "trainer", "pending"), u("student@x.test", "trainee"), u("bossStudent@x.test", "trainee"),
    ], ["boss@x.test", "bossstudent@x.test", "ghost@x.test"]);
    expect([...pool].sort()).toEqual(["active@x.test", "boss@x.test", "ghost@x.test"]);
  });
  it("저장 칸의 퇴출 트레이너 잔재는 뺀다 — 풀을 모르면 거르지 않는다", () => {
    expect(activeAssigned(["gone@x.test", "active@x.test"], new Set(["active@x.test"]))).toEqual(["active@x.test"]);
    expect(activeAssigned(["gone@x.test"], new Set())).toEqual(["gone@x.test"]);
  });
});

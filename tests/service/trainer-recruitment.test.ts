import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ email: "student@example.com" as string | null, admin: false, apply: vi.fn(), invite: vi.fn(), accept: vi.fn(), change: vi.fn(), revoke: vi.fn(), list: vi.fn(), users:vi.fn(), assignments:vi.fn() }));
vi.mock("@/auth/identity", () => ({ getSessionEmail: async () => m.email, isAdminEmail: (email:string) => m.admin && email === m.email }));
vi.mock("@/repo/db/trainer-recruitment", () => ({ applyForTrainer: m.apply, createTrainerInvite: m.invite, acceptTrainerInvite: m.accept, changeTrainerQualification: m.change, revokeTrainerInvite: m.revoke, listTrainerInvites: m.list }));
vi.mock("@/repo/users",()=>({findUserByEmail:vi.fn(),listAllUsers:m.users,setTraineeAssignments:m.assignments}));
import { recruitmentAction, recruitmentWriteAllowed } from "@/service/trainer-recruitment";
describe("recruitment boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); m.email = "student@example.com"; m.admin = false; });
  it("application is the actual login account, not a client email or impersonated student", async () => {
    await recruitmentAction({ action: "apply", name: "지원자", email: "victim@example.com" });
    expect(m.apply).toHaveBeenCalledWith("student@example.com", "지원자");
  });
  it("every admin mutation rejects nonadmin before touching DB", async () => {
    for (const action of ["invite", "approve", "reject", "remove", "revoke", "list", "department"]) await expect(recruitmentAction({ action, email: "target@example.com" })).rejects.toMatchObject({ status: 403 });
    expect(m.invite).not.toHaveBeenCalled(); expect(m.change).not.toHaveBeenCalled();
  });
  it("missing login cannot accept", async () => {
    m.email = null;
    await expect(recruitmentAction({ action: "accept", token: "a".repeat(43), name: "본인" })).rejects.toMatchObject({ status: 401 });
  });
  it("validated admin can issue a recipient-bound invitation", async () => {
    m.admin = true;
    await recruitmentAction({ action: "invite", email: "Recipient@example.com" });
    expect(m.invite).toHaveBeenCalledWith("student@example.com", "recipient@example.com");
  });
  it("trainer removal never rewrites any cohort's assignments by email, including retries",async()=>{
    m.admin=true;
    const rows=[{email:"dual@example.com",cohort:"8",status:"archived",assignedTrainer:"old@example.com,other@example.com"},
      {email:"dual@example.com",cohort:"A1-1",status:"active",assignedTrainer:"current@example.com"}];
    m.users.mockResolvedValue(rows); const before=structuredClone(rows);
    await recruitmentAction({action:"remove",email:"old@example.com"});
    await recruitmentAction({action:"remove",email:"old@example.com"});
    expect(m.change).toHaveBeenNthCalledWith(1,"old@example.com","remove",m.email);
    expect(m.change).toHaveBeenNthCalledWith(2,"old@example.com","remove",m.email);
    expect(m.users).not.toHaveBeenCalled();expect(m.assignments).not.toHaveBeenCalled();expect(rows).toEqual(before);
  });
  it("requires same deployment origin and JSON; forged proxy headers do not count", () => {
    vi.stubEnv("AUTH_URL", "https://app.example.com");
    const request = (origin: string | null, site = "same-origin", type = "application/json") => new Request("http://localhost:3000/api/trainer/recruitment", { method: "POST", headers: { ...(origin ? { origin } : {}), "content-type": type, "sec-fetch-site": site, "x-forwarded-host": "evil.example" } });
    expect(recruitmentWriteAllowed(request("https://app.example.com"))).toBe(true);
    for (const req of [request(null), request("https://evil.example"), request("https://app.example.com", "cross-site"), request("https://app.example.com", "same-origin", "text/plain")]) expect(recruitmentWriteAllowed(req)).toBe(false);
    vi.unstubAllEnvs();
  });
  it("cancel is bound to real session, not body target", async () => {
    await recruitmentAction({action:"cancel",email:"victim@example.com"});
    expect(m.change).toHaveBeenCalledWith("student@example.com","cancel","student@example.com");
  });

  it("allows canonical HTTPS behind internal VPS listener without trusting forwarded host", () => {
    vi.stubEnv("NODE_ENV","production");vi.stubEnv("AUTH_URL","");vi.stubEnv("NEXTAUTH_URL","");
    const req=(origin:string)=>new Request("http://localhost:3000/api/trainer/recruitment",{method:"POST",headers:{origin,"content-type":"application/json","x-forwarded-host":"evil.example"}});
    expect(recruitmentWriteAllowed(req("https://salesptlog.online"))).toBe(true);
    expect(recruitmentWriteAllowed(req("https://evil.example"))).toBe(false);
    vi.unstubAllEnvs();
  });

});

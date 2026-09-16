import { beforeEach,describe,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({student:{email:"dual@example.com",role:"trainee",status:"archived",assignedTrainer:"coach@example.com",cohort:"8"},trainer:null as null|{role:string;status:string;cohort:string}}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock("@/auth",()=>({auth:async()=>null}));
vi.mock("@/config",()=>({adminEmails:()=>[]}));
vi.mock("@/repo/users",()=>({findUserByEmail:async()=>m.student,findTrainerByEmail:async()=>m.trainer,parseAssignedTrainers:(v:string)=>v.split(",")}));
import {getEffectiveRole,canImpersonate,isManagementMember} from "@/auth/identity";
describe("trainer capability is separate from student identity",()=>{
 beforeEach(()=>{m.trainer=null;});
 it("pending application keeps archived student's CRM access without trainer access",async()=>{
  m.trainer={role:"trainer",status:"pending",cohort:"T"};
  expect(await getEffectiveRole("dual@example.com")).toEqual({role:"trainee",status:"archived"});
  expect(await canImpersonate("coach@example.com","dual@example.com")).toBe(false);
 });
 it("active qualification grants only assigned-student access and revocation removes it",async()=>{
  m.trainer={role:"trainer",status:"active",cohort:"T"};
  expect(await getEffectiveRole("dual@example.com")).toEqual({role:"trainer",status:"active"});
  expect(await canImpersonate("coach@example.com","dual@example.com")).toBe(true);
  expect(await canImpersonate("stranger@example.com","dual@example.com")).toBe(false);
  m.trainer=null;expect(await canImpersonate("coach@example.com","dual@example.com")).toBe(false);
 });
 it("management membership reads qualification department, not student's cohort",async()=>{
  m.trainer={role:"trainer",status:"active",cohort:"관리"};expect(await isManagementMember("dual@example.com")).toBe(true);
 });
});

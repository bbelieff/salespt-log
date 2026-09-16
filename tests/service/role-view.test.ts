import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({email:"dual@example.com",active:"dual@example.com",state:{canStudent:true,canTrainer:true,impersonating:false},jar:new Map<string,string>(),set:vi.fn(),clear:vi.fn(),arena:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>m.jar.has(key)?{value:m.jar.get(key)}:undefined,set:(key:string,value:string,options:unknown)=>{m.jar.set(key,value);m.set(key,value,options);}})}));
vi.mock("@/auth/identity",()=>({getSessionEmail:async()=>m.email,getActiveUserEmail:async()=>m.active,setImpersonation:m.clear,setArenaSelfView:m.arena}));
vi.mock("@/service/trainer-status",()=>({trainerStatus:async()=>m.state}));
import { changeRoleView, restoreRolePath } from "@/service/role-view";
describe("account-bound role navigation",()=>{
 beforeEach(()=>{m.email=m.active="dual@example.com";m.state={canStudent:true,canTrainer:true,impersonating:false};m.jar.clear();vi.clearAllMocks();});
 it("remembers each role independently and restores exact safe page",async()=>{
  await changeRoleView({role:"student",path:"/contact"});
  await changeRoleView({role:"trainer",path:"/trainer/weekly-goals"});
  expect(await restoreRolePath(m.email)).toBe("/trainer/weekly-goals");
  expect(await changeRoleView({role:"student",switch:true})).toMatchObject({destination:"/contact"});
  expect(m.clear).toHaveBeenCalledWith(null);expect(m.arena).toHaveBeenCalledWith(true);
  expect(m.set.mock.calls.at(-1)?.[2]).toMatchObject({httpOnly:true,sameSite:"lax"});
 });
 it("another account never inherits remembered role/page",async()=>{
  await changeRoleView({role:"trainer",path:"/trainer/weekly-goals"});m.email=m.active="other@example.com";
  expect(await restoreRolePath(m.email)).toBeNull();
 });
 it("rejects tokens, arbitrary destinations and revoked capabilities",async()=>{
  for(const path of ["//evil.test","/trainer/invite?token=secret","/contact?as=victim@example.com","/admin","/trainer/../../admin"])
   await expect(changeRoleView({role:"trainer",path})).rejects.toMatchObject({status:400});
  await changeRoleView({role:"trainer",path:"/trainer"});m.state.canTrainer=false;
  expect(await restoreRolePath(m.email)).toBeNull();
  await expect(changeRoleView({role:"trainer",switch:true})).rejects.toMatchObject({status:403});
 });
 it("does not persist impersonated student and explicit switch clears target",async()=>{
  m.state.impersonating=true;m.active="assigned@example.com";
  expect(await changeRoleView({role:"student",path:"/contact"})).toEqual({remembered:false});expect(m.set).not.toHaveBeenCalled();
  await changeRoleView({role:"student",switch:true});expect(m.clear).toHaveBeenCalledWith(null);
 });
});

"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useGuardedNav } from "@/components/DirtyGuard";
import { safeRolePath, type ViewRole } from "@/util/role-view";
export type TrainerState = {email:string;name:string;status:string;canStudent:boolean;canTrainer:boolean;isAdmin:boolean;impersonating:boolean};
export function useTrainerState() {
  return useQuery<TrainerState>({queryKey:["trainer-state"],queryFn:async () => {
    const res=await fetch("/api/trainer/recruitment",{cache:"no-store"});
    if (!res.ok) throw new Error("신청 정보를 불러오지 못했습니다.");
    return res.json();
  },staleTime:10000});
}
export default function RoleViewSwitch({modeHint}:{modeHint?:ViewRole}) {
  const {data} = useTrainerState();
  const pathname=usePathname();
  const mode:ViewRole=modeHint ?? (pathname.startsWith("/trainer") ? "trainer" : "student");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const guard=useGuardedNav();
  useEffect(() => {
    if (!data || data.impersonating || !safeRolePath(mode,pathname) || (mode === "trainer" ? !data.canTrainer : !data.canStudent)) return;
    void fetch("/api/role-view",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:mode,path:pathname})}).catch(()=>{});
  },[data,mode,pathname]);
  if (!data?.canStudent || !data.canTrainer) return null;
  const go=async (role:ViewRole) => {
    if (busy || (role === mode && !data.impersonating)) return;
    setBusy(true);setError("");
    try {
      const res=await fetch("/api/role-view",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role,switch:true})});
      const body=await res.json();
      if (!res.ok || !safeRolePath(role,body.destination)) throw new Error(body.error || "화면 전환에 실패했습니다.");
      window.location.assign(body.destination); // Clears account-bound query caches and stale server layouts.
    } catch(e) {setError(e instanceof Error ? e.message : "화면 전환에 실패했습니다.");setBusy(false);}
  };
  return <div className="relative shrink-0">
    <div role="group" aria-label="접속 역할" className="flex rounded-lg bg-gray-100 p-1">
      {(["student","trainer"] as const).map(role=><button key={role} type="button" disabled={busy} aria-pressed={role===mode && !data.impersonating} onClick={()=>guard(()=>void go(role))}
        className={`h-11 rounded-md px-2 text-xs font-bold disabled:opacity-50 ${role===mode && !data.impersonating ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-200"}`}>{role === "student" ? "수강생" : "트레이너"}</button>)}
    </div>
    {error && <p role="alert" className="absolute right-0 top-full w-56 rounded bg-white p-2 text-xs text-red-700 shadow">{error}</p>}
  </div>;
}

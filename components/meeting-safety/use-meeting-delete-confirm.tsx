"use client";
import {useState,useRef,useEffect} from "react";
import type {Route} from "next";
import {useRouter} from "next/navigation";
import type {Meeting} from "@/types";
import {useGuardedNav} from "@/components/DirtyGuard";
import MeetingSafetyDialog from "./MeetingSafetyDialog";
export function meetingScheduleUrl(meeting:{id:string;미팅날짜:string}){return `/schedule?date=${encodeURIComponent(meeting.미팅날짜)}&focus=${encodeURIComponent(meeting.id)}&edit=schedule` as Route;}
export function useMeetingDeleteConfirm(){
 const [meeting,setMeeting]=useState<Meeting|null>(null),resolver=useRef<((value:boolean)=>void)|null>(null),router=useRouter(),guarded=useGuardedNav();
 const finish=(value:boolean)=>{resolver.current?.(value);resolver.current=null;setMeeting(null);};
 useEffect(()=>()=>{resolver.current?.(false);},[]);
 const request=(item:Meeting)=>new Promise<boolean>(resolve=>{resolver.current?.(false);resolver.current=resolve;setMeeting(item);});
 const element=meeting?<MeetingSafetyDialog title="날짜나 시간을 바꾸려는 건가요?" onClose={()=>finish(false)}><p className="mb-3 text-sm text-slate-600">일정 변경은 STEP 3에서 해 주세요. 입력한 업체정보는 그대로 유지돼요.</p><p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">삭제하면 예약 집계·캘린더에서 빠집니다. 유입·컨택 기록은 남아요.<br/>{meeting.상태==='예약'&&!meeting.previousMeetingId?'단순 예약은 삭제한 미팅에서 복원할 수 있어요.':'연결된 미팅·계약도 함께 삭제될 수 있으며, 여기서 복원할 수 없어요.'}</p><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white" onClick={()=>{const url=meetingScheduleUrl(meeting);finish(false);guarded(()=>router.push(url));}}>STEP 3 · 일정 변경</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={()=>finish(false)}>돌아가기</button><button type="button" className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600" onClick={()=>finish(true)}>미팅 삭제</button></div></MeetingSafetyDialog>:null;
 return {request,element};
}

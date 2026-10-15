"use client";
import { useEffect,useRef,type ReactNode } from "react";
export default function MeetingSafetyDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}} className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-black/40"><h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>{children}</dialog>;
}

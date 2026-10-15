import React,{useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export default function SheetDialog({title,icon,children,onClose}:{title:string;icon:ReactNode;children:ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current;const previous=document.activeElement as HTMLElement|null;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="dbs-dialog" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><header className="dbs-dialog-head"><span className="dbs-title-icon">{icon}</span><h2>{title}</h2><button className="dbs-icon-button" aria-label="닫기" onClick={onClose}><X size={18}/></button></header>{children}</dialog>;
}

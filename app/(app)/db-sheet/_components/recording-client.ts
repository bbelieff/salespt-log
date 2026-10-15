import type { DbSheetLead } from '@/types/db-sheet';
export type Recording = { inflow: boolean; activities: boolean };
export type RecordingImpact = { inflow:number;contacts:number;meetings:number;rows:{date:string;channel:string;inflow:number;contacts:number;meetings:number}[];blockedReason?:string };
export type DuplicateMatch = {id:string;company:string;phone:string};
export type SheetResponse = {leads:DbSheetLead[];suppliers?:string[];impact?:RecordingImpact;deletedId?:string};
export class SheetRequestError extends Error {
 constructor(message:string, public code?:string, public duplicates:DuplicateMatch[]=[],public duplicateLeadId?:string){super(message);}
}
export async function sheetRequest(body?:unknown):Promise<SheetResponse>{
 const response=await fetch('/api/db-sheet',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const payload=await response.json();
 if(!response.ok)throw new SheetRequestError(payload.error||'저장하지 못했습니다.',payload.code,payload.duplicates,payload.duplicateLeadId);
 return payload;
}

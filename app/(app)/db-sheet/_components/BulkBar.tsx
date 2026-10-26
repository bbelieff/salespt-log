"use client";
/**
 * 여러 줄 작업 줄(2026-10-23 belie) — 체크한 줄에 유입 반영·유입 미반영·공급처 바꾸기·삭제.
 * 삭제는 바로 휴지통으로(2026-10-26 belie) — 아래 TrashNoticeBar 에서 휴지통을 열어 되돌린다.
 */
import {type BulkOutcome,type PendingDelete} from './db-sheet-store';

/** 결과 한 줄 — 바꾼 수 · 이미 그 상태 · 못 바꾼 줄과 이유(첫 줄만 이름). */
export function bulkOutcomeText(action:string,out:BulkOutcome):string{
 const parts=[`${out.done}건 ${action}`];
 if(out.unchanged)parts.push(`${out.unchanged}건은 이미 ${action}돼 있어요`);
 if(out.blocked.length){const first=out.blocked[0]!;parts.push(`${out.blocked.length}건은 바꾸지 못했어요(${first.company||'이름 없는 업체'}: ${first.reason}${out.blocked.length>1?' 외':''})`);}
 return parts.join(' · ');
}

export function BulkBar({count,busy,message,onInflow,onSupplier,onDelete,onClear}:{count:number;busy:boolean;message:string;onInflow:(inflow:boolean)=>void;onSupplier:()=>void;onDelete:()=>void;onClear:()=>void}){
 const off=!count||busy;
 return <div className="sheet-bulk-bar" data-on={count>0||undefined} role="toolbar" aria-label="선택한 줄 한꺼번에 바꾸기">
  <span className="sheet-bulk-count" aria-live="polite">{count?<><b>{count}</b>줄 선택됨</>:'줄 앞 칸을 체크하면 한꺼번에 바꿀 수 있어요'}</span>
  {count>0&&<button type="button" className="sheet-text-btn" disabled={busy} onClick={onClear}>선택 해제</button>}
  <span className="sheet-bulk-actions">
   <button type="button" className="sheet-btn" disabled={off} onClick={()=>onInflow(true)}>유입 반영</button>
   <button type="button" className="sheet-btn" disabled={off} onClick={()=>onInflow(false)}>유입 미반영</button>
   <button type="button" className="sheet-btn" disabled={off} onClick={onSupplier}>공급처 바꾸기</button>
   <button type="button" className="sheet-btn sheet-btn-danger" disabled={off} onClick={onDelete}>삭제</button>
  </span>
  {(busy||message)&&<p className="sheet-bulk-message" role="status">{busy?'처리 중…':message}</p>}
 </div>;
}

/** 삭제 직후 안내 줄 — 휴지통으로 옮긴 건수·정리된 STEP 2 기록, 「휴지통 열기」(되돌리기는 휴지통에서). */
export function TrashNoticeBar({deleting,onOpen,onClose}:{deleting:PendingDelete;onOpen:()=>void;onClose:()=>void}){
 const step2=[deleting.inflow?`유입 ${deleting.inflow}건`:'',deleting.contacts?`상담 ${deleting.contacts}건`:'',deleting.meetings?`미팅 ${deleting.meetings}건`:''].filter(Boolean).join('·');
 return <div className="sheet-undo-bar" role="status">
  <span><b>{deleting.count}</b>건을 휴지통으로 옮겼어요{step2?` · STEP 2 ${step2}도 함께 정리돼요`:''}</span>
  <button type="button" className="sheet-btn" onClick={onOpen}>휴지통 열기</button>
  <button type="button" className="sheet-text-btn" aria-label="안내 닫기" onClick={onClose}>닫기</button>
 </div>;
}

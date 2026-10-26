"use client";
/**
 * 체크한 DB의 공급처 유형·공급처 이름 한꺼번에 바꾸기(2026-10-26 belie 「공급처를 체크해서 유형부터 이름까지 일괄로」).
 * 빈 칸은 그대로 둔다. 미팅이 연결된 DB의 유형은 STEP 3 에서 바꾸므로 여기서는 바꾸지 않고 알려 준다.
 */
import {useState} from 'react';
import {Pencil} from 'lucide-react';
import {CHANNEL_ORDER} from '@/types/channel';
import SheetDialog from './SheetDialog';
import SupplierInput from './SupplierInput';
import {supplierPlaceholder} from './model';

export function BulkSupplierDialog({count,suppliers,onApply,onClose}:{count:number;suppliers:string[];onApply:(patch:{channel?:string;supplier?:string})=>Promise<void>;onClose:()=>void}){
 const [channel,setChannel]=useState(''),[supplier,setSupplier]=useState(''),[busy,setBusy]=useState(false);
 const ready=!!channel||!!supplier.trim();
 async function submit(){setBusy(true);try{await onApply({...(channel?{channel}:{}),...(supplier.trim()?{supplier:supplier.trim()}:{})});onClose();}finally{setBusy(false);}}
 return <SheetDialog title={`공급처 바꾸기 · ${count}건`} icon={<Pencil size={20}/>} onClose={()=>{if(!busy)onClose();}}><form onSubmit={e=>{e.preventDefault();if(ready)void submit();}}><div className="dbs-dialog-body"><div className="dbs-fields">
  <label>공급처 유형<select aria-label="바꿀 공급처 유형" className="sheet-input" value={channel} onChange={e=>setChannel(e.target.value)}><option value="">그대로</option>{CHANNEL_ORDER.map(c=><option key={c}>{c}</option>)}</select></label>
  <label>공급처<SupplierInput aria-label="바꿀 공급처" className="sheet-input" value={supplier} options={suppliers} onValueChange={setSupplier} placeholder={channel?supplierPlaceholder(channel):'그대로'}/></label>
 </div></div><footer className="dbs-dialog-foot"><button type="button" className="dbs-button" disabled={busy} onClick={onClose}>취소</button><button className="dbs-button primary" disabled={busy||!ready}>{busy?'바꾸는 중…':`${count}건 바꾸기`}</button></footer></form></SheetDialog>;
}

import {Copy,ArrowRight,Plus} from 'lucide-react';
import SheetDialog from './SheetDialog';
import type {DuplicateMatch} from './recording-client';
export function DuplicateDialog({matches,onExisting,onSeparate,onCancel}:{matches:DuplicateMatch[];onExisting:(id:string)=>void;onSeparate:()=>void;onCancel:()=>void}){
 return <SheetDialog title="이미 등록된 업체예요" icon={<Copy size={20}/>} onClose={onCancel}><div className="dbs-dialog-body"><p className="dbs-muted">이름 또는 연락처가 같은 기록이 있어요.</p>{matches.map(row=><button className="dbs-choice-link" key={row.id} onClick={()=>onExisting(row.id)}><span><strong>{row.company}</strong><small>{row.phone} · 기존 업체 열기</small></span><ArrowRight size={18}/></button>)}<p className="dbs-muted">같은 업체라면 기존 내용을 수정하세요. 별도 등록 시 유입이 중복 집계될 수 있어요.</p><button className="dbs-choice-link" onClick={onSeparate}><span><strong>별도 업체로 등록</strong><small>지금 입력한 내용으로 등록</small></span><Plus size={18}/></button><button className="dbs-text-button" onClick={onCancel}>입력 다시 확인</button></div></SheetDialog>;
}

"use client";
/**
 * 결과가 난 미팅(계약·완료·변경·취소)의 업체명·장소 고치기 — 주간 보드 미팅 창 안.
 * 예약 미팅은 「일정·업체명 고치기」(BasicEditDetails)가 있지만 결과가 난 뒤에는 이름을 잘못 적은 걸 알아도
 * 고칠 곳이 없었다(2026-11-16 belie — 수강생이 「법인」으로 적은 업체명을 못 고침). 날짜·시간은 여기서 바꾸지 않는다.
 * 계약 미팅은 저장 함수(useMeetingPatch)가 실무/수납 장부의 업체명도 함께 옮긴다.
 */
import { useState } from "react";

export default function MeetingNameFix({ name, place, contract, pending, onSave, onCancel }: {
  name: string; place: string; contract: boolean; pending: boolean;
  onSave: (partial: { 업체명?: string; 장소?: string }) => Promise<void> | void; onCancel: () => void;
}) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(place);
  const [warn, setWarn] = useState("");
  const submit = async () => {
    const nn = n.trim(), pp = p.trim();
    if (!nn) { setWarn("업체명은 비울 수 없어요"); return; }
    const partial: { 업체명?: string; 장소?: string } = {};
    if (nn !== name) partial.업체명 = nn;
    if (pp !== place.trim()) partial.장소 = pp;
    if (Object.keys(partial).length) await onSave(partial);
    onCancel();
  };
  return (
    <form className="wb-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label>업체명<input className="wb-in" value={n} maxLength={80} autoFocus onChange={(e) => { setN(e.target.value); setWarn(""); }} /></label>
      <label>장소<input className="wb-in" value={p} maxLength={120} onChange={(e) => setP(e.target.value)} /></label>
      {contract && <p className="wb-fixnote">실무/수납의 계약 업체명도 함께 바뀌어요</p>}
      {warn && <p role="alert" className="wb-warn">{warn}</p>}
      <button type="submit" className="wb-save" disabled={pending}>{pending ? "저장하는 중…" : "이름·장소 저장"}</button>
      <div className="wb-links"><button type="button" onClick={onCancel}>그만두기</button></div>
    </form>
  );
}

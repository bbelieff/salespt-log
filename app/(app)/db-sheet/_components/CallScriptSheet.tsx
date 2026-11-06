"use client";
/**
 * 📜 대본 창 (2026-11-07 belie 모바일 기획 2판 ①②) — DB정보 「통화」 줄의 「대본 보기」로 열고,
 * 📞 로 건 뒤에도 열려 있어 전화 앱에서 돌아오면 대본이 먼저 보인다.
 * 업체정보 → 「대본」 탭과 같은 패널을 그대로 쓴다(내 대본·문자 양식·수정·복사). 그 길도 그대로 남는다.
 */
import { ScrollText } from "lucide-react";
import ContactScriptPanel from "@/components/company-info/ContactScriptPanel";
import SheetDialog from "./SheetDialog";

export function CallScriptSheet({ company, onClose }: { company: string; onClose: () => void }) {
  return <SheetDialog title={`${company} 통화 대본`} icon={<ScrollText size={20} />} onClose={onClose}>
    <div className="dbs-dialog-body dbs-call-script-body"><ContactScriptPanel /></div>
    <footer className="dbs-dialog-foot"><button type="button" className="dbs-button primary" onClick={onClose}>닫기</button></footer>
  </SheetDialog>;
}

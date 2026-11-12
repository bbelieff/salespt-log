/**
 * CompanyDocAutofillButton — CompanyInfoEditor 헤더의 「문서로 자동입력」 버튼 + 팝업(지연 로딩).
 * 팝업 코드와 OCR 실행기는 버튼을 누른 뒤에야 내려받는다(React.lazy + 팝업 안 dynamic import) →
 * 업체정보를 열기만 하는 사용자는 OCR 코드(tesseract·pdfjs)를 받지 않는다.
 * 반영은 onApply 로 편집기의 기존 set 경로(자동저장/부모 stage)에 넘긴다 — 새 저장 경로 없음.
 * 반영 뒤 아래 알림의 「되돌리기」로 이번 묶음만 이전 값으로 돌린다. 문서로 채운 칸은 손대기 전까지 노란 바탕(MSC 이식).
 */
"use client";

import { lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalTarget } from "@/components/ui/top-layer";
import { FileInput } from "lucide-react";
import type { CompanyInfo } from "@/types";
import type { CompanyInfoKey } from "@/lib/document-ocr/types";
import type { VaultItem } from "@/types/company-vault";
import { docFillOf, undoPatch, untouchedKeys, type DocFill } from "@/lib/document-ocr/undo";

const CompanyDocAutofillDialog = lazy(() => import("./CompanyDocAutofillDialog"));

interface Props {
  current: CompanyInfo;
  onApply: (patch: Partial<Record<CompanyInfoKey, string>>) => void;
  onVault?: (items: VaultItem[]) => void;
  compactMobile?: boolean;
}

export default function CompanyDocAutofillButton({ current, onApply, onVault, compactMobile = false }: Props) {
  const portalTarget = usePortalTarget(); // 열린 최상단 층 창 안이면 그 창 안에 그린다
  const [open, setOpen] = useState(false);
  const [fill, setFill] = useState<DocFill | null>(null);
  const [notice, setNotice] = useState(false);
  const marked = fill ? untouchedKeys(fill, current) : [];
  const applyDoc = (patch: Partial<Record<CompanyInfoKey, string>>) => {
    setFill(docFillOf(current, patch));
    setNotice(true);
    onApply(patch);
  };
  const undo = () => {
    if (fill) onApply(undoPatch(fill, current));
    setFill(null);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={compactMobile ? "문서로 자동입력" : undefined} title={compactMobile ? "문서로 자동입력" : undefined}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {compactMobile && <FileInput className="payment-ci-icon" size={18} strokeWidth={1.75} aria-hidden /> }<span className={compactMobile ? "payment-ci-action-label" : undefined}>문서로 자동입력</span>{compactMobile && <span className="payment-ci-short" aria-hidden>문서입력</span>}
      </button>
      {open && (
        <Suspense fallback={null}>
          <CompanyDocAutofillDialog current={current} onApply={applyDoc} onVault={onVault} onClose={() => setOpen(false)} />
        </Suspense>
      )}
      {marked.length > 0 && (
        <style>{marked.map((k) => `[data-company-info-body] [id$="-${k}"]`).join(",") + "{background-color:#fffbeb}"}</style>
      )}
      {notice && marked.length > 0 && portalTarget && createPortal(
        <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
          <span className="min-w-0 flex-1">문서로 {marked.length}칸 채웠어요 (노란 칸)</span>
          <button type="button" onClick={undo} className="shrink-0 rounded-md px-2 py-1 font-bold text-amber-300 hover:bg-white/10">되돌리기</button>
          <button type="button" onClick={() => setNotice(false)} aria-label="알림 닫기" className="shrink-0 rounded-md px-2 py-1 text-slate-300 hover:bg-white/10">✕</button>
        </div>,
        portalTarget,
      )}
    </>
  );
}

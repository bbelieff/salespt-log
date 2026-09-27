/**
 * CompanyDocAutofillButton — CompanyInfoEditor 헤더의 「문서로 자동입력」 버튼 + 팝업(지연 로딩).
 * 팝업 코드와 OCR 실행기는 버튼을 누른 뒤에야 내려받는다(React.lazy + 팝업 안 dynamic import) →
 * 업체정보를 열기만 하는 사용자는 OCR 코드(tesseract·pdfjs)를 받지 않는다.
 * 반영은 onApply 로 편집기의 기존 set 경로(자동저장/부모 stage)에 넘긴다 — 새 저장 경로 없음.
 */
"use client";

import { lazy, Suspense, useState } from "react";
import type { CompanyInfo } from "@/types";
import type { CompanyInfoKey } from "@/lib/document-ocr/types";

const CompanyDocAutofillDialog = lazy(() => import("./CompanyDocAutofillDialog"));

interface Props {
  current: CompanyInfo;
  onApply: (patch: Partial<Record<CompanyInfoKey, string>>) => void;
}

export default function CompanyDocAutofillButton({ current, onApply }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        문서로 자동입력
      </button>
      {open && (
        <Suspense fallback={null}>
          <CompanyDocAutofillDialog current={current} onApply={onApply} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

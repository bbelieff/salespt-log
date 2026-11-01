## 2026-11-01 · MSC 서류 자동입력 이식 1단계 PR-1 (합본·깨진 글자층·스캔 여러 쪽·다른 회사·되돌리기)
- feat/msc-document-upload-port. 요청: MSC report 세션 핸드오프 + belie 「여기서진행」. 계획 docs/plans/active/msc-document-upload-port.md.
- 담당 파일: lib/document-ocr/{bundle,undo,ocr-client,ocr-pdf,diff,limits,text-utils}.ts · components/company-doc/{CompanyDocAutofillDialog,CompanyDocAutofillButton}.tsx · 시험 2개. 선행조건 없음.
- 개인정보 약속 그대로: 브라우저 안에서만 읽고 원본 저장 없음. 2단계(서버 OCR)는 사용자 승인 전이라 손대지 않음.
- 보류: 4 서류별 다시 읽기(이유는 계획 Log).
- 되돌리기 = squash revert(데이터 변경 없음).

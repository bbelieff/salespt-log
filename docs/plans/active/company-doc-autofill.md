> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보에 사업자등록증 같은 서류(사진·PDF)를 올리면 이 기기 안에서 글자를 읽어(OCR) 빈 칸을 채워 주는 「문서로 자동입력」 팝업(PR-4: 엔진·팝업·사업자등록증).
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `components/CompanyInfoEditor.tsx`(컨택관리·일정/계약·실무/수납 공용) 헤더 버튼 · `components/company-doc/*` · `lib/document-ocr/*` · `scripts/vendor-document-ocr.mjs` · `npm run build`
> - **읽고 나면 알 수 있는 것**: 파일이 어디로도 안 나가는 이유 / 새 서류(PR-5)를 어떻게 붙이나 / 기본 체크 규칙 / 배포에서 OCR 에셋이 어떻게 생기나 / 되돌리는 법
> - **관련 문서**: `docs/plans/active/company-info-new-fields.md`(PR-3, 채울 칸), `lib/util/rrn-front.ts`, MoaWork `app/src/lib/document-ocr/*`(origin/main — 원본 OCR 엔진)

---
slug: company-doc-autofill
status: active
created: 2026-09-28
worktree: _wt/salespt-log/dc-cohort12
branch: feat/company-doc-autofill
---

# 업체정보 「문서로 자동입력」 (PR-4)

## 1. Scope

- CompanyInfoEditor 헤더 「편집」 왼쪽에 「문서로 자동입력」 버튼 → 팝업.
- 여러 파일 끌어놓기/고르기(JPG·PNG·WebP·PDF, 15MB, PDF 첫 페이지). 파일마다 문서 종류 자동 판별(바꿀 수 있음)·진행 상태.
- 비교표 하나: 항목 | 지금 값 | 문서에서 읽은 값 | 정확도(높음/보통/낮음) | 적용. 「취소」「선택 항목 적용」.
- 이번 PR 파서 = **사업자등록증만**(법인등록번호 포함). 부가세 과세표준증명·재무제표·신분증·임대차계약서는 분류만 되고 "이 문서는 곧 지원돼요"(PR-5).

## 2. belie 결정 반영

| 결정 | 어디서 지키나 |
|---|---|
| OCR 은 브라우저에서만(서버 업로드·외부 API·비용 0) | `lib/document-ocr/ocr-client.ts` — tesseract.js 7.0.0 / pdfjs-dist 6.3.289 를 함수 안 dynamic import, 에셋은 same-origin `/document-ocr/*` 만(`buildOcrAssetUrls` 가 외부 URL·상위경로 거절, 테스트). 새 API 라우트 없음 |
| 원본 파일 저장 안 함 | 팝업 state 에 File 은 읽기 시작 전까지만, 읽은 글자는 팝업 메모리에만(닫으면 소멸). objectURL 은 ocr-client 가 인식 직후 revoke. 미리보기 없음 |
| 주민등록번호 앞 6자리만 | 사업자등록증 파서는 13자리 번호를 법인등록번호 라벨 줄만 꺼낸 뒤 **원문에서 지우고** 읽음 → 뒷자리가 어떤 제안에도 못 들어감(테스트: 결과 JSON 에 뒷자리 없음). 반영 직전 `sanitizeForKey` 가 주민등록번호 칸을 `normalizeRrnFront` 로 한 번 더. 서버 zod transform 은 PR-3 그대로 |
| OCR 원문·증빙 로그 금지 | 제안에 evidence 필드 자체가 없음. console 출력 없음 |

## 3. 구조 (레이어)

- `lib/document-ocr/` = `lib/format` 과 같은 **화면·서비스 공용 순수 헬퍼 폴더**. `lib/util` 은 import 0 계약(`tests/structural/period-hardcode.test.ts`)이라 형제 import 가 필요한 파서를 둘 수 없어 여기로 — `@/types`(타입만)·`@/util/rrn-front` 만 import. googleapis·pg 없음.
  - `types.ts`(DocType·ParsedField·DocParseResult) · `limits.ts` · `bizno.ts`(사업자·법인등록번호 검증식) · `text-utils.ts`(라벨·날짜 YY.MM.DD) · `parse-certificate.ts` · `registry.ts`(`classifyDocumentText`·`PARSERS`·`parseDocument`) · `diff.ts`(비교표 행·기본 체크·충돌·반영값) · `ocr-client.ts`·`ocr-pdf.ts`(브라우저 전용).
- 화면: `components/company-doc/CompanyDocAutofillButton`(React.lazy 로 팝업 지연 로딩) → `CompanyDocAutofillDialog` → `CompanyDocDiffTable`.
- 반영: 편집기의 기존 `apply()` 한 번(자동저장 `update` / 임베드 `stage`) — **새 저장 경로 없음**.

## 4. 기본 체크 규칙 (`lib/document-ocr/diff.ts`)

- 지금 값 비었고 읽은 값 있음 → 체크 · 지금 값 있음 → 해제 + "지금 값이 있어 기본으로 안 덮어요" · 같은 값 → 해제.
- 읽은 값이 빈 칸은 행 자체가 없다(빈 값으로 덮기 불가).
- 사업자등록번호 검증식 실패 → 해제 + 경고. 검증 통과 값이 실패 값보다 먼저.
- 두 파일이 같은 칸에 다른 값 → 충돌 고르기 상자, 기본 = 정확도 높은 값. 같은 값이면 합치고 출처를 모음.
- 정확도: ≥0.8 높음 · ≥0.5 보통 · 그 아래 낮음(파서 경험치 — 확률 아님).

## 5. 사업자등록증 → 업체정보 칸

대표자이름(대표자/성명) · 사업자등록번호(000-00-00000, 검증식) · 개업일(YY.MM.DD) · 대표자생년월일(라벨 "생년월일" 있을 때만, YY.MM.DD) · 소재지(사업장 소재지 우선) · 업태 · 업종주생산품목(=종목) · 과세유형(일반/간이/면세) · 법인등록번호(000000-0000000, 검증식) · 사업자구분(법인등록번호·"법인사업자"·법인 형태면 법인, 과세자 표기·생년월일이면 개인). **상호는 CompanyInfo 칸이 아니다** → 파일 행에 "상호: … (참고 — 저장하지 않아요)" 만.

## 6. PR-5 확장 방법

`lib/document-ocr/parse-<문서>.ts` 에 `(text) => DocParseResult` 를 만들고 `registry.ts` `PARSERS` 에 한 줄 등록. 팝업·비교표·기본 체크는 그대로 동작. 금액 칸(재무·임차)은 "3,200만"/"1.2억" 한 가지 포맷터로(이번 PR 미구현 — PR-5 소관).

## 7. 배포 · 에셋

- `npm run build` = `npm run vendor:document-ocr && next build`. `.github/workflows/deploy.yml` 은 VPS 에서 `npm ci`(또는 lock 해시 동일 시 스킵 — 새 lock 이라 이번엔 실행) 후 `BUILD_DIST_DIR=.next-build npm run build` 를 부르므로 vendor 가 매 배포 실행된다. 스크립트는 로컬 node_modules 만 복사(네트워크 없음) → `public/document-ocr/`(약 12MB: worker·core simd-lstm·kor/eng best_int gz·pdf.worker). `git reset --hard` 는 untracked 를 지우지 않지만 매 빌드 재생성이라 무관.
- `public/document-ocr/` 는 gitignore. `middleware.ts` matcher 에서 `document-ocr/` 제외(정적 에셋에 인증 확인 생략).
- 데이터 패키지 `@tesseract.js-data/kor`·`eng` 는 MoaWork 처럼 devDependencies — VPS `npm ci` 는 dev 포함(빌드에 typescript 등 필요)이라 설치됨.
- `check.sh`(CI) 는 build 를 돌리지 않으므로 네트워크·에셋 없이 통과. 로컬 `npm run dev` 는 vendor 를 돌리지 않는다 → 처음 한 번 `npm run vendor:document-ocr`(없으면 팝업이 그렇게 안내).

## 8. 검증 · 남은 위험

- vitest: `tests/document-ocr/{parse,diff,ocr-client}.test.ts`, `tests/components/company-doc-autofill.test.ts`(OCR mock — 파일 고르기→행→적용=체크 칸만, 편집기 stage 경로, 충돌, 미지원 문서, Esc).
- **실제 브라우저 미검증**: tesseract 인식 정확도(실물 사업자등록증), PDF 텍스트층/렌더 폴백, WASM SIMD 미지원 기기, 375px 실화면, 포커스 순환 실기기. 배포 후 합성 사업자등록증 이미지로 1회 실측 필요.
- 되돌리기: 이 PR squash revert(스키마·시트 변경 없음 — 데이터 영향 0).

# 문서 자동입력에 PaddleOCR 붙이기 (tesseract 유지 + 칸별 합치기)

- **읽는 사람**: 개발자 · **관련**: `docs/plans/active/company-doc-autofill.md`, `lib/document-ocr/*`, `scripts/vendor-document-ocr.mjs`

## 목표 (belie 2026-10-28)
「PaddleOCR 도입 고려 — 지금 인식률 높은 부분은 살리고 새 OCR 을 붙여라.」

## 실측 (합성 서류 4종 × 깨끗/작게/폰사진, 2026-10-28)
- tesseract: 한글 오독(매출액→매줄액, 이백오십→이백오심, 07월→0741). 숫자는 대체로 안정.
- 공식 PaddleOCR(PP-OCRv5 mobile det + korean rec, 브라우저 wasm): 한글·숫자 모두 거의 정확, 한 장 약 1.3~2초(PC).
- 실제 팝업 코드 경로(하네스)로 재무제표 사진: tesseract 3칸 → 합친 결과 5칸(매출·영업이익 추가), 임대차: 월세 추가, 사업자등록증: 종목 추가.

## 설계
1. **살리는 것**: PDF 텍스트층(가장 정확) 그대로 · tesseract 경로·파서·분류기 그대로 · 서버 전송 0 원칙 그대로.
2. **붙이는 것**: 사진·스캔 PDF 는 tesseract 다음 Paddle 로 한 번 더 읽어 `altText` 로 함께 돌려준다(`ocr-client.ts` → `ocr-paddle.ts`, 웹 워커 — 화면 안 멈춤).
3. **합치기**(`merge.ts`): 칸마다 — 한쪽만 읽음 → 그 값 / 같음 → 그 값·확신도↑ / 다름 → 형식 검증 통과·확신도 높은 쪽, 비슷하면 Paddle, 「다른 인식 결과: …」 경고·확신도↓.
4. **실패 안전**: Paddle 에셋 없음·로드 실패·90초 초과 → 조용히 tesseract 결과만(지금과 동일). 전체 OCR 시간 상한과 따로 잰다.
5. **에셋**: 공식 `@paddleocr/paddleocr-js` 0.4.2(Apache-2.0) + `onnxruntime-web` 1.31.1(wasm 전용 빌드)을 esbuild 로 워커 한 파일(10MB, Next 번들 밖). 모델 tar 2개는 npm 에 없어 공식 주소에서 sha256 고정으로 받는다(VPS 실측 2.6초). 첫 사용 기기는 약 42MB 를 한 번 받는다(브라우저 캐시).

## 수용 기준
- [x] 사진·스캔은 두 엔진 결과가 칸별로 합쳐진다(단위 8 + 하네스 4장).
- [x] Paddle 실패 시 기존 동작 그대로.
- [x] 메인 화면 번들에 Paddle/opencv 가 들어가지 않는다(워커는 public 정적 파일, ocr-paddle 은 dynamic import 경로만).
- [ ] 운영 배포 후 `/document-ocr/manifest.json` 에 paddle 항목 · 에셋 200.

## 되돌리기
squash revert 1회(모델 캐시는 무해하게 남음).

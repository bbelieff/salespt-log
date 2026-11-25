## 2026-11-25 · 사업계획서 작성도구 — 세금계산서 엑셀 → 매출처·매입처 TOP3
- 브랜치 `feat/bizplan-taxinv-top3`. belie 「세금계산서 엑셀을 TOP3 칸에 연결해줘」(간편인증 세션). 사업계획서 도구 세션의 PR #1468 병합 뒤라 같은 파일 동시 작업 없음.
- 변경: `lib/document-ocr/taxinv-top3.ts`(엑셀 시트 행 → 거래처 공급가액 큰 순 3곳 + 그 거래처의 가장 큰 품목 + 백만원), `bizplan-map` 에 `partner` 칸 종류(제안·맞춤·채우기), `ocr-run`/`BizplanOcr` 가 TOP3 자료 칸의 .xlsx 를 함께 읽음, TOP3 칸 안내 문구.
- 검증: `tests/document-ocr/taxinv-top3.test.ts`(실제 엑셀 생성기로 만든 파일을 읽어 두 기능 모양을 묶음, 빈 칸만 기본 체크·직접 적은 줄 보존), 라이브 셸 목업(localhost)에서 가상 엑셀 업로드 → 5줄 제안 → 채우기 → TOP3 표 값 확인.
- 미완료·위험: 운영 실물 엑셀로는 아직 안 읽어 봄. 파일은 브라우저 안에서만 읽고 서버로 보내지 않는다.

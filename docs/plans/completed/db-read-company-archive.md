---
slug: db-read-company-archive
status: completed
created: 2026-07-09
owner: belie
related: db-read-payments, db-migration-pilot, db-first-unlimited-roadmap
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: R2-4b — R2-4 에서 분리된 소형 후속: 실무/수납 업체정보 카드(loadCompanyInfoByContract, 06 company_archive)를 파일럿 기수 한정 DB read 로 전환.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/service/contract-payment.ts(loadCompanyInfoByContract), lib/repo/db/read-daily.ts(company 섹션)
> - **읽고 나면 알 수 있는 것**: 06 payload 3형태 / rename 키-only 부류를 어떻게 안전 처리하나 / 04 fallback 은 왜 유지되나
> - **관련 문서**: docs/plans/completed/db-read-payments.md(분리 사유 원본)

# R2-4b — 업체정보 카드(06) 읽기 DB 전환

## payload 3형태
1. **upsert 미러** = {업체명, 계약일, ...CompanyInfo 평탄화(커스텀=객체)} — rowKey=계약ref(`계약일|업체명`).
2. **backfill** = 열문자 A..AB (E..X=COMPANY_FIELDS 20, Y=커스텀 JSON 문자열, Z..AB=EXT 3).
3. **rename 미러** = 키 필드만(`_cleared:false, 업체명, 계약일`) — **스냅샷 없음**
   (시트 E~AB 는 보존되지만 DB 새 키엔 미기재).

## 안전 설계 (rename 부류)
DB 결과가 실질 빈값(hasCompanyInfo=false)이면 **기존 시트 경로로 자연 fallback** —
readCompanyInfoArchiveRow → (없으면) 04 미팅 업체정보 fallback 사슬 그대로 유지.
즉 DB 는 "값이 있을 때만" 응답을 단축하고, 모호하면 항상 시트 정본으로 내려간다.

## 수용 기준 스냅샷
- 정합 4케이스: upsert 평탄화 == backfill 열문자 == 시트 read 결과, rename 키-only 는
  빈값(→fallback 유도), 손상 커스텀 JSON 관용 동일.
- 파일럿·06 에 값 있는 정상 케이스: 시트 read 2회(ensureTab meta+행read) → **0회**.
- 비파일럿 불변, check.sh 초록.

## Log
- 2026-07-09 구현: read-daily.ts company 섹션(companyInfoFromDbPayload·
  readCompanyInfoFromDb), loadCompanyInfoByContract 게이트(빈값=fallback), 정합 4테스트.

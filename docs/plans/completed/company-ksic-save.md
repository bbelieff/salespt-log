> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 표준산업분류 추천에서 고른 코드를 업체정보에 저장한다(확장6 — 04 CJ · 06 BR, belie 2026-11-05).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/meetings-rows.ts` `COMPANY_FIELDS_EXT6` · `company-info-archive.ts` · `db/read-daily.ts` · `KsicLine`
> - **읽고 나면 알 수 있는 것**: 어디에 저장되나 · 옛 행은 어떻게 읽히나 · 되돌리기
> - **관련 문서**: [1단계 추천](../completed/company-ksic-suggest.md) · [sheet-structure 확장6](../../domains/sheet-structure.md)

# 표준산업분류 저장(확장6)

- 새 키 `표준산업분류`(자유 텍스트 default "") — 확장5 패턴 그대로 append: 04 CJ(88열) · 06 BR(70열), DB 는 필드명 JSONB 라 마이그레이션 없음.
- 빈값 = 자동(업태·업종 추천 1순위, 저장 안 함). 「고르기」 → "코드 이름" 저장, 「자동으로」 → "".
- 읽기 폴백 A:CJ → A:CI(확장5까지) → … — grid 를 안 넓힌 시트도 그대로 읽힌다. 옛 행은 "".
- TXT 내보내기에 [기업정보] 아이템 다음 줄로 포함(고른 값만).
- 데이터 영향: 열 하나 추가(기존 열 이동·기존 값 변경 없음). 되돌리기 = squash revert — CJ/BR 에 남은 값은 무시됨.
- 확인: 영향 시험 10개 폭 갱신 + 새 시험 `tests/repo/company-ksic-field-io.test.ts`, check.sh, 합성 화면 고르기·되돌리기.

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 맞춤공고 1단계 — 업체정보 [기업정보]에 지역(시·도/시·군·구)·대분류·제외 업종·공고 특성·「공고매칭 n/3」을 붙이고 저장 칸(확장5)을 만든 작업.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `_docs/경영일지_맞춤공고_핸드오프_20261025.md` §4-A·§7-1, `lib/analytics/company-grant.ts`, `lib/util/admin-regions.ts`, `components/company-info/CompanyGrantFields.tsx`, 확장5 저장(04 CE~CI · 06 BM~BQ)
> - **읽고 나면 알 수 있는 것**: 자동/직접 값 저장 원칙 · 행정구역 기준 · 다음 단계
> - **관련 문서**: 승인 목업 https://claude.ai/artifact/FhFf5Zm315ZzUt5dYzPhtu · 공고 분석 https://claude.ai/artifact/7eU6CygVUgNfjzVRSdUF2S

# 맞춤공고 1단계 — 업체정보 칸 (belie 2026-10-25 승인)

[병렬트랙] 맞춤공고: 소유 = `lib/analytics/company-grant*`, `lib/util/admin-regions.ts`, `components/company-info/CompanyGrantFields.tsx`, CompanyInfo 확장5 저장 경로. 다음 단계(B·C·D·E)는 `app/(app)/payment/**`·`/payment/news`·`FollowUpsLauncherView`.

## 저장 원칙
- 자동 값은 저장하지 않는다. 지역은 소재지, 대분류·제외 업종은 업태·업종·아이템, 벤처·이노비즈·메인비즈는 특허 및 인증에서 **읽을 때마다** 계산(`grantProfile`).
- 수강생이 직접 고른 값만 확장5(`지역시도`·`지역시군구`·`대분류`·`제외업종`(예/아니오)·`공고특성`(쉼표))에 저장 → 서류를 다시 읽혀도 덮이지 않고, 기존 업체 190곳도 일괄 쓰기 없이 바로 자동 제안이 보인다(§2-5 사용자 값 보존). 「자동으로」를 고르면 저장값을 비워 다시 계산.
- 저장 칸: 04 CE~CI, 06 BM~BQ, DB payload 키 이름(읽기 폴백 A:CI→CD→CC→BN→AS). TXT 내보내기엔 넣지 않음(매칭용 메타).

## 화면 (승인 목업 ①)
- 소재지 같은 줄 시·도/시·군·구 + 「자동」, 업종 줄 아래 대분류 + 「자동」 + 「제외 업종」, 4대보험|특허 줄 아래 「공고 특성」 칩, 헤더 「공고매칭 n/3」(지역·대분류·규모). 기본보기는 소재지+지역만.
- 소상공인(대분류+4대보험 직원)·업력·청년·매출은 칸을 만들지 않고 판정에만 쓴다(원칙 ①).
- 행정구역: 시·도 17 + 기초 시·군·구(일반구 제외). 2023 군위군 대구 편입·강원/전북 특별자치도·2026-07 인천 제물포구·영종구·검단구 반영(옛 중구·동구 유지).

## 검증
- 시험: `tests/analytics/company-grant.test.ts`(30), `tests/repo/company-grant-fields-io.test.ts`(13, 저장 왕복·옛 폭·폴백), 기존 폭 단언 갱신. 합성 화면(company-header-release, 실제 컴포넌트): 3/3 ✓·제조업·울산 남구·벤처 자동, 시·도 직접 선택 시 「자동」 사라짐·저장, 375px 가로 넘침 없음.

## 다음 (같은 트랙)
- 1b: 사업자등록증명·부가세 과세표준증명에서 소재지 읽기(§4-A 자동 선택 경로).
- 2: 공고 조건 데이터 계약(정책자금뉴스 → JSON), 3: 매칭 판정 순수 함수, 4: 실무/수납·데일리·오늘 챙길 일·할 일로 담기(todoSlotOf 예외 포함).

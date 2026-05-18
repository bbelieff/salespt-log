---
slug: sales-d-channel-labels
status: active
created: 2026-05-18
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업관리 D 컬럼 채널 라벨 (콜·지·기·소) hyphen→middle dot 정상화 — installFormulas 에 포함
> - **누가 읽나요**: 개발자

# sales-d-channel-labels

## 사용자 보고 (2026-05-18)
오승진 5/16 콜·지·기·소 미팅카드 → 04 업체관리 append OK, 영업관리 H +1 OK, 그러나 영업관리 I/J/K 결과 비어있음.

## Root Cause
- 영업관리 D 컬럼 콜지기소 라벨이 **"콜-지-기-소"** (hyphen U+002D) 로 박혀있음
- 코드 enum 은 **"콜·지·기·소"** (middle dot U+00B7)
- 영업관리 수식 `FILTER(...,'04업체관리'!F:F=$D{r})` 의 매칭 비교가 항상 false
- **6/7기 모든 시트 동일 사고** (템플릿 공통)

## Fix
- `installFormulas` 에 D 컬럼 채널 라벨 정상화 추가
- `CHANNEL_LABELS = ["매입DB", "직접생산", "현수막", "콜·지·기·소"]` 기준
- `shouldFixChannelLabel`: 빈 cell / 수식 / **separator 만 다른 stale variant** → 덮어쓰기
- 그 외 raw text 는 보존 (사용자 의도적 입력)
- 224 data rows (8주 × 7일 × 4채널) D 컬럼 검사

## 운영 절차
1. PR 머지 + 배포
2. admin → POST `/api/admin/install-formulas-bulk` (SA 일괄 install) 클릭
3. 모든 trainee 시트 D 컬럼 일괄 정상화 + 영업관리 I/J/K 수식 재install
4. 6/7기 콜지기소 미팅이 자동으로 영업관리 표시 영역에 노출됨

## Acceptance
- [ ] `shouldFixChannelLabel("콜-지-기-소", "콜·지·기·소") === true`
- [ ] `shouldFixChannelLabel("콜·지·기·소", "콜·지·기·소") === false`
- [ ] `shouldFixChannelLabel("매입DB", "매입DB") === false`
- [ ] `shouldFixChannelLabel("커스텀라벨", "매입DB") === false` (preserve)
- [ ] check.sh 통과
- [ ] admin install-formulas-bulk 실행 후 오승진 시트의 5/16 콜지기소 미팅이 영업관리에 표시

---
slug: admin-cohort-category-boxes
status: active
created: 2026-06-14
owner: belie
related: arena-season1-setup, role-system
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수강생관리(/admin/users) 화면을 수강생·아레나·테스트 3개 상위 카테고리 박스로 묶는 표시 변경.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: AdminUserPicker(수강생관리 그룹 렌더), lib/types cohortCategory
> - **읽고 나면 알 수 있는 것**: 카테고리 분류 규칙, 데이터 무변경 원칙
> - **관련 문서**: arena-season1-setup.md

# 수강생관리 카테고리 3박스

## 배경
AdminUserPicker 가 activeGroups(기수별 그룹)를 평면 나열 → A1-N기·8/7기·A1-0기가 섞임.
3 카테고리(수강생/아레나/테스트)로 한 단계 감싸 정리. **데이터·라우팅 불변**, 표시만.

## 구현
- `lib/types/cohortCategory(groupKey)`: `A시즌-0`=테스트, `A시즌-N`=아레나, 그 외 숫자=수강생.
  라벨 'A' 접두만으로 결정(날짜 추측 없음). `COHORT_CATEGORY_ORDER` 순서 상수.
- AdminUserPicker: activeGroups 를 카테고리별 partition → 비어있지 않은 박스만 렌더
  (헤더 색 수강생=blue·아레나=purple·테스트=gray). 박스 안은 기존 CohortSection 그대로.
  archived·reserved·pending 섹션 불변.
- 회귀 테스트: cohortCategory 단위테스트(rejoin-routing.test.ts).

## 상태
- 2026-06-14 구현 완료(feat/admin-cohort-category-boxes).

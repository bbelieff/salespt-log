---
status: completed
slug: company-info-section-ui
created: 2026-06-22
owner: belie
related: tokens, components
completed: 2026-06-22
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 섹션(CompanyInfoEditor) UI 개선 — 저장/편집 버튼 상단 + 배경 틴트·흰 카드 그룹.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: components/CompanyInfoEditor.tsx (contact·schedule·payment 공용)
> - **관련 문서**: tokens.md, components.md

# fix — 업체정보 섹션 UI (디자인 시스템 준수)

## 변경 (components/CompanyInfoEditor.tsx, UI만)
- **[1] 버튼 상단**: 헤더(제목 "🏢 업체정보" + 요약) 우측에 [편집][저장] 배치(기존 하단→상단). 저장=`bg-brand-red`(주), 편집(팝업)=`border-gray-300` outline(보조). hideSave 면 저장 숨김(부모 파란 저장). TXT 버튼은 하단 유지.
- **[2] 배경·필드 구분**: 펼침 영역 `bg-slate-50` 틴트, 업체/대표자 그룹은 `bg-white` 흰 카드(`border-gray-100`+shadow-sm) + 그룹 제목 하단 구분선 → 스캔 쉬운 카드 형태.
- 토큰: 표준 팔레트만(brand-red·slate-50·gray-100·white). **새 arbitrary value 없음**(기존 text-[10px] 등은 미변경). 신규 컴포넌트 없음(CompanyInfoEditor 기등재).

## 저장 동작 (불변)
- #411 통합 저장 유지(파란 저장/등록 시 업체정보 함께). 자동저장 아님 — UI만.

## 수용 기준
- 모바일/PC: 상단 버튼 정렬·틴트 배경·흰 카드 구분 정상, 기존 카드와 시각 일관(belie 스샷).
- 저장/편집·통합저장 동작 그대로. typecheck/lint/test/doc-drift 통과 + build + 배포 + health 200.

## Log
- 2026-06-22 구현(fix/company-info-section-ui): 버튼 상단 + 틴트 배경 + 흰 카드 그룹.

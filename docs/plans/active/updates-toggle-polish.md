---
slug: updates-toggle-polish
status: active
created: 2026-06-15
owner: belie
related: announcement-popup
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업데이트 현황(관리자) 노출 토글을 더 크고 브랜드색으로, 상태 라벨 추가.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: app/admin/popup/_components/UpdatesManager.tsx
> - **읽고 나면 알 수 있는 것**: 토글 크기·색, 라벨 정렬 규칙
> - **관련 문서**: announcement-popup.md

# 업데이트 현황 노출 토글 폴리시

## 변경
- 토글 h-5 w-10 → **h-7 w-12**(knob h-6 w-6), 손잡이 transition-transform.
- 켜짐 색 blue-500 → **brand-red**, 꺼짐 gray-300.
- 토글 왼쪽 상태 라벨: 켜짐 "노출"(text-brand-red) / 꺼짐 "숨김"(text-gray-400),
  `w-8 text-right text-[11px] font-bold` 고정폭(정렬 흔들림 방지).
- 라벨+토글 묶음 `flex w-24 shrink-0 justify-end gap-2`, 헤더 "노출" 컬럼도 w-24 로
  1:1 정렬. 제목 input 은 flex-1 min-w-0 유지(긴 제목이 토글 안 밂).
- 토큰: 기존 brand-red/gray 만 사용. arbitrary width 안 만듦(w-24 표준).

## 상태
- 2026-06-15 완료(fix/updates-toggle-polish). 동작·일괄저장은 기존 그대로.

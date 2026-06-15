---
slug: updates-manager-mobile-cards
status: active
created: 2026-06-16
owner: belie
related: announcement-popup, updates-toggle-robust
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 팝업관리 업데이트 현황을 모바일 카드 / 데스크탑 테이블로 반응형 분기.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: app/admin/popup/_components/UpdatesManager.tsx
> - **읽고 나면 알 수 있는 것**: 왜 모바일에서 찌부됐나, pc: 분기 방식
> - **관련 문서**: announcement-popup.md

# 업데이트 현황 모바일 카드형 반응형

## 원인
- 행이 고정폭 한 벌(#w-10·날짜w-16·유형w-10·마일스톤w-28·노출w-24 ≈ 384px)만 존재 →
  모바일(~380px)에서 제목 input 0 찌부 + 컬럼 잘림. 모바일 분기 없음.

## 수정 (pc:1024 분기, 한 마크업)
- 열 헤더: `hidden pc:flex` (모바일 숨김 — 카드 자체 라벨). 순서=데스크탑 컬럼과 1:1(유형·#·날짜·내용·마일스톤·노출).
- 행 li: `flex flex-col gap-2 pc:flex-row pc:items-center`.
  - 메타줄 wrapper `flex justify-between pc:contents` + 안쪽 `pc:contents` → 데스크탑선 컬럼이 li 직접 자식으로 펼쳐짐.
  - 모바일: 1줄 [유형·#pr·날짜](좌) ↔ [노출 라벨+토글](우), 2줄 제목 w-full, 3줄 마일스톤 w-full.
  - 데스크탑: 유형 w-10·# w-10·날짜 w-16·제목 flex-1·마일스톤 w-28·노출 w-24(노출은 pc:order-last).
  - 작은 메타는 모바일 auto폭/데스크탑 고정폭(pc:w-*). 토글 자체는 그대로(레이아웃만 반응형).
- dirty 노란 강조·일괄저장 동작 불변.

## 검증
- 스샷 375/768/1280. dirty·저장 유지. typecheck/lint/test green.

## 상태
- 2026-06-16 진행(fix/updates-manager-mobile-cards).

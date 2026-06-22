---
slug: contact-firstrow-readonly
status: active
created: 2026-06-22
owner: belie
related: pr-db-channels-full, 0020-production-metric-ssot-to-db, 0023-banner-posting-log-1n
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택관리 생산(첫 행) 스테퍼를 제거하고 채널별 읽기전용 표시로 바꾸는 C4.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: ChannelTabsAndPanel, contact page, useDBOverview
> - **읽고 나면 알 수 있는 것**: 왜 읽기전용인지, 채널별 표시값, 합계 처리
> - **관련 문서**: [ADR-0020 생산 SSOT](../../decisions/0020-production-metric-ssot-to-db.md), [정본 §R1](../../handoff/pr-db-channels-full.md)

# PR-C4 — 컨택 첫 행(생산) 읽기전용

## 배경
ADR-0020 로 생산(E)은 DB집계가 소유 → 컨택의 생산 스테퍼는 **백엔드가 무시(먹통)**. 사용자가 헛입력. 제거하고 채널별 읽기전용 표시로 교체(정본 R1).

## 변경 (UI 전용 · 스키마 변경 없음)
- `ChannelTabsAndPanel`: 생산 행을 스테퍼 제거 → 읽기전용. `useDBOverview` + 선택 날짜로 채널별 파생 표시:
  - 매입DB = 구매 누적(Σ주문개수, 구매일 ≤ 선택일)
  - 직접생산 = 생산기간 진행중 건수(시작일 ≤ 선택일 ≤ 종료일)
  - 현수막 = 오늘 게시 N장 · 남은(주문−게시누적)
  - 콜·지·기·소 = 오늘 발굴(접수) 수
- 합계·탭 배지 = **유입~미팅예약만**(생산 제외). 생산 행 합계 칸은 헤더와 병합(빈 칸).
- page: 선택 날짜(date) 패널에 전달.

## 트레이드오프 / 후속
- 매입DB는 정본의 "유입대기 = 생산누적−유입누적" 중 **생산누적(구매 누적)만 표시**. 유입누적은 영업관리 F 누적(서버)이 필요 → fast-follow 로 loadDay 확장 시 정확한 유입대기로 교체.

## 수용 기준
- 생산 행 편집 불가(스테퍼 없음), 채널별 읽기전용 값 표시. 합계는 유입~미팅예약만 4채널 합산.
- 저장(F:H)·미팅 등 기존 동작 회귀 없음. typecheck/lint/structural/unit/doc-drift/size + build + 배포 + health 200.

## Log
- 2026-06-22 구현(feat/contact-firstrow-readonly): 생산 스테퍼 제거 + 채널별 읽기전용 + 합계 생산 제외.

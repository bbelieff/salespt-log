---
status: completed
slug: mobile-ux-db-contact
created: 2026-06-23
owner: belie
related: db-contact-link-v2, 0024-direct-production-inflow-sync
completed: 2026-06-23
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB생산·컨택관리 두 탭의 모바일(360px) 텍스트 깨짐(말줄임·과대폰트·과밀)을 전 채널 교정.
> - **누가 읽나요**: 개발자
> - **연결**: ChannelTabsAndPanel·MeetingSlotItem, db RowForm·RowCard·ChannelTabs, CompanyInfoEditor, globals.css
> - **관련**: docs/design/tokens.md, ADR-0024, 현수막 v2(#448)

# fix — 모바일(360px) UX 깨짐 전수 교정

레이아웃·폰트만. 시트/도메인 로직 무변경. 현수막 게시 로직은 #448 소관(본 PR 미접촉).

## P0 근본원인
1. 컨택 스테퍼 행 좌측 압살: 60/40 분할 안에서 stepper(≈128px)가 라벨/도움말 공간 ~45px 로 압축 → 도움말 truncate "…" 소멸.
2. 합계 칸 과대·중복: 우 40% 가 text-3xl 숫자 + 지표명 중복.

## [A] 컨택 입력 패널 (ChannelTabsAndPanel)
- 60/40 폐기 → 한 행 = [라벨+도움말 flex-1 min-w-0] · [스테퍼] · [슬림 합계칩(채널색, text-sm)].
- 도움말/헤더 desc: truncate → line-clamp-2 + break-keep(한글 보존).
- 합계: 30px 칼럼·지표명 중복 제거 → 슬림 숫자.
- 첫 행 읽기전용 채널별 유지(현수막 게시 스테퍼는 #448 그대로, 레이아웃만 정렬).

## [B] 컨택 미팅카드 (MeetingSlotItem New/Saved 헤더)
- 6요소 1행 → 2단: 1행 [#N·채널·시간·상태(+date)], 2행 [업체명 flex-1 · 장소]. 장소 max-w 제거(truncate만).

## [C] DB생산 collapsed 카드 (RowCard makeSummary)
- 날짜 풀ISO → M/D(공용 mdShort 헬퍼). sub truncate → line-clamp-2 + break-keep. 행번호 배지 text-[10px]→text-xs.

## [D] DB생산 폼·업체정보 폰트·placeholder (RowForm, CompanyInfoEditor)
- 라벨 text-[11px]/[10px] → text-xs(12px). 🔒배지 text-[9px]→11px. 자동필드 라벨 과밀 해소(break-keep 2줄).
- 긴 placeholder → 라벨 밑 보조 예시 줄(break-keep)로 이동.

## [E] 채널 4-탭 (db/ChannelTabs)
- 13px vs 11px 점프 제거 → 4개 text-xs 통일, 콜지기소 tracking-tight 유지.

## 토큰 규칙
- 제거하는 text-[9/10/11px]는 text-xs 등 토큰으로. 최소 12px(아이콘 배지 11px 예외). 신규 arbitrary 금지.
- globals.css .stepper-btn/.stepper-val 축소(MetricStepper 외 미사용 — 컨택 전용 영향).

## 검증 (360px)
- 도움말 "…" 없이 2줄 / 합계 ≤16px·지표명 1회 / 스테퍼 탭타깃 충분 / 미팅 업체명 풀폭·장소 안 잘림 /
  DB sub 날짜 짧고 꼬리 보임 / 12px 미만 없음(배지 11px 예외) / typecheck·lint·test·doc-drift 그린 + 스크린샷.

## Log
- 2026-06-23 구현(fix/mobile-ux-db-contact). #450 배포.
- 2026-06-23 리비전(fix/contact-today-total-restore): belie 검수 후 '오늘 합계'는 본질 정보라 **칼럼 복원**.
  슬림 64px·숫자 text-2xl(24px≈22 목표, arbitrary 회피)·채널색·지표명 중복 제거, ⭐오늘합계 제목 셀 헤더+생산행 세로 병합 유지.
  스테퍼 30/32/16. 스테퍼행 도움말 1줄 truncate(합계 우선). [B][C][D][E]는 #450 그대로.

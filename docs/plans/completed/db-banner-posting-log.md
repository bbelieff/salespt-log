---
slug: db-banner-posting-log
status: active
created: 2026-06-22
owner: belie
related: 0023-banner-posting-log-1n, pr-db-channels-full, sheet-structure, data-model
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 현수막 주문(P:V) 1건에 게시 N건을 로그(AF:AI)로 두고 생산(E)을 게시일 기준으로 재정의하는 C2.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/repo/banner-post.ts, lib/service/db.ts, BannerPostingLog, /api/db/banner-post
> - **읽고 나면 알 수 있는 것**: 1:N 구조·생산 기준 변경·검증
> - **관련 문서**: [ADR-0023](../../decisions/0023-banner-posting-log-1n.md), [정본 §3-A](../../handoff/pr-db-channels-full.md)

# PR-C2 — 현수막 주문→도착→게시 (1:N)

## 스코프
현수막 게시 로그(AF:AI, 1행=1게시) 신설. 현수막 생산(E) = **게시일 Σ게시수**(구: 발주일 Σ주문개수). 남은 = 주문장수 − Σ게시수. 주문 카드에서 게시 추가/삭제.

## 변경
- types: `DBBannerPost`(게시id·주문ref·게시일·게시수).
- `lib/repo/banner-post.ts`(신규): read/append/update/clear (AF:AI, §2.5 빈행 append).
- `lib/service/db.ts`: loadDBOverview+bannerPosts. productionCountFor(현수막)=게시일 Σ게시수. readChannelRows(현수막)=게시 로그. 주문 CRUD 는 E sync 제거(비용만). addBannerPost/patchBannerPost/removeBannerPost(게시일 sync).
- `/api/db/banner-post`(POST)·`/[row]`(PATCH/DELETE). hooks useAppendBannerPost/useRemoveBannerPost.
- UI `BannerPostingLog`(주문 카드 expanded): 게시 목록·남은·추가/삭제.
- config sections(현수막게시 추가 + 구 stale cols 갱신), ADR-0023, sheet-structure/data-model/components.

## 수용 기준
- 주문 추가 → 카드 펼침 → 게시(게시일·게시수) 추가 → 그 게시일 01 영업관리 E 에 Σ게시수 반영. 남은=주문−게시누적.
- 게시 삭제 → E 재집계. 여러 게시일 분산 시 각 게시일에 정확히.
- 기존 현수막 주문(게시 없음) → 현수막 생산 E=0 (의도: 생산=게시).
- 매입DB·직접생산·콜 회귀 없음. XP 가중치 불변(회귀 확인).
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 success + health 200.

## 후속
C4 컨택 첫행(현수막=오늘 게시/남은 이 로그 사용) → C5 넛지 → §7 매출.

## Log
- 2026-06-22 구현(feat/db-banner-posting-log): AF:AI 게시 로그 + 게시일 생산집계 + 게시 UI. additive(신규 섹션).

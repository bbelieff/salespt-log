---
slug: db-contact-link-v2
status: active
created: 2026-06-23
owner: belie
related: 0024-direct-production-inflow-sync, 0025-banner-production-is-posting, 0020-production-metric-ssot-to-db, 0023-banner-posting-log-1n
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 현수막도 직접생산처럼 "게시가 곧 생산" — 컨택 게시 스테퍼가 영업관리 E(현수막) 소유. 게시로그(AF:AI) 서브시스템 삭제.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: contact/db 탭, lib/service·repo, banner-post 삭제
> - **관련 문서**: [[docs/decisions/0025-banner-production-is-posting]], ADR-0024(직접생산), ADR-0020·0023

# feat — DB생산↔컨택 연동 v2 (현수막)

> **[A] 직접생산 v2 는 #447 로 이미 배포 완료** (M=Σ유입 동기화·E=F 미러·겹침차단·보류모달·첫행·세로병합). 이 PR 은 [B] 현수막 v2 + ADR.

## E 소유 맵
| 채널 | E(생산) 소유 | syncProduction |
|---|---|---|
| 직접생산 | 컨택(유입 미러) | 제거(ADR-0024) |
| **현수막** | **컨택(게시)** | **제거(ADR-0025)** |
| 매입DB | DB집계 | 유지 |
| 콜·지·기·소 | DB집계 | 유지 |

## [B] 현수막 v2
- **게시로그(AF:AI) 서브시스템 전체 삭제**: banner-post.ts·BannerPostingLog.tsx·/api/db/banner-post(route·[row])·useAppendBannerPost/useRemoveBannerPost·DBBannerPost·loadDBOverview.bannerPosts·현수막게시 SHEET_RANGES·productionCountFor/readChannelRows 현수막 분기·RowCard BannerPostingLog.
- **DB생산 현수막 = 주문만** (주문일·업체·도착일·총액·주문장수·부가세 → 장당단가 자동, 부가세제외). 게시 입력 제거.
- **컨택 현수막 첫 행 = "게시" 스테퍼**(+/-, 다른 행과 동일 스타일), help="현수막재고 N개".
  재고 = Σ주문장수(DB) − Σ게시누적(영업관리 E 현수막) + 오늘 draft 라이브. 재고 0 클램프(경고).
- **게시 → 영업관리 E(현수막)=게시**(컨택 소유). `batchWriteChannelDailyRows` 현수막 분기: E=production. 장당단가는 주문 때 확정(게시 무관).
- 재고 base = loadDay 서버 계산(`bannerStockBase = Σ주문장수 − stacking[0][2] + saved게시`), inflowWaitBase 패턴.

## 마이그레이션 (gated — belie 확인 후 1회)
- 기존 E(현수막)은 구 syncProduction 이 이미 Σ게시수(게시일별)로 채워둠 → **배포 시 데이터 유실 없음**.
- `scripts/migrate-banner-posts-to-sales-E.mjs` (dry-run 기본): AF:AI 게시 → 영업관리 E(현수막) 게시일 합산 ensure 후 AF:AI clear. belie 확인 후 실행.

## 수용 기준 (배포 후 belie 클릭)
- 현수막 게시+→재고−·생산+ / 재고0 클램프 / E 단일기록(이중X) / 매입DB·콜·직접생산 영향 0.
- typecheck/lint/test/doc-drift 그린 + build + 배포 + health 200.

## Log
- 2026-06-23 구현(feat/db-contact-link-v2): 게시로그 삭제 + 현수막 게시 스테퍼 + ADR-0025.

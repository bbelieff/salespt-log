---
status: completed
slug: db-vat-flag-persist
created: 2026-06-21
owner: belie
related: db-vat-reverse-input, pr-db-channels-full, sheet-structure, data-model
completed: 2026-06-21
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 부가세 역산의 "부가세 포함 여부"를 시트 컬럼(매입DB H·현수막 W)에 저장해 재편집 시 토글을 복원하는 작업.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: lib/types(DBPurchase·DBBanner), lib/repo/db.ts, DB관리 폼
> - **읽고 나면 알 수 있는 것**: 왜 컬럼을 추가했는지, additive 인 이유, 라운드트립
> - **관련 문서**: [#424 역산 입력(완료)](../completed/db-vat-reverse-input.md), [정본](../../handoff/pr-db-channels-full.md)

# C3 보강 — 부가세여부 컬럼 영속화 (매입DB H · 현수막 W)

## 배경
[#424](../completed/db-vat-reverse-input.md) 는 총액·부가세토글을 입력 도우미(저장 X)로만 써서
재편집 시 토글이 항상 off 로 보이는 트레이드오프가 있었다. 정본 보강 결정: **부가세여부를 저장**한다.

## 결정 (additive, 저위험)
- `부가세여부: boolean` 을 매입DB **H**, 현수막 **W** 에 저장. 두 컬럼은 섹션 사이 **빈 gap 컬럼**
  (매입DB G↔직접생산 I 사이, 현수막 V↔콜·지·기·소 X 사이)이라 기존 데이터 이동 없음 = additive.
- 저장값은 여전히 **부가세 제외 개당단가**(역산) + 주문금액(시트수식 F/U). 부가세여부는 보조 플래그.
- 기존 행은 H/W 빈칸 → `toBool("")=false` 로 안전 기본값. 마이그레이션 스크립트 불필요(lazy backfill).

## 변경
- `lib/types/index.ts`: `DBPurchase`·`DBBanner` 에 `부가세여부: z.boolean().default(false)`.
- `lib/repo/db.ts`: SPEC endCol 매입DB G→H·현수막 V→W. `toBool` 헬퍼. readPurchases(B:H)/readBanners(P:W)
  파서에 부가세여부, append/update Purchase(H)·Banner(W) 쓰기. 주문금액 수식(F/U) 유지. writeRow boolean 허용.
- `app/(app)/db/_lib/channels.ts`: 매입DB 토글 key `부가세포함`→`부가세여부`, formOnly 제거(저장 대상). 총액은 formOnly 유지.
- `app/(app)/db/_components/RowForm.tsx`: 편집 시 저장된 개당단가·부가세여부로 총액 역복원(포함이면 ×1.1) → 토글·개당단가 라운드트립.
- 현수막 폼의 토글/역산 입력은 C2 에서(헬퍼·컬럼·repo 는 본 PR 에서 선반영).

## 수용 기준
- 매입DB 추가: 총액 11,000 / 10개 / 부가세 포함 → 개당단가 1,000 저장(D열), H=TRUE 저장.
- 그 행 재편집 → 토글 ON·개당단가 1,000 그대로(라운드트립), 저장 깨짐 없음.
- 기존(H 빈칸) 행 → 토글 OFF 로 안전 로드, 회귀 없음.
- 직접생산·콜·지·기·소 무영향. 대시보드 비용 합(주문금액 F/U) 무영향.
- typecheck/lint/structural/unit/doc-drift/size + build + 배포 success + health 200.
- 라이브: 소수 시트 선검증(추가→H 기록 확인) 후 정상.

## Log
- 2026-06-21 구현(feat/db-vat-flag-persist): 부가세여부 H/W 영속화. additive(gap 컬럼), 마이그레이션 없음.

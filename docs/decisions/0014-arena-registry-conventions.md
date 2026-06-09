# ADR-0014: 아레나 레지스트리 표기 규약 (부부·회장/입금 메모)

- Status: accepted
- Date: 2026-06-10
- Supersedes: —
- Related: ADR-0011(drive-sheets-write-expansion), ADR-0012(arena-folder-create)

## Context

아레나(시즌별 경쟁) 참가자를 관리자 화면에서 명단 원문 붙여넣기로 일괄 생성한다
(`/api/admin/create-arena-members`, `parseArenaRoster`). 명단에는 일반 기수와 다른
세 가지 정보가 섞여 들어온다:

1. **부부 참가자** — 한 경영일지 시트를 부부가 공유. 명단 표기 `류서하(심나영)`.
   본인이 클레임할 때 둘 중 한 이름만 입력해도 본인 시트에 연결돼야 함.
2. **기수 회장(`*`)** — 향후 "본인 기수원 조회" 권한 부여 대상(이번 범위 밖, 기록만).
3. **입금 여부(`$`)** — 운영 메모(기록만).

자기기수 라벨은 `A{시즌}-{자기기수}기` (ADR 0012 후속, claim-arena-mode PR #327).

## Decision

1. **레지스트리 `name`(C) = 표시이름.** 부부는 `류서하(심나영)` 두 이름 모두 보존.
   시트 제목·업체폴더명도 동일 표시이름 사용.
2. **부부 매칭(`lib/repo/name-match.ts`)** — 저장값을 `{전체, 앞이름, 뒤이름}` 후보로
   펼쳐 입력 이름과 비교(`nameMatches`). `findExistingSheetIdByCohortName`(claim 매처)와
   `claimRegistry`(prep row 채움) 양쪽에 적용 → 첫 배우자 claim 이 prep row 를 채워 active.
   비부부(괄호 없음)는 후보 1개 = 기존 정확 일치 → **무회귀**.
3. **메모 컬럼 `users!Q` 신설** — 값 `회장`/`입금`/`회장,입금`/빈. 회장/입금 마커는
   파서가 이름에서 제거하고 이 컬럼에만 기록. **앱 동작 없음(기록 전용)**.
   `ensureRegistryHeader` 가 헤더에 `memo` 추가, 읽기 범위 `A2:Q`.
4. **파서 마커 규약** — `*`=회장, `$`=입금(접두/접미 무관), `()`=부부, `N기`=기수 헤더,
   시즌은 원문 `A{n}` 우선·없으면 입력 시즌. (`lib/service/arena-parse.ts`)

## Consequences

- 동명이인은 `(기수, 표시이름)` 으로 구분(예: A1-1기 김지훈 ≠ A1-3기 김지훈).
- 회장 권한(기수원 조회)·입금 정산 등 **앱 기능은 후속 ADR** 에서 메모 컬럼을 입력으로 사용.
- 부부 표시이름에 콤마가 들어가면 콤마 분리가 깨짐 — 현 명단엔 없음(괄호 내 콤마 금지 규약).
- `users` 탭 범위가 `A2:P`→`A2:Q` 로 확장. sheet-structure.md 6절 등재.
